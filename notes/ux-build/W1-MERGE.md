# Wave 1 merge (v16.5 UX): what merged, how, and the results

2026-10-27. Built in `work/xu1`, a fresh copy of the base `work/xv164-merged-snap`. Snapshot of the merged, tested tree:
`work/xu1-merged-snap/` (src, tools, build.py, test without `*_cdp`; `SHA256SUMS` lists its 310 files).
The five pieces' notes: `notes/ux-build/w1-{learn,chain,plane,rail,phone}-AS-BUILT.md`. The merge's own per-finding
list: `notes/ux-build/w1-merge-AS-BUILT.md`.

## How

`git merge-file -p <merged so far> <base> <piece>` file by file over `src/`, `tools/`, `build.py` and `test/`, in the
order learn, chain, plane, rail, phone; new files copied. Not merged (generated): `src/i18n_ru.js`,
`tools/ru_report.json`, `tools/ru_collisions.json` (rebuilt by `make_ru_table.py --strict`). Left out: each piece's
`test/*_cdp/`, `test/learn_scratch/`, `test/regress/export/out/`, `test/regress/quality/out/` (run output, not goldens).
`build.py` was changed by no piece.

Checks that every piece's change is in the merge:
- For every file a piece changed, its change was reverted from the merged file (`git merge-file merged piece base`);
  where that applies cleanly, the change it removes equals the piece's own change line for line. That holds for every
  file except the hand-resolved ones (below).
- For the hand-resolved files (`app.js`, `construct.js`, `page.html`, `tour.js`, `make_ru_table.py`), every line each
  piece added or removed was counted in the merged file. The only differences are the resolutions listed below and the
  merge's own fixes (next section); nothing of a piece was lost.
- Every place where two pieces changed lines within 8 lines of each other (19 in `app.js`, 10 in `construct.js`, 4 in
  `tour.js`, 1 each in `phone.css`, `page.html`, `inspector.js`, `touch_cmd.js`) was read in the merged file.

## Conflicts and how they were resolved (both intents kept)

| step | file | place | resolution |
|---|---|---|---|
| chain | app.js | X's sphere chip ("Shapes are drawn in the z-plane…") | chain's words "choose Show F to draw" + learn's listening chip with Stop (UX71) |
| chain | app.js | `chainKey` Alt+←/→ | the same key built twice (learn UX97, chain UX81): kept one, chain's `moveCard` (moves, keeps the focus); a second would never run |
| chain | app.js | `openGallery` item | chain's `ex-new` class and "New: empty canvas" for item 0 + learn's ♫ "With sound" span in `.ex-nl` |
| chain, plane, rail, phone | tools/make_ru_table.py | the v16.5 table set | one set `V165_HERE` with all five tables and the merge's (`v165-ux-merge.json`), read once after every v16.4 table |
| plane | app.js | `paneTitles` (right) | learn's "Deformation from z to w" (UX103) + plane's "Y · " tag on the four other right titles (UX27) |
| plane | app.js | `idleRight` | learn's phone target line (V01), then plane's "Draw a target in Y (the w-plane)" |
| plane | app.js | shape ⋯ | learn's `duplicateShape` and ⌘D / ⌘] / ⌘[ keys (UX97) + plane's colour names (UX95) |
| plane | app.js | `shapeEditor` end | plane's unbounded test, words and `data-unb` (UX92/95), then learn's "Listen along it" (UX72) |
| plane | app.js | `paramField` return | plane's `before` (sheet ‹, UX67) in `.pair` + chain's `worded` class and `paramWord` (UX33) |
| rail | construct.js | meet tool click | rail's test `t.cls !== 'curve' \|\| !t.ref` + plane's `pickWarn` (UX52) |
| rail | construct.js | exports | the union (rail: cancelDrag, globeSlide, globePoint, touchNow, altNow, samePick; plane: undoPick, undoPickable) |
| rail | page.html | `#snapBtn` | rail's tooltip "Snap to the grid and to figures (both panes). Hold Alt to place freely." and aria-label + plane's `<span class="snap-w">Snap</span>` (UX94) |
| phone | app.js | `integrateSelected` | chain's V03 lines (ask which curve; `integrateShape`) + phone's touch wording in the first toast (UX17) |
| phone | tour.js | Basics → The function chain, touch body and task | chain's "Show alone" (UX85: the button's one name), not phone's "Show this step alone" |

Clean merges that sit next to another piece's lines and were read: the plane/rail pointer code in `construct.js`
(`moveDrag` with rail's free/anchor/rail branches above plane's warnings; `finish` with rail's `made` and plane's
Hyperbolic sign rule; `menuItems`, `toolChanged`, the debug hook), `app.js` (`editDown`: rail's Point-tool move and
plane's `handleAt` and close radius; `updateUndo`/`restore` with chain's `exLabelSync`/`histSay` and plane's
`draftUndoable`; `loadExample` with chain's Undo toast and learn's Try line before the fit; `buildTools` with learn's
phone tile names and rail's `#railSnap` words), `tour.js` (phone's touch lines beside learn's and chain's), `inspector.js`
(chain's `hasCut`/Show alone beside phone's zeros-and-poles hint), `phone.css` (phone's sheet-head Undo beside plane's
Snap switch).

## What the merge itself added (asked for by the pieces' notes, or found when the pieces met)

1. `construct.js` "{x} needs distinct points" (click, globeClick) through `pickWarn`: plane's UX52 on the rail
   piece's lines (plane AS-BUILT, "For the merge").
2. `construct.js` refusals in touch words (phone UX17's leftover on plane's lines): "Tap a line or a circle.", "Tap a
   crossing of two curves, or a curve.", "Tap a point off/on {c}." when `chipTouch()`; "Click …" with a mouse.
3. `app.js` `snapZ`: the finger test uses plane's `ptrTouch` (the press's pointer) before `Construct.touchNow()` (rail
   AS-BUILT asks for it).
4. `app.js` card ⋯: Move left / Move right show `Alt ←` / `Alt →` (learn AS-BUILT asks for it); none on touch.
5. `app.js` `modK` (⌘D, ⌘], ⌘[ in a shape's ⋯) is empty on a touch screen (phone UX17: touch words name no keys).
6. `app.js` phone guide (`GUIDE_TOUCH`, Function chain): "<b>Show alone</b> button" (chain AS-BUILT asks for it; UX85).
7. `app.js` `buildTools`: a Russian phone tile short form for plane's new Hyperbolic tool, «Гиперб.» (learn's UX93 rule:
   one line, no hyphen; before it read «Гиперболическая», wider than its 58 px tile).
8. `app.js` `fitTitle` + `page.html` `.pane-title.notag`: found in the browser. With the chain empty at 1366 × 768,
   Y's head holds learn's Add function (UX20), plane's worded Plane | Sphere (UX37) and plane's "Y · " tag (UX27): the
   tagged title no longer fitted and vanished (the pane went `tiny`; learn's ux165 check "UX20 laptop … not tiny" would
   fail). Now the note gives way first, then the tag, then the title: it reads "w = z".
9. `app.js` `nudgeShape` (learn UX97, the arrows move a shape "one step of the drawn grid"): uses rail's
   `Constr.gridStep`, the drawn grid with its halves (T9), as snapping does.
10. `notes/tour/INTEGRATION.md`: a section "Step fields and API added in v16.5 wave 1" (phone's `titleTouch`,
    `leadTouch`, `touchByScene`, chapter `desk`; learn's lane `Tour.lane` / `laneHide` / `laneId`; chain's quiet
    `step-focused`). Learn's `leftOpts` anchor line was already there. Plane and rail ask for nothing.
11. Russian: `notes/i18n/ru/v165-ux-merge.json` (6 entries: the guide paragraph, the four Tap refusals, «Гиперб.»).
12. Tests: `test/t_ux165_learn.js` reads the one `V165_HERE` set (it expected a set of the learn table alone); new
    `test/t_ux165_merge.js` (41 checks, every resolution above), `test/ux165_merge_cmd.js` (the look below) and
    `test/ux165_merge_shots_cmd.js` (before/after pictures).

Not changed, noted: the five tables each carry the same stopgap for the older Help "Deformation" paragraph (keys
`help.deformation.*`, `snap.help_deformation`); four have the snapshot's Russian, phone's has «или» for «и» in one
place. Read in name order, rail's (the snapshot's) wins. Drop all five when the release's `app.js` (`work/xv1641`) is
merged.

## Russian

`python3 tools/make_ru_table.py --strict`: 2726 entries, 2006 call sites, 0 unresolved (collisions 15, as each piece and
the base). One registration line (`tools/make_ru_table.py`):
`V165_HERE = {'v165-ux-learn.json', 'v165-ux-chain.json', 'v165-ux-plane.json', 'v165-ux-rail.json', 'v165-ux-phone.json', 'v165-ux-merge.json'}`.

## Unit tests (2026-10-27, on the final tree; no browser suite, GLSL, quality or timing run, per the user's rule)

`python3 build.py`: built; the published page has no test hook (`__cmw`, TEMP-DEBUG-HOOK, `__tourApi`: 0).
`node test/t_*.js`, 41 files: **41 pass, 0 fail**. Among them: t_tour 1742/1742 (the `leftOpts` failure the pieces
expected is gone), t_tour_engine 11/11, t_ux165_learn 109/109, t_ux165_chain 39/39, t_ux165_plane 23/23,
t_ux165_rail 321/321, t_ux165_phone 18/18, t_ux165_merge 41/41, t_constr 288/288, t_i18n 23458, t_i18n_keys 6270
(2006 keys), t_i18n_english 977 outputs byte-identical, t_i18n_parse 42254, t_sound 151/151, t_seasong 66/66,
t_inverse 554, t_sheets_deform 42479, t_zp 160.

## The look (headless Chrome 156, port 9886, one browser; not a suite)

`test/ux165_merge_cmd.js` on the final build: 15 of 15, no exception or console error. Laptop 1366 × 768 light and dark,
English and Russian: loads; Y's head "Y · w = F(z) image" whole; Snap with its word and rail's tooltip; a card's ⋯
(right click) shows Alt ← / Alt →; one Alt+→ moves a step one place and keeps the focus; Examples: "New: empty canvas"
first, ♫ on the Mountain King; the user's case: Perpendicular circle on the shown unit circle with two picks on it
makes the circle, a press on the first pick is refused at the pointer and in the chip, no toast. Phone 412 × 860
(Android, real touch) light and dark, English and Russian: one screen, no page scroll; two taps on the unit circle make
the circle; a refused pick says "Tap a line or a circle."; the Russian More tools: every tile whole on one line,
«Гиперб.». Pictures: `notes/ux-build/shots/w1-merge/` (`L*`, `P*`; before/after of the merge's visible fixes:
`title-*`, `keys-*`, `tap-*`, `tile-*-ru`, light and dark; "before" is the merged tree without the merge's own fixes,
built once for the pictures and deleted). Clean-up: daemon and server stopped, the Chrome profile (and its Caches
mirror) deleted.

## Goldens and perf

None changed, none affected, by any piece (each AS-BUILT says so; the quality suite reads `#canvasR` only) or by the
merge (pane-head DOM, tool tiles, chip words, menu keys; nothing drawn into a plane; nothing per frame). No perf
baseline, golden image or `test/regress/accepted.json` touched.

## For CI and the reviewer

- Run on the merged build what the user leaves to CI: every `test/ux165_*_cmd.js` and the browser suites the pieces
  changed (constr, perp, touch, sound, tour, tour_auto, tour_audit, deform_range, deform_nat, mv_views, seasong, split,
  fix152, v15_desktop). Untested together until then: rail's selected-glider drag starting from plane's `handleAt`
  (rail asks for `ux165_rail_cmd.js` after the merge; it must run before any other tapping suite, or on a fresh
  daemon); learn's ux165 "UX20 … Add function … not tiny" (passes only with merge fix 8).
- `split_cmd.js` "tour: the offer shows only at its stop" fails on the base too (its `.tour-card h2` selector; the
  pieces found it).
- "needs distinct points" now shows twice at a press on an earlier pick: rail's warn ring label by the pointer and
  plane's chip line (UX52). Both are "by the pointer"; one could go.
- With the chain empty at 1366 × 768 Y's title is "w = z" without its tag and role (merge fix 8). Wave 2's D4/D10
  (Display ▾, the mode chip) redo that head.
- A shape's ⋯ on the phone still shows "⌫" by Delete (the base's); only ⌘/Ctrl keys were removed there.
- On Android: Back (phone UX12) and the keyboard (UX69), as the phone piece asks.
