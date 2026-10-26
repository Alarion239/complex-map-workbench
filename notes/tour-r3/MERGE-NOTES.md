# Tour r3 (v16.4): merge notes (into v16.2)

Snapshot: `work/xvtr-final-snap/` (src/, tools/, build.py, test/ without the `*_cdp` folders), frozen 2026-10-26.
It builds to the same bytes as `work/xvtr/dist` (published file sha256 `9a509f15…`, see `SNAP-SHA256` there).
Base: `notes/v16.2-candidate`. What the round is: `notes/tour-r3/AS-BUILT.md` (with its review fixes),
`ledger.json`, `review-verify.json` (the 2 findings fixed below).

## Last fixes (from review-verify.json)

1. **verify-1, the countdown bar was hidden by the ready ring.** While the 3 s run, Next's ring now leaves out its
   bottom edge (`.ts-next.ready.counting`: inset top, left and right only), so the bar below is that edge, filling in.
   Measured in headless Chrome (basics/x, a pan, then 1.5 s): filled part 3 px of bar on a desktop (light and dark),
   4 px on a phone; unfilled part 0 px. With reduced motion there is no bar and the ring stays whole.
2. **verify-2, no × on a landscape phone.** × End (44 px) now shows in the 48 px row under the header, always. In the
   header it shows when the header has 52 px more than the strip's 260 (`.ts-xok`), and only while the chapter's line
   still fits two lines with it; otherwise it stays in Why, and the strip keeps the header (X keeps its size, as
   designed). Measured: 844 × 390 EN, basics and construct stay in the header without ×, views has ×; RU and 780 × 360
   use the row with ×; 915 × 412 has × in the header. A tap on × ends the tour. Back stays in Why.
   `tour_phone_cmd.js` checks this on every landscape step.

## Files that differ from base

| file | what |
|---|---|
| `src/tour.js` | the whole round (strip, countdown, Sound chapter; see AS-BUILT "Files") |
| `src/app.js` | the tour adapter: `slot`, `sceneSpec`, `listen`, `sound*`, `has('song')`, `tourSetLook` keys, the new events |
| `src/inspector.js` | 1 line: `tex-copied` from F's copy button (base 417) |
| `src/phone.js` | `geometry()` less `--ph-tour` (base 341); `Phone.geometry()` exported (after base 520) |
| `src/page.html`, `src/desk.css` | `#tourSlot` as the stage's first child with row `var(--tour-h, 0px)`; `#tourHeadSlot` in the header |
| `src/phone.css` | `--ph-tour` in the split rows and the sheets' tops; the header slot |
| `src/i18n_ru.js` | generated: regenerate after the merge, do not hand-merge |
| `tools/make_ru_table.py` | `V164_HERE = {'v164-tour.json'}` and its glob, read last |
| `tools/ru_report.json` | generated |
| `test/t_tour.js`, `t_tour_engine.js`, `tour_cmd.js`, `tour_lit_cmd.js`, `tour_audit_cmd.js`, `tour_phone_cmd.js` | changed for the strip |
| `test/tour_auto_cmd.js`, `tour_perf_cmd.js`, `tour_audit_spot.js` | new |

`build.py` is the base's. Take only the tour tests above from the snapshot: its `test/constr_cmd.js` and
`test/t_constr.js` are older than the root `test/` ones (another round changed those), so keep the root's.

## Merge steps

1. Copy the files above. Paste `notes/tour-r3/INTEGRATION-v164.md` into `notes/tour/INTEGRATION.md` as section 9
   (`t_tour.js` reads both files as one; after pasting it still passes).
2. `tools/make_ru_table.py` meets `work/xv163` on the same line (the table glob). Keep both: `V163_HERE` and its glob,
   then `V164_HERE` and its glob, v164 last. Then `python3 tools/make_ru_table.py --strict` (0 unresolved) and rebuild.
3. `src/app.js` and `src/inspector.js` are also changed by `work/xv163` / `work/xvls`; the tour's changes are the
   adapter and its event calls, which add lines rather than change shared ones. Check by hand where they meet.
4. Russian: `notes/i18n/ru/v164-tour.json` (81 strings). These two fixes added no strings.

## Checks run on the final sources

- Node: all 34 `test/t_*.js` pass (`t_tour.js` 1715/1715, `t_tour_engine.js` 11/11, i18n, sound, sea song, the rest).
- `make_ru_table.py --strict`: 0 unresolved.
- Built twice: same bytes. The published page has no test hooks (`build.py`'s `__cmw` assert), no machine paths,
  no e-mail addresses, no localhost.
- Headless Chrome (`test/fin_cdp`, port 9839): the bar measurement above (1440 and 390, light and dark), the landscape
  check above (844 × 390, 780 × 360 and 915 × 412, EN and RU), and a start of `tour_phone_cmd.js` (with the new landscape × check), which did not finish inside the time box
  and was stopped: rerun it once after the merge (`test/<you>_cdp/q.sh test/tour_phone_cmd.js`).

## Open points (unchanged from AS-BUILT)

- `views/key` is skipped on a landscape phone (as since v15).
- Not checked on the Android phone itself.
