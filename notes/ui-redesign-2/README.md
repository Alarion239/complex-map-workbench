# Function chain, guarantees, phone, shared numbers: the redesign (revision 2)

Your backlog items 16–19 (2026-10-22). Design and research only: no app code changed. This is revision 2: it answers
all 50 findings of two reviews (`review-design.json`, `review-users.json`). The details are in `desktop/DESIGN.md`,
`desktop/INTERFACE.md`, `phone/DESIGN.md` and `constructions/DESIGN.md`. Each changed rule names its finding there.

## What changes and why

**Chain cards** (item 16: "the type is enough", pictures that match the view)
- A card is its type and a picture. No formula, no fields, no property strip. The chain is 188 px instead of 272.
- The type name can take two lines, so it is never cut. Measured in English and Russian at 768, 1024, 1280 and 1440.
- Pictures follow the open view, and **card k always shows the map up to step k**. In Phase it is arg *F*ₖ over the
  same window as the main plane, so the last card matches the main picture. Landscape is the same with log|*F*ₖ|,
  without axes or labels.
- Cards are drawn exactly, in the same frame as the main view. The cache of approximate frames is gone.

**Editing: the right panel becomes the Inspector** (items 16, 18)
- Clicking a card selects it, and the Inspector edits it with roomy controls. "Show alone" is a separate choice.
- A step's own coefficients carry its index (*a*₂, *b*₂…). A plain *a* always means the shared number.
- With the panel hidden, the editor slides in over the stage's right edge, never over the picture.

**Zeros and poles** (item 16: big buttons, right-click on the map)
- **Add zero** and **Add pole** are large buttons. They no longer switch to "shown alone".
- Right-click on X (long-press on a phone) gives **Add zero of f₃ here**. The zero goes to *w*₂ = *F*₂(*z*), so the
  point you clicked becomes a zero of *F*. A short line says where else it appears ("also at *z* + 2π*ik*" after exp).
- New marks snap to the ruler (hold Alt for free placement). On a phone you remove a mark with its ×, not by dragging.

**Guarantees** (item 17: too much space)
- The Guarantees panel goes. *F* gets one small tile at the end of the chain, showing *F* and the lit property
  ("Analytic").
- Clicking the tile shows the full formula of *F*, the guarantees in two lines, the domain, and a folded step table.

**Phone** (item 19: too many elements and menus)
- One screen and no page scroll: the view switch (X → Y · Phase · Landscape), one plane with the other as a live
  inset, the chain bar, and a tool row with **Undo** where the thumb is.
- Everything else opens as one bottom sheet. **While a sheet is open, X and Y sit side by side above it**, so you see
  the image change while you edit.
- 22 controls on the main screen, every one at least 44 px. The mockup has no smaller targets: the audit found
  0 of 634 (two menu separators are counted but are not controls).

**Shared numbers and constructions** (item 18): see the plan below.

## Screenshots to open

| Area | Before (v14 in progress) | After (revision 2, light and dark) |
|---|---|---|
| Desktop 1440 | `desktop/shots/before-1440-xy.png`, `before-1440-phase.png` | `desktop/shots/after-f1-xy-1440-*.png` (right-click on X), `after-f2-phase-1440-*.png` (F selected) |
| Desktop, no panel | — | `desktop/shots/after-f3-land-1440-nopanel-*.png` |
| Deformation | `desktop/shots/before-1440-xy-deform.png` | `desktop/shots/after-f4-def-1440-*.png` |
| Tablet | `desktop/shots/before-1024-xy.png`, `before-768-xy.png` | `desktop/shots/after-f5-xy-1024-*.png`, `after-f6-xy-768-*.png` |
| Russian | `phone/shots/before/360_ru_light_xy_screen.png` | `desktop/shots/after-ru-*.png`, `phone/shots/after/ru360.png` |
| Phone | `phone/shots/before/390_light_xy_full.png` (the 3111 px page), `390_light_chain_zp.png` | `phone/shots/after/home-x.png`, `zp.png`, `ctx.png`, `nums.png`, `construct.png` (14 screens) |
| Constructions | — | `constructions/shots/01-light-default.png`, `03-…`, `04-…` |

Interactive pages: `desktop/mockup.html`, `phone/mockup.html` and `constructions/poc/demo.html` (drag the points).

## Constructions and shared numbers: the plan

**What it does**
- **Shared numbers.** Type `Re z = a` in any field, and a slider *a* appears under Parameters. Every field accepts
  formulas in these names: step parameters, shape fields, zeros and poles. Change *a* once, and everything that uses
  it moves.
- **Constructions.** Points, lines through points, circles through three points, intersections, midpoints, bisectors
  and points on curves. They are ordinary shapes, so all views, the globes, the deformation and export work with them
  unchanged.
- **Exact.** Three points built on one line give exactly a line, never a huge circle. Intersections and points on
  curves stay continuous when a circle passes through the line case. Parallel lines meet at ∞. The proof of concept
  has 66 + 18 tests, all passing.
- **Handing it out.** Copy link puts the whole figure in a URL. Save scene and Open scene use a file.

**How it looks**
- Parameters: rows in the lower half of the Inspector.
- Constructions: rows in the Shapes list ("circle through *P*, *Q*, *R*").
- Two new tools, Circle (3 points) and Intersect. Midpoint, Bisector and Point on curve go under More.
- The Line tool snaps to points, so "line through 2 points" needs no tool of its own.
- The tool set is the same on desktop and phone.

**Effort and order**
1. **Shared numbers, links and scene files.** About one round, the size of the zeros-and-poles round.
2. **Constructions.** About 1.5 rounds. This includes the exact `gcircle` shape for the CPU and GPU renderers, exact
   Apollonian and Steiner circles, and the label placer.
3. **Families and polish.** About one round: *k* = [−2 … 2] lists, play modes, and a worker for traced equations.

All of this comes after v14 is gated and after the panel redesign, which frees the right panel.

## Questions for you (each with my recommendation)

1. **The right panel.** Should it become the Inspector (the selected step's editor plus Parameters), in place of the
   Guarantees panel? *Recommended: yes.* The alternative is no right panel and a pop-up editor only. That pop-up
   covers the planes while you edit.
2. **Guarantees.** Is a small F tile with the lit property enough, with details on click? Or should the guarantees go
   entirely? *Recommended: keep the F tile.* It costs one tile, and it is also where the formula of *F* lives.
3. **Phone layout.** One plane with a live inset, and X | Y side by side while a sheet is open: is that right?
   *Recommended: yes.* The alternative is X and Y stacked 50/50 at all times, which makes each plane half as large.
4. **Build order.** Should shared numbers and links come first, with constructions in a later round? *Recommended:
   yes.* Numbers alone already cover "a number used by several lines, changed in one place".

## The user's decisions (2026-10-23)

"Yes to all four recommendations: the right panel becomes the Inspector, keep the small F tile for guarantees, the
phone layout as designed, and shared numbers and links first, constructions in a later round."

So v15 builds: the chain cards (type + per-view picture), the Inspector in the right panel (step editor with the big
Add zero / Add pole buttons, and Parameters), the plane context menu (right-click / long-press), the F tile in place
of the Guarantees panel, the phone layout, and shared numbers with links and scene files. Constructions come in a
later round (v16).
