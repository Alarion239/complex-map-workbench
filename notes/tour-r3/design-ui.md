# Tour r3: fewer pop-ups, especially on phones (UI design)

The user (2026-10-26): "I think the tour on phones is still very cumbersome and I don't like that you need to always
press on a pop-up to open it. In general, pop-ups I think are subotimal. Would also be nice if each of them included
some conditions for completion — then we could have just make it move on automatically, for example, 3 seconds after
the completion of the task."

This note covers how a step is shown: where the text goes, what can be read without a tap, and the controls. It does
not cover the content, the Grieg chapter or the completion rules; it only says how the UI shows them. Nothing in
`src/` was changed. The mockups are the real v16.2 build (work/xvtr/dist) in headless Chrome, with a strip injected
into the page. Screenshots are in `shots/ui-*.png`.

## 1. What a phone shows today

Phone portrait, 390 × 844. Rows from the top: header 0–56 (view switch, ⋯), X 56–724, chain bar 724–788, tool row
788–844.

| shot | step | what the user sees |
|---|---|---|
| `ui-p-x` | X: the domain | A 52 px bar at the bottom, **on top of the tool row** (Undo … More are hidden). It shows the title only. The text needs a tap. |
| `ui-p-draw` | Draw a shape | The same bar, now **at the top, on top of the view switch**, with the title and the task. |
| `ui-p-chain` | The function chain | A 269 px card at the top, over the dimmed X. |
| `ui-p-switch` (dark) | Three views | A 231 px card at the bottom, over the tool row. |
| `ui-p-patterns` | Patterns | The bar at the top, with the Display sheet below. |
| `ui-pl-x` | landscape 844 × 390 | A 320 × 223 card over the dimmed Y. |
| `ui-d-draw` | desktop 1440 | A 320 px callout beside the tool, over the dimmed Y. This works, but it moves on every step. |

So on a phone one step shows up in four forms (bar at the top, bar at the bottom, card at the top, card at the
bottom). Its place changes from step to step. When it is a bar, it hides app controls the user may need: the tool row
or the view switch. When it is a card, it covers the picture. The explanation is behind a tap in 163 of 308 phone step
views (PHONE.md §4). The engine is not at fault here: on a phone it has no free place to put a card, so every rule
it can follow ends up covering something.

## 2. Three options

### A. Always-open floating bar (today's bar, never folded)

```
┌──────────────────────────────────────┐   top or bottom edge, over the
│ ⌃ Draw a shape          5/10  ‹  Next │   header or the tool row,
│   ○ Choose Disc, then drag in X.      │   whichever is clear of the work area
└──────────────────────────────────────┘
```

The bar shows a lead line by default, and the full text is still one tap away.
- For: the smallest change (CSS and one copy field). The panes stay the same size.
- Against: it is still a pop-up. It jumps between the top and the bottom from step to step, and it hides the tool row
  or the view switch. The user's complaint stays half answered.

### B. Docked tour strip (recommended)

The step lives in a row of its own in the layout. The app makes room for it, so it covers nothing, by construction.
It stays in the same place for the whole tour.

```
phone portrait (under the header)            desktop / tablet (top of the stage, above X and Y)
┌──────────────────────────────┐             ┌─────────────────────────────────────────────────────────────┐
│ X→Y   Phase   Landscape   ⋯  │ header      │ ‹ │ Draw a shape  Basics · 5 of 10                Why ▾ │ Next │ × │
├──────────────────────────────┤             │   │ ○ Choose Disc, then drag in X.                      │      │   │
│ ‹ │ Draw a shape  5/10 │ Next │ strip 68 px └─────────────────────────────────────────────────────────────┘
│   │ ○ Choose Disc, then│      │             ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ progress (2 px) ▔▔▔▔▔▔▔▔
│   │   drag in X.       │      │
├▔▔▔▔▔▔▔▔▔▔▔▔▔▔──────────────┤ progress    phone landscape (in the header's free part, no reflow)
│                              │             ┌───────────────────────────────┬─────────────────────────┐
│  X (600 px instead of 668)   │             │ X→Y    Phase    Landscape   ⋯ │ X: the domain. Your     │Next│
│                              │             │                               │ shapes in z: pinch to … │    │
```

Mockups: `ui-m-ph-draw` (light), `ui-m-ph-draw-done` (dark, task done), `ui-m-ph-x` (a reading step),
`ui-m-ph-x-exp` (Why opened), `ui-m-ph360-ru-c3` and `-c3b` (Russian at 360), `ui-m-land-x`, `ui-m-land780-ru`,
`ui-m-desk-draw`, `ui-m-desk-y-exp` (dark, Why opened).

- For: the text can be read without a tap, and nothing covers the work area or the app's controls. It never moves.
  The spotlight still points at the exact control (v16.1), so the strip does not need to sit next to it.
- Against: the panes lose height while the tour runs. Each step needs a new short "lead" line, in English and Russian.
  The app's layout has to reserve the slot (§4).

### C. Coach chip at the control and a progress pill

```
                 ┌───────────────────────────┐
                 │ Choose Disc, then drag in X│  chip with a caret, at the lit control
                 └────────────▼──────────────┘
   [Undo][Select][Point][ (Disc) ][Polygon][More]          ( ‹  5/10  ›  × )  pill in a corner
```

Mockup: `ui-m-chip`.
- For: it is the lightest of the three, with the text right at the target.
- Against: it is still a pop-up, and it moves with the target. In the mockup the chip lands on the chain bar and the
  pill covers X's globe button. The explanations (the math) have no place. Placing the chip again means a fourth set
  of placement rules.

### Comparison

| | A. floating bar | **B. docked strip** | C. chip and pill |
|---|---|---|---|
| covers the work area | no (as today) | **never** (room is reserved) | sometimes (next to the target) |
| covers app controls | tool row or view switch | **never** | chain bar, corner buttons |
| readable without a tap | title and lead | **title and lead; the body too on large desktops** | lead only |
| position | top or bottom, by step | **fixed** | moves with the target |
| X / Y height on a phone (portrait) | 668 px | **about 600 px (−10 %)**; landscape: no change | 668 px |
| X / Y height at 1440 × 900 | 652 px | **582 (−11 %); 549 with Why open** | 652 px |
| work | small | medium | medium to large |

## 3. The pick: B, the docked strip

### Content per step

- **lead** (new): one sentence. For a task step it is the task ("Choose Disc, then drag in X."). For a reading
  step it is the one thing to see ("The strip becomes the unit disc."). Limit: 2 lines at 360 px in Russian. A cheap
  check in `t_tour.js`: English ≤ 60 characters, Russian ≤ 64. The browser audit checks that no lead is clamped.
- **body**: the explanation that exists today. It is shown under "Why" (below).
- **title**: kept. It is cut with an ellipsis if it does not fit; the full title is in the Why panel and the
  aria-label. Four Russian titles are too long for a phone strip and need a short form: Welcome (40 characters),
  Natural domain (32), It follows its points (29), Play and scrub (27).
- The **done** condition comes from the content design; the strip only shows it (below).

### Anatomy

| | phone portrait | phone landscape | tablet, desktop (≥ 768) |
|---|---|---|---|
| where | a row under the header, full width | the header's free part, right of ⋯ (360 px at 844, 296 at 780) | a row at the top of the stage, the stage's width (868 px at 1440) |
| height | 68 px, fixed (title line, 2 lead lines; the mockup measured 64 with 1 lead line, 67 with 2) | the header's 48 px (2 lead lines, no title) | 62 px; with Why open, plus the body (95 px for Y: the image) |
| reflow | X and the chain shift down 68 px | none | X and Y shift down |
| text | title 600 14/18 + count "5/10"; lead 13/17 with the task's ring | lead 13/16, title in bold at its start | title + "Basics · 5 of 10"; lead; "Why ▾" |
| buttons | ‹ Back 44, Next ≥ 64 × 44, 8 px apart | Next ≥ 64 × 44 (Back in the Why panel) | ‹ Back, Next, × End: 36 with a mouse, 44 on touch |
| progress | a 2 px accent line along the bottom edge, as wide as the share done | same | same |
| measured lead width | 250 px at 390, 214 at 360 | 271 px at 844, 201 at 780 | 678 px at 1440 |

- **Why** (the body). The text block is a button (`aria-expanded`). On a phone, a tap on it opens a panel that hangs
  under the strip, over the top of X. That is the only cover, and the user asked for it. It holds the body, the Try
  it, the chapter, × End the tour, and Back in landscape. It is at most half the screen and scrolls inside. It folds
  on a touch in the work area (the touch goes on to the app, as today), on Next or Back, or with a swipe up.
- **Why stays open once opened.** It stays open for the following steps, so a reader who wants every explanation
  taps once. The exception is a task step whose work area the panel would cover: there it folds, and "Why ▾" stays in
  the strip. On ≥ 768 it opens inline (the panes shrink while it is open). On a desktop of at least 1280 × 800 it
  starts open, since nothing is covered there. While open, the strip keeps the height of the longest body in the
  chapter at this width, so the panes do not change size from step to step. The choice is saved in the tour record.
- **The welcome step**: the strip, with "Start" as Next, instead of the centred card over a full shade.
- **The help menu, the first-run card and the spotlight**: no change. A tap on the shade now pulses the strip's lead
  line, where today it nudges the callout.

### Done and the 3-second auto-advance

- When a task is done, its ring in the lead turns into a tick. Next gets the ready ring it has today, and its
  background fills from left to right over 3 s. Then the tour moves on. With reduced motion there is no fill; the
  label counts down instead ("Next · 3", "2", "1").
- **The countdown pauses** while a finger or the mouse is down, a drag is under way, the focus is in the strip, the
  Why panel is open, a menu, the palette or a dialog is open (`appLayers`), or the page is hidden. It starts again
  from 3 s once all of these end. Back cancels it.
- The **Why panel has a switch**, "Move on by itself", on by default and saved in the tour record. This meets
  WCAG 2.2.1 (a time limit the user can turn off).
- Reading steps never move on by themselves.
- Screen readers hear "Done. Next step in 3 seconds." once, then the new step's lead.

### Keyboard and screen readers

- The strip is a `role="region"` labelled "Guided tour", not a dialog. It no longer takes the focus when a step
  changes, so the user's focus stays where they are working. If the focus was already in the strip, it stays on Next.
- In the DOM it comes right after the header, so it is the second Tab stop. ← and → work while the focus is in the
  strip. Esc behaves as today (the app's own Escape comes first).
- The polite live region reads "Basics, step 5 of 10. Draw a shape. Choose Disc, then drag in X." The body is read
  only when Why is open.
- The Next label stays "Next", "Next: Views" or "Finish". On a phone that is too narrow it becomes "Next →", as today.

### Landscape phones and tablets

- **Landscape phone**: the strip goes in the header's free part, so X and Y stay the same size. If that part is under
  260 px (a phone under about 740 px wide), the strip becomes a 48 px row under the header.
- **Tablets** (768–1279, portrait or landscape) use the stage strip with touch sizes. The Inspector, which sits under
  the chain at 768–1023, is not affected.

### Russian

- Measured at 360 px: the current Russian task for Circle through three points needs 3 lines and is clamped
  (`ui-m-ph360-ru-c3`). A short form fits in 2 (`-c3b`): «Ещё» › «По трём точкам», затем коснитесь z₀, z₁, z₂.
- Of today's tasks, only two exceed 64 Russian characters: c3 (78) and deform/range (67). Every reading step needs a
  new lead.
- Landscape at 780 px: the Russian "Draw a shape" lead takes 2 lines at 201 px (`ui-m-land780-ru`).
- New strings (leads, "Why", "Move on by itself", "Done. Next step in 3 seconds.", the short titles) go into
  `notes/i18n/ru/v164-tour.json`.

## 4. What the build must do, and the risks

**The app reserves the slot.** The tour sets `--tour-h` (≥ 768) or `--ph-tour` (phone) on `:root`, and puts the strip
in a slot the app provides. The changes:

- `.stage` gets a first row, `var(--tour-h, 0px)`.
- `#app` on a phone gets a row under the header.
- **The 8 uses of `--ph-head` in `phone.css`** need `+ var(--ph-tour, 0px)`: the split grid, the sheets' top,
  `ph-full`, and the landscape sheet.
- `phone.js` `geometry()` subtracts the slot from `--ph-hp`.

The mockup shows what goes wrong otherwise. With the row added but the split rules left unchanged
(`ui-m-ph-patterns`), the Display sheet and X overlap, and the ring sits off its target. In the steps without a
sheet, the spotlight followed the shifted panes on its own: X's hole moved from y = 56 to y = 120.

Risks:

1. **Smaller panes during the tour**: −10 % on a phone in portrait, −11 % to −16 % on a desktop. The scenes must be
   framed after the slot is reserved. The order is: reserve the slot, then `loadScene`, then fit.
2. **Resizes.** The panes resize when the tour starts and ends, and on ≥ 768 when Why is toggled. They never resize
   between steps. Each resize is one canvas reallocation and redraw. This needs a frame-time check, on the slowest
   machine first (the old Windows laptops already lag on their first draw).
3. **The tour must stay on top** (POLISH.md, the user's rule). The palette and the header menus drop from the header,
   over the strip's row. While a tour runs they should open below the strip (their top offset plus the slot), or the
   strip stays at z 36 and they are moved down. The layer pass of `tour_audit_cmd.js` covers this.
4. **Next is at the top of a phone**, out of easy thumb reach on a large screen. Task steps move on by themselves, and
   a swipe left on the strip means Next. Reading steps still need a tap up there. Putting the strip at the bottom
   instead was considered and rejected: the sheets, the keyboard and the tool row all come from the bottom, so a
   bottom strip would have to move with them.
5. **The text is no longer next to the target.** The exact spotlight carries the link. For small targets (the t
   slider, card f₁, a swatch), the ring pulses once when the step appears; with reduced motion it does not.
6. **New copy**: 44 leads in English and Russian, and 4 short titles. `t_tour.js` should check that every step has a
   lead within the limits, and that a task step's lead matches its task.
7. **Engine**: `place()`, `placeMini()` and `placeDock()` go out of use for steps. The card stays as the content of the
   Why panel on a phone. The checks in `tour_audit_cmd.js` and `tour_phone_cmd.js` change: the strip never meets the
   work area, no lead is clamped, buttons are 44 px with 8 px gaps, and the countdown pauses and runs at the right
   times.

**What a phone gains**: a step can be read with no tap, its place never changes, nothing covers the tool row or the
view switch, and task steps move on by themselves.
