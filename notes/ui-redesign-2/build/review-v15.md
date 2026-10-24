# v15 review round: the 60 findings (work/xva), as built

Findings: `../review-v15-{design,math,regress,russian}.json`. Ledger, one entry per finding: `../ledger-v15.json`.
Built on the merged v15 (desktop, plane menu, shared numbers, phone). Edits stay small and in place, for the 3-way merge
with v14's fixes. New code is in the v15 files (`inspector.js`, `phone.js`, `params.js`, `planemenu.js`, `desk.css`,
`phone.css`); `app.js` changes are local.

## What changed

**The chain and the Inspector (desktop)**
- Card actions (Bypass, ⋯) sit on the picture's top-right corner; the name keeps its width.
- The playing step's card has the accent outline; a held card hides its *t* label.
- One tab stop for the chain (roving tabindex). The listbox is an empty owner element (`#chainListbox`) that owns only
  the options (region card, step cards, F) through `aria-owns`, so the Add tile is its own tab stop outside it.
  Connectors are `aria-hidden`; their + and the card actions leave the tab order. The step ⋯ menu has "Insert a
  function after it".
- Clear chain is under a ⋯ in the chain head.
- Every zero and pole row has its Argand button, named by the indexed symbol (ζ₁, *p*₁, *a*₃).
- A formula too wide for its well: *F* is written in terms of the last *w* (with the *w* list under it), a step drops its
  generic form; then the formula is scaled down to 70 % at most. Decided once per formula (`fitPick`), so drag frames
  force no layout.
- A step's formula keeps its shared numbers as names: (*w*₁ − 1)/(*a w*₁ + 1) (`namedTex`: the step is built again with
  sentinel numbers, which are then replaced by each field's TeX; it falls back to the values when a sentinel does not
  come through). The first version printed "[object Object]" (`Expr.toTex` returns `{s, p}`); fixed in the second pass.
- The temporary Inspector is titled Inspector. With X and Y side by side it docks for the time it is open (the stage
  gives up 296 px), so it never covers Y. `#propsPanel` is a region named Inspector.
- The zeros-and-poles hint by input: "Or long-press a plane…" on touch.
- At 768 to 1023 the zero rows fill the left column, the poles the right.
- A degenerate Möbius step (ad − bc = 0) has no pole mark; the Inspector says it is constant and −d/c is removable.

**Math**
- Deformation, All at once: card *k* shows the deformation up to step *k* (map mode 3, a = 0, b = *k*), so the last card
  equals the main plane at every *t*.
- A bound field out of range (r ≤ 0, a count outside 1 to 60) or with no value makes its shape undefined: hidden by
  that rule, its row says why ("r = a = −0.3: a radius must be positive"), back when the value is valid again.
- Opening a state, a link, a scene, or undoing recomputes the numbers by formula and the bound fields (`bindsAll`).
- Plane menu: the "also at" line for poles too; sin and cos; "every point maps here" after a constant step; "counted
  with multiplicity"; "F there: 1 (f₂ follows)" when steps follow; stored values at 15 significant digits; the head
  prints no rounding residue and at most 6 decimals.
- Y's fit frames a point image ±1 around it (the old floor never fired). The left readout prints 0 for a component
  below a billionth of X's pixel.
- Links and scenes carry the Landscape camera (relative to its fit) and the deformation's *t* (`figCam`, `figMorph`,
  applied once at load, never saved).
- New points are labelled *z*₀, *z*₁, …

**Phone**
- Full height: the chain bar rides up to the sheet's top edge, under the header.
- A grabber tap resizes on its click, so the field under the finger gets no focus (and a 400 ms guard).
- The F tile shows F and the lamp dot only.
- The Editor has one head (a thin grabber bar; × at the right of the Inspector's head).
- Numbers opens Parameters alone, headed Numbers.
- With a sheet open, the small planes keep their title chips only; Y's chip reads *w*.
- A language switch reopens the sheet that was open.

**Parameters**: one add control (+ Number), Play after the value field, U+2212 in the range ends, the slider's label
and idle fields. A Cyrillic look-alike name reads as its Latin letter; another Cyrillic letter names the letter and the
layout. A rebuilt Inspector destroys its old Parameters mount; detached mounts are never drawn.

**Panels**: a panel the one-dock rule closes (1024 to 1279) no longer changes the saved choice; at 1280 and up both
panels follow it again.

**Russian** (`notes/i18n/ru/v15-review.json`, 28 entries; in-place fixes in `v15-desktop`, `v15-planemenu`,
`v15-params`, `v15-tour`): «Дробно-линейная» on the card; «Выделить: %{name}»; «нуль функции f₂»; the F tile's short
words («Аналитична», «Рациональна», «Дробно-линейна» …) in their own centred layout; syllable hyphenation of card names;
«все z, для которых:»; domain conditions' words in the interface type; the card names «Гиперб. синус»,
«Гиперб. косинус», «Гиперб. тангенс» (the full «Гиперболический …» needed three lines); the integral items quote the
shape's name («по кривой «Прямая 1»»); «+ Число» with a no-break space; «Дважды
щёлкните карточку»; «помечены номером шага»; the rail label «Инструменты»; the Russian plane subtitle hides below
1100 px. Table: `tools/make_ru_table.py`, unresolved 0.

**English**: the guide's plane-menu paragraph and Guarantees, the tour's zero and guarantees steps, "= {v}, from {x}",
"Unlink from the formula", "Edit the selection", one pattern for the add/remove messages.

**Tour**: a callout meant to sit below the planes that is short of room tries a wider, shorter card (440, 520, then
600 px). The Phase portrait callout now sits under the planes at 1440 × 900 (600 × 183 px, y 705).

## Tests

- `test/v15_desktop_cmd.js`: updated for the intended changes (the docked temporary Inspector, × after the Argand
  button, «Дробно-линейная», «Аналитична»).
- `test/v15_planemenu_cmd.js`: the touch pan presses clear of the phone's inset (regress-2); a pole is stored at 15
  significant digits; «нуль функции».
- `test/zp_cmd.js`: runs at the shipped geometry; its truth leaves out 16 px ruler bands (regress-3).
- Ports of `v15_desktop_cmd`, `v15_planemenu_cmd` and the default of `v15_phone_cmd` come from the daemon's `cdpd.js`.
- `test/i18n_scan.js` allows F1–F12; `test/i18n_walk_cmd.js` also walks the Inspector, F, Parameters, the plane menu
  and the phone sheets.
- Results: see the end of this file.

## Second pass (resumed after the first fixer stopped)

- Reviewed every edit of the first pass against the code and the browser.
- Fixed: `namedTex` printed "[object Object]" in every named formula; the chain listbox (aria-owns); the tour callout
  (regress-4); the long Russian card names cut by the two-line clamp; the quoted shape name in the integral items;
  the left readout's |z| and arg, which still showed 7.11×10⁻¹⁵ and 90° next to z = 0.0000 + 0.0000i.
- The Russian table was regenerated with `tools/make_ru_table.py --strict` (unresolved 0). It now also holds 4
  unused entries from `notes/i18n/ru/v15-sound-defaults.json`, which another build added at 18:56; they change nothing.

## Results (second pass, work/xva, port 8981)

- Acceptance: v15_desktop_cmd, v15_planemenu_cmd, v15_params_cmd, v15_phone_cmd, zp_cmd, v15_merge_cmd and
  mv_views_cmd pass; tour_cmd 94 of 94; i18n_cmd 95 of 95; the extended i18n_walk_cmd at 1440: n = 0.
- Quality suite: 81 runs, 0 failed (28 improved, 35 unchanged, 18 new); compare.py PASS. No baseline, golden or
  accepted.json was changed.
- Node tests: all pass except t_sound (64 of 66, regress-8, fixed by the merge).

## Left

- design-16: the formula stays in its well at 768 (not on the head row).
- design-17: zero and pole fields keep their typed text (no typographic minus or spaced +).
- regress-5: ubfix_cmd.js still has 21 stale checks.
- regress-6, regress-8, regress-9: after the v14 merge or at the gate (see the ledger).
