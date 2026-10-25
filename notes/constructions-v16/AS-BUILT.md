# Constructions v16: INTERFACE as built

Built in `work/xvc` on top of CORE (`AS-BUILT-core.md`) on 2026-10-24. This is the INTERFACE part of `SPEC.md`
(§4–7, §9 toasts, §10–12, §15, §16, §18 `constr_cmd`). Status: built and tested; `test/constr_cmd.js` passes 101/101, the six
acceptance files and the quality suite pass, `make_ru_table.py --strict` reports 0 unresolved. The published page
(`dist/complex-map-workbench.html`, sha256 `298ead5b…f56cf3`, the same bytes on two builds) has no `__cmw` hooks.

## What the user gets

- **Every point on the page snaps and binds.** Point shapes, the handles of other shapes (ends, centres, arc middles,
  polygon and rectangle corners), the zeros and poles of f₁, crossings of any two drawn curves (found at the pointer),
  and, when drawing in Y with the whole chain shown, the images F(z₀) (labelled z₀′, z₀″…). A ring and a chip ("on z₂",
  "on ζ₁", "on the end of Segment 1", "on Circle 1 ∩ Segment 1") show the snap before the press, at 8 px with a mouse
  and 22 px on touch (the chip 48 px above a finger). Alt suspends it; the Snap toggle governs it for drawing tools.
- **Drawing tools bind.** Segment, Line, Ray, Half-plane, Rectangle, Arc (both ends; its middle handle binds when
  dragged onto a point, and its tooltip now says "An arc through 3 points" [C24]), Circle and Disc (centre at the
  press, the rim through the release point), Annulus and Sector (centre), Polygon (every clicked vertex). The start binds
  at the press. A crossing makes a small helper meet point (no label, indented row) owned by the shape. Drawing tools
  never snap to a bare curve.
- **The Point tool** selects an existing point, drags a zero (v15), makes a meet point on a crossing, a point on the
  curve on a stroke (6 px mouse / 10 px touch), else a free point.
- **Four new tools, the Construct group**: Circle through 3 points (Curve | Region switch on the chip, Region by
  default), Intersect (a crossing, or curve 1 then curve 2: both points), Midpoint and Perpendicular bisector (two points,
  or a click on a segment). Picks are clicks (a drag between picks pans); a pick on empty space makes a free point in the
  same undo step; a dashed preview runs through the pointer; Backspace drops the last pick, Esc cancels (touch: the
  chip's ×). A co-argument is refused with "Circle through 3 points needs distinct points".
- **Dragging built things.** A bound handle has no square (a small ring instead); a press there goes to what is
  beneath (the point moves, another shape's handle drags, a zero drags as a zero). A point on a curve slides along it.
  A fixed constructed point stays and says "z₄ is built from Circle 1, Segment 1: drag those". A shape built only on
  free points moves them all (a line through z₀, z₁ drags both); one built on a zero or another shape's handle pans X,
  with the chip "Built on ζ₁, …: drag those, or Make free" once per session. A free handle dropped on a target binds.
- **Rows.** The definition in the row ("the disc through z₀, z₁, ζ₁", "the half-plane left of z₀ → z₁",
  "Circle 1 ∩ Segment 1, first point", "on Circle 1", "midpoint of z₀, z₁", "bisector of z₀, z₁"), the equation in its
  tooltip; a link glyph with "follows …" for bound shapes; the undefined reason in the row's error style with the eye
  disabled; hovering a row (or selecting one on touch) tints the rows of linked shapes. ⋯ gains Make free, Use complement
  (flips the 3-point region), Curve/Region, Other point, Show as point, and "Delete (and n built on it)". A construction's
  row has no v15 field editor (its fields are its definition).
- **Inspector**: a Construction view when a construction is selected and the selection is the region: definition,
  reason, Uses / Used by chips (hover highlights, click selects), Curve | Region, Use complement, Other point, the t of a
  point on a curve (a number or a shared-number formula, v15's bind), Make free, Delete. It never opens by itself.
- **Plane menu** group "constructions": Mark the intersection, Point on this curve, Circle through this point…, Midpoint
  with…, Put on this curve (a free point onto the curve under it), Make free.
- **Deleting**: only definitions cascade; bindings to a deleted shape are freed. One toast with Undo: "Deleted z₁ and 3
  shapes built on it." / "2 shapes no longer follow it." Removing a zero deletes nothing: its constructions turn
  undefined ("ζ₁ was removed"), the toast adds "1 shape is now undefined.", and while the zero is dragged off the plane
  its chip reads "Release to remove ζ₁; 1 shape will be undefined".
- **Undefined in a gesture**: drawn as its last good shape, dashed at 30 %, only while the gesture lasts.
- **Globes**: on an editable X (or Y) globe the construction tools pick the same point targets, projected, plus N (∞)
  for Circle through 3 points, so circle(P, Q, ∞) is the line (half-plane) through P and Q.
- **Export captions**: "the disc bounded by the circle through $z_2=-1-1.5i$, $z_0=-2+0.5i$ and $\zeta_1=1.5-i$", "the
  intersection $z_3=0.866+0.5i$ of Circle 1 and Line 1", and so on, in maths, English and Russian.
- **Platforms**: desktop grid "Construct" under Draw (one row of four); the tablet rail gets the four after a divider
  (and the drawer the grid); the phone's More tools sheet gets a "Construct" heading and the four tiles; a tile closes the
  sheet and shows on the More key with its short label; the chip sits left of the plane's button column on a phone.
- **Palette**: the four tools, and Make free / Use complement for a selected construction.
- **Tour**: chapter 4 "Constructions" (scene: 1/z, three points and the line through two): Circle through three points,
  It follows its points (drag z₂ across the line: half-plane, then complement), Intersections.

## Files

| File | Change |
|---|---|
| `src/construct.js` | Replaces CORE's stub (keeps `init`, `on`, `events`, `api`). Snap targets, the ring and chip, binding, the four tools, globe picks, moving built shapes, texts (definitions, reasons, toasts, captions), rows, ⋯ items, the plane-menu provider, the Inspector view, palette entries, its CSS (injected), the grid. Every entry point is inert until `Construct.ui(adapter)`. |
| `src/app.js` | One guarded line per hook (`typeof Construct !== 'undefined'`), named by function: TOOLS (+4 rows) and ICON, buildTools (the grid, tile labels, rail divider), setTool, onDown (pointer; zpHit only in Select and Point [C1]; a bound handle does not count as the selected shape's handle), editDown (construction tools; Point tool; draw start; polygon vertices; a press on a bound handle; bound handles skipped), finishPolygon, onMove ('handle', 'move', 'draw', hover), onUp (bind a dropped handle; a click picks; a globe click picks; draw end), globeDown, renderOverlays (L and R), drawHandles, drawPoints (rings, helpers, ∞), drawZpHandles (the drag-off note), updateDraftChips, deleteShape (toast), updateShapeList / shapeRow / buildShapeList (rows, ⋯, links), shapePhrase (captions), paletteItems, addShape's tour event (`bound`), the tour's `has('constructions')`, `cmUiApi()` (the adapter, next to `cmApi`) and its init line, and `__cmwCI` (test hook, stripped from the published page). shapesChanged: no Y auto-fit while a pointer gesture moves shapes, points or zeros (onUp fits once) — CORE's [C3a] for pointer drags only. |
| `src/inspector.js` | The Construction view (3 lines in `render`). |
| `src/phone.js` | More tools: the Construct heading and tiles; syncTools watches `#constructTools` and shows the tile's short label. |
| `src/tour.js` | Scene `construct`, chapter `construct` (after Editing the chain), anchor `constructTools`. |
| `src/i18n_ru.js` | Regenerated. |
| `tools/make_ru_table.py` | Reads `notes/i18n/ru/v16-*.json`. |
| `notes/i18n/ru/v16-constructions.json` | 96 entries (tools, chips, refs, reasons, definitions, toasts, menu items, Inspector, captions, tour, the Arc tooltip). |
| `notes/tour/INTEGRATION.md` | Two appended tables: "Anchors added in v16" (`constructTools`), "Events added in v16" (`construct-added`, `construct-family`). |
| `test/constr_cmd.js` | New (sections A–I below). |
| `test/t_tour.js` | Reads the v16 tables; chapter order with `construct`; budget 5–9 chapters, 20–43 steps. |
| `test/tour_cmd.js` | Nine chapters in the tour menu and the palette (two count checks). |
| `test/ci_cdp/` | My copy of the CDP kit (port 9203; `q.sh` waits 900 s, export_cmd takes about 6 minutes). |

## Interface to CORE

Only `cm` (create, bind via fields, setDef, makeFree, remove) and `Constr` (pieces, meetNear, meets, onPiece,
projectPiece, resolve, graph, deletePlan, zeroRemovePlan, moveRoots, circle3, geomOf, orient, refKey). No CORE file
changed except the hooks listed above in app.js's UI functions and the one shapesChanged condition. The two new CORE
reason codes have strings: `tRange` "The point is off the end of its curve", `handleInf` "Only a line can pass through ∞".

## Tests

Headless Chrome (ANGLE Metal), `dist/test.html` served on port 9203, one browser at a time.

**`test/constr_cmd.js`: 101/101 pass** (about 2 minutes). Sections, each a fresh namespace:

- **A** desktop 1440, light, English: the grid; the hover ring "on z₀" and the chip; Circle through 3 points from z₀, z₁
  (3 px off) and ζ₁ of f₁ (one undo step, the press on ζ₁ does not move it, the circle passes through all three to
  1e−12, the row and the Inspector read "the disc through z₀, z₁, ζ₁"); dragging ζ₁ moves the disc through it; Shift-click
  still adds a zero in a construction tool; a half-plane from polygon vertex 1 to vertex 3 binds both ends ("follows
  vertex 1 of Polygon 1, vertex 3 of Polygon 1") and follows the vertex; a drawing tool from a bare stroke binds nothing;
  from a crossing it binds a helper meet point (row under its owner); Alt binds nothing; Intersect on a crossing (on
  the circle and the segment to 1e−12, where clicked), and curve then curve (both points); the Point tool on a stroke
  makes a point on the curve that slides along it; a meet point does not move and says what it is built from; Midpoint,
  then the circle through z₀, z₁ and the midpoint is the half-plane with A = 0 exactly, still after z₀ is dragged (its
  edge through z₀ and z₁ to 1e−12); undo and redo; a co-argument gives "Circle through 3 points needs distinct points";
  Esc; a line through two free points drags both; a disc on ζ₁ pans; delete z₁: "Deleted z₁ and 3 shapes built on
  it." and Undo; ⋯ Make free; the plane menu's Mark the intersection.
- **B** reload: every construction comes back bitwise and ζ₁ still drives its disc; a link (`#cmw=`, 936 characters)
  opens the constructions in a fresh namespace.
- **C** Russian: the tiles «По 3 точкам», «Пере­сечение», «Середина», «Перпен­дикуляр» fit; «привязка: z₀»; the chip;
  the row «круг, ограниченный окружностью через z₀, z₁, ζ₁»; the toast «Удалено: z₁ и зависимые фигуры (1).»
- **D** dark at 1440 (pick, ring), 1024 × 768 and 768 × 1024 (the rail has the divider and fits).
- **E** phone 390 × 844 with an Android Chrome user agent and touch: More tools has «Construct» and the four tiles; a
  tile closes the sheet and lights the More key; taps 15 px off z₀ and z₁ pick them (22 px); the chip has a × and no
  Esc; an empty tap makes a free point in the same step; the Russian sheet at 390 px.
- **F** frame times, dragging a free point with 1, 10 and 50 dependent 3-point discs and circles (best of two runs),
  1/z in Y: 1 dependent: rAF work p95 2.4 ms, pointermove p95 1.1 ms, frame p95 16.7 ms; 10: 5.7 / 1.5 / 16.8 ms (both
  pass BUDGET60); 50: 20.3 / 1.8 / 33.4 ms (reported, not met).
- **G** a meet made undefined by dragging the line off the circle (hidden mid-gesture, the ghost, the row's reason,
  the eye disabled, back on undo); ζ₁ dragged off the plane: removed, its circle undefined and kept ("ζ₁ was removed",
  "1 shape is now undefined."), undo; the export caption in English and Russian; in Y, Circle through 3 points picks
  z₂′ (an image ref, the chip "on z₂′") and two empty spots.
- **H** X Sphere: z₀, z₁ picked on the globe, a drag turns it (the draft survives), N picked: circle(z₀, z₁, ∞) is the
  half-plane left of z₀ → z₁.
- **I** Polygon: clicked vertices bind; a press on a bound vertex of the selected polygon drags the point beneath; a
  free point dropped on a point stays free.

**Acceptance files** (re-run unchanged, except the port and tour_cmd's two chapter counts):

| File | Result |
|---|---|
| `v15_desktop_cmd.js` | pass. (Under heavy load from other Chrome processes its two drag-frame checks failed once; the frozen v15.1 dist failed the same two checks at the same time; both pass at normal load.) |
| `v15_phone_cmd.js` | pass. (The first run found the Construct grid taking width in the phone tool row, so the six tool keys were under 44 px: fixed, `phone.css` shows `#secDraw > .tools` with `!important`.) |
| `tour_cmd.js` | 95/95 (with the counts of nine chapters). |
| `export_cmd.js` | pass, 307 files, 80 figures. (One run under load failed "Save video: no main-thread task of 50 ms"; it passed on the re-run.) |
| `i18n_cmd.js` | 92 pass, 0 fail. |
| `mv_views_cmd.js` | pass. |

**Quality suite** (`test/regress/quality/run.sh --no-build --base-url http://localhost:9203`): 81 runs, 0 failed, 28
improved, 35 unchanged, 18 NEW; targets 259 met; RESULT PASS. Baselines and goldens unchanged (byte-compared with the
main tree).

**Node:** all `test/t_*.js` pass except `t_tour`'s two known failures (`splitOffer`, `formula-split`: v15.2 names that also
fail on the frozen v15.1). `t_constr` 138/138, `t_i18n` 19161, `t_i18n_keys`, `t_i18n_english`, `t_params`.

**Shots:** `notes/constructions-v16/shots/cm-*.png` (19): desktop pick and done, half-plane, collinear, menu, ghost, Y,
globe, Russian, dark; tablet 1024 and 768; phone More (EN, RU), a pick in progress, done; the 50-dependent scene.

## Not done / known limits

1. **50 dependents miss BUDGET60** (reported, as SPEC 3 [C3c] allows): rAF work p95 about 20 ms, frame p95 33 ms. The
   meshes of the 50 changed areas are the cost; CORE's [C3b] (skip off-screen meshes in motion) is not built. Frame
   times on this Mac are noisy: other Chrome processes ran at 50 % CPU (load average up to 19) during the session.
2. **Hover dimming in the planes** (SPEC 10: the other shapes at 30 %) is not built: hovering a row, or selecting a
   shape on touch, tints the rows of the linked shapes only.
3. **Globes**: the construction tools pick points, handles, zeros, F(z₀) and N; crossings and curves are not picked on a
   globe (Intersect asks for a crossing), and the drawing tools on a globe keep v15's globe snap without binding.
4. **The rail overflow rule** (SPEC 5.4) is built (`fitRail`: Grid and Polar grid leave first, then Freehand and Lasso)
   but not seen to trigger: at 768 × 1024 and 1024 × 768 the rail fits with the four new icons.
5. **"Draw in X to use z₀"**: images F(z₀) are offered only while Y shows the whole chain, so this chip never shows.
6. **Captions in Russian** are in the nominative (the phrase ignores the caption's case argument); a line bound to two
   points keeps v15's phrase ("the line through −2+0.5i and 2+0.5i").
7. A polygon draft's dashed segment follows the grid snap, not the ring (the clicked vertex lands on the ring).
8. CORE's [C3a] (no Y auto-fit while live) is done here for pointer drags only (shapes, handles, points, zeros); slider
   and Play frames still fit Y.
9. Not covered by `constr_cmd`: the Inspector's t field of a point on a curve (a number or a shared-number formula),
   Curve | Region and Other point in the Inspector (the ⋯ items are), Backspace, the palette entries.
10. Removing a zero shows only "1 shape is now undefined." (v15 has no toast of its own there); ⌘Z brings the zero back.

## For the merge into v15.2

- construct.js is a whole new file; inspector.js, phone.js and tour.js changes are a few lines each.
- app.js hooks are one guarded line each, named above; the larger ones are in drawPoints (the ring and helper marks)
  and the adapter `cmUiApi()` next to CORE's `cmApi()`.
- `notes/tour/INTEGRATION.md` gained two tables at its end; `test/t_tour.js` and `test/tour_cmd.js` count nine chapters.

## What's new in v16: gestures that changed (for the release notes; review regress-5)

- **A press on a zero or pole of f₁ with a drawing tool** now starts a shape bound to it (v15.1 dragged the zero). In
  Select and Point the press still drags the zero.
- **The Point tool within 6 px of a stroke** (10 px on touch) makes a point that slides on the curve, not a free point.
- **A handle dragged in Select** snaps to points and crossings within 8 px and binds on release (v15.1 snapped to the
  grid only).
- The escape: hold **Alt** to place freely (mouse); on touch, turn **Snap** off in the tools sheet. The tour's
  Constructions chapter says the same (tour.js `construct/meet`).
