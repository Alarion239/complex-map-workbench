# Wave 1 (v16.5 UX) for the next merge

2026-10-27. **Base:** `work/xv164-merged-snap`. **Theirs (wave 1, merged and fixed):** `work/xu1-final-snap/` (src, tools,
build.py, test without `*_cdp`; `SHA256SUMS`). It is the wave 1 merge (`work/xu1-merged-snap`, notes/ux-build/W1-MERGE.md)
plus the fix round of the three reviews (notes/ux-build/w1-fix-AS-BUILT.md; ledger notes/ux-build/w1-ledger.json).
The next merge is v16.5 = merge(base `work/xv164-merged-snap`, ours `notes/v16.4.1-candidate`, theirs
`work/xu1-final-snap`).

## Files the fix round changed (against `work/xu1-merged-snap`)

`src/app.js`, `src/construct.js`, `src/constr.js`, `src/params.js`, `src/page.html`, `src/desk.css`,
`tools/make_ru_table.py` (one set `V165_FIX_HERE = {'v165-ux-fix.json'}`, read after `V165_HERE`); generated:
`src/i18n_ru.js`, `tools/ru_report.json`, `tools/ru_collisions.json` (rebuild with `make_ru_table.py --strict`, never
merge them). New: `test/t_ux165_fix.js`, `test/ux165_fix_cmd.js`, `notes/i18n/ru/v165-ux-fix.json`.

## What changed per finding (one line each; details in the AS-BUILT)

- rail-1 `construct.js snapAt`: the unit circle wins an axis tie (4 px, 6 px finger); no unit-circle × axis crossing target.
- rail-2 `constr.js angleDetent, latticeDetentR` (new exports) + `construct.js detentAt`: detent step by zoom, ≤ 40 % of a rail.
- rail-3 `construct.js detentAt`: no detent at a co-argument's position (`o.self`, `avoid`).
- rail-4 `construct.js shapeLabel, row` (+ export `fixedName`), `app.js rowName, shapeNames, buildShapeList`: "the unit circle" etc., no number.
- rail-5 `construct.js globeCurveAt, globeClick`, `app.js` adapter `globePick` (`hit`): globe picks on curves are gliders.
- rail-6 `construct.js pointDown, moveUp`, `app.js editDown` (`cmTell`): the Snap-off tip at a still tap's release.
- rail-7 `construct.js pickOk` and its callers, `hover`, `setRing(…, true)`: the refusal clears; one message.
- rail-8 `construct.js chipTool`: the refusal uses the chip's tool word.
- rail-9 `construct.js syncChip` (`cm-low`): a desktop chip moves to the plane's foot, away from the picks (interim, D10).
- user-1 `params.js syncUnused`, `app.js chainChanged, selectStep`: "Not used yet" follows the chain.
- user-2 `construct.js snapAt` (`cR`), `detentAt` (`place`): curve beats grid within the grid radius; placement window halved.
- user-3 `app.js patternCell` (regions only), `stageSamples` (no construction curves/points, no fixed curves).
- user-4 `page.html` `.chip.readout:has(> .rteach)`; Russian «Удерживайте палец — F(z)» (v165-ux-fix.json wins over v165-ux-plane.json).
- user-5 `params.js` CSS `.prm-list { flex: 0 1 auto }`.
- user-6 `construct.js chipText`: "Pick a point (on {c} or anywhere)".
- user-7 no change.
- regress-1 `app.js morphReadout(short)`, `syncTransport`, transport build: padded %, short form when tight.
- regress-2 `app.js`: ResizeObserver on #plotL, #plotR, .pipe-wrap re-places a toast.
- regress-3 `app.js placeToasts`, `desk.css [data-placed="head"]`: desktop messages in the chain head gap when they fit.
- regress-4 `app.js probeTeach`: once a session, 8 s.
- regress-5 `app.js sndPieceHint, sndListenShape, sndPlayEnded`: the Try line leaves when the melody ends.
- regress-6 `app.js setReadouts` (`wOnce`); the rest named for CI.
- regress-7 `app.js updateUndo` (`undoKey`), `targetNote` (`targetNoteKey`).
- regress-8 `app.js mfNogo`: rectangles only over the plane.
- regress-9 `app.js setupTooltips`: tips on Tab/arrow focus (:focus-visible).
- regress-10 `app.js shapeNames(list)`, `histWhat`: names from the step's snapshot.

## Where it touches what the release (`work/xv1641`, ours) may also have changed

`app.js` (tooltips block, toasts, transport readout, shape list, Numbers hooks), `params.js` (render), `page.html`
(readout chip CSS). The five tables' stopgap for the Help "Deformation" paragraph (W1-MERGE.md) still applies; the fix
table adds no Help keys.

## Needs the user's consent

- [CONSENTED 2026-10-27 by the user: keep in chain header] regress-3: a placement instead of removing messages (the review said ask the user). Desktop messages now sit in the
  chain head; the phone's still sit above the chain bar over the plane until wave 2 D3.
- [CONSENTED 2026-10-27 by the user: ship it] regress-8: the deformation's paths differ from v16.4 because UX20 moved the legend off the plane (no pick changed in
  this round). Pictures: `notes/ux-build/shots/w1-fix/regress8-deform-paths-v164.png` and `…-after.png`.
- No golden image, perf baseline or `test/regress/accepted.json` changed. The quality scenes pin Y's view and have no
  constructions, so user-3's Y-fit change moves none of them.

## For CI (the user runs the browser, GLSL, quality and perf suites there)

- Run `test/ux165_fix_cmd.js` with the other `ux165_*_cmd.js` and the suites W1-MERGE.md lists. Tests that may read the
  old behaviour: anything expecting 15° detents at the default zoom (`ux165_rail_cmd.js`, `constr_*`/`perp_cmd.js`
  sliding checks), "Circle 1" for the unit circle made a shape, the "Opened …"/"Added …"/"Undid …" toast above the chain
  on a desktop, the probe line on the phone's chip, the Try line hiding at Listen (`seasong_cmd.js` re-reads the spiral,
  so it should pass).
- Perf gate (regress-6): Point and Orthogonal hover over a Line grid plus circles; Snap-on disc drag there; glider slide
  round the unit circle; X probe hover in X → Y.
