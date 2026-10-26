# Inside C only (v16.4): merge notes

Frozen 2026-10-26 from `work/xvhs` into **`work/xvhs-final-snap/`** (`src/`, `tools/`, `build.py`, `test/` without the
`*_cdp` folders; `SHA256SUMS` covers src, tools and build.py). Base: `notes/v16.3-candidate`. What it does: `AS-BUILT.md`.

## This round

**Fixed: verify-1** (English captions). The closing comma after a hyperbolic line's phrase now goes before the English
"and", as it already did before punctuation. The comma made a meet of two lines read as two list items. Russian is
unchanged («…, и~…»). The comma stays before "in the $z$-plane". Two lines changed: `src/app.js` `pcTidy` and
`src/figure.js` `pcOut` (the regex `[,.;:()]` became `(?:[,.;:()]|and\b)`).
English article caption now: "…and the intersection $z_3$ of the hyperbolic line through $z_0$ and $z_1$ in the domain
$|z|<1$ and the hyperbolic line through $z_1$ and $z_2$ in the domain $|z|<1$, in the $z$-plane."
New check: `test/perp_cmd.js` J8 (EN article, EN on-screen, RU).

**Not done:**
- verify-2: the "Between z₀ and z₁" segment (no tails on a triangle). This is the SPEC 12 question for the user, not a
  bug. Ask it before v16.4 ships.
- verify-3: the repeated "in the domain |z|<1" in a triangle's caption. Optional (ledger).
- verify-4: homework letters vs z₀ in construction phrases. Already in v16.3; for the backlog.

## Checks (final build)

| check | result |
|---|---|
| build twice | same bytes. `complex-map-workbench.html` 3,925,323 bytes, sha256 `a8c0b337aca2953c1612bfe68b33d750702e778f7b37797e61bdcd80ebb1674a`; `test.html` `1c03ee58ae897ba8929d33c3f86ff62d23898216427aac1830568aa5d1479f77` |
| published file | no `__cmw`, localhost, 127.0.0.1, machine paths or e-mail addresses |
| `node test/t_*.js` | 34 of 34 exit 0; t_constr 288/288 (G 37/37) (`evidence/final-node_tests.txt`) |
| `make_ru_table.py --strict` | 2398 entries, 0 unresolved; `src/i18n_ru.js` unchanged by the run (no new strings) |
| perp_cmd J (port 9866) | 10/10 with J8, no console errors (`evidence/final-perp_cmd_J.json`) |
| perp_cmd E | 5/5 (export captions EN and RU) |

Not re-run after this two-line caption fix: perp_cmd A–I, the quality suite and BUDGET60. Their results are in
`AS-BUILT.md`. Baselines, `accepted.json` and the golden images were not touched.

## Files v16.4 changes (against v16.3)

- `src/constr.js`, `src/construct.js`, `src/app.js`, `src/figure.js`, `src/region.js`.
- `src/i18n_ru.js`: regenerated. After merging, run `tools/make_ru_table.py --strict` again; it reads
  `notes/i18n/ru/v164-segments.json` (`V164_SEG_HERE` in `tools/make_ru_table.py`). `tools/ru_report.json` is generated too.
- Tests: `test/t_constr.js` (section G), `test/constr_seg_tests.js` (new), `test/perp_cmd.js` (sections I and J).
- `build.py`: unchanged.

## Merging with the main tree (v16.3.1, still in progress)

A trial 3-way merge (base v16.3, main `src/` as of now, this snapshot):

- `app.js`, `constr.js`: merge cleanly.
- `construct.js`: **2 conflicts, both in `syncChip`**. Keep both changes:
  1. the `sig` line: v16.3.1's ends in `|${pw}`, v16.4 adds `${segMode}`. Use
     `` `${txt}|${tool}|${fillMode}|${segMode}|${I18N.lang}|${chipTouch()}|${narrow}|${pw}` ``.
  2. after the × button: first v16.3.1's "Esc cancels" block (it picks the text), then v16.4's
     `if (segBox && !chipTouch() && plot) …` block. That block measures the chip after its text is set and switches to
     icons when the words do not fit.
  After merging, re-run perp_cmd C, D, I and J (the chip), fix163_cmd and touch_cmd. v16.4's J6 expects
  "Point 1 of 2 · Orthogonal · Esc cancels" with words at 1440. If v16.3.1 drops "Esc cancels" when the text wraps,
  J6 may need its text loosened.
- Tests: `test/touch_cmd.js`, `test/fix163_cmd.js`, `test/t_tour.js` and `test/constr_perp_tests.js` in the snapshot
  are v16.3's, the same as `work/xv163`. Take the main tree's versions. `test/perp_cmd.js` needs both main's section C
  change and v16.4's sections I and J.
- `test/regress/export/out/*` and `test/regress/perf/results/paired-latest*.json` in the snapshot are run outputs.
  Do not merge them.

Cleanup done: the server on 9866 and this round's Chrome are stopped, and its harness copy and profile are deleted.
