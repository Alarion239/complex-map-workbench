# Interface: where parameters and constructions live (desktop and tablet)

From the desktop designer to the constructions designer. Short on purpose. Full layout: `DESIGN.md` (this folder).

## The right panel becomes the Inspector

- The Guarantees panel goes. *F* gets one home on every platform: the **F tile** at the end of the chain. Selecting it
  shows the expanded *F*(*z*), the lit guarantees, the domain and the step table in the Inspector (DESIGN.md §2.6).
- The right panel (288 px at ≥ 1280 px) is now the **Inspector**. It has two stacked sections:
  1. **Selection** (top, natural height). It edits the one selected object:
     - a step (click its card): the step editor; the F tile: the formula of *F* and its guarantees;
     - a shape or a construction (click it on a plane or in the Shapes list): its definition;
     - a parameter (click its row below): its range, step and animation.
  2. **Parameters** (below, fills the rest, scrolls). Always visible. The shared numbers (`a = 0.5 on [−2, 2]`, lists
     like `k = [−2 … 2]`). One row each: name, value field, slider. Yours to define; the slot is 288 px wide and at
     least 240 px tall at 1440 × 900 with a 3-step chain selected.
- The Inspector never holds a list of shapes. Constructed objects (points, lines through points, circles through three
  points, midpoints, meets) are **shapes**. They are listed in the left panel's Shapes list, with their definition as
  the row's text (`line(P, Q)`, `circle(P, Q, R)`), and drawn and picked like any other shape.

## Fields that take parameters

- Every value field (step parameters, shape fields, zeros and poles) accepts a formula in the parameter names
  (`2a`, `P + a`, `e^{ik}`). A field bound to a parameter shows a small link chip with the name; clicking the chip
  selects the parameter (the Inspector's Selection then shows it).
- Changing a parameter (slider, field, drag of a point) is one undo step per gesture, like a zero drag today.

## The planes' context menu (right-click, or the long-press below)

One menu for every plane. Its groups, top to bottom (empty groups are left out):
1. **The object under the pointer**: Select, then its own actions (shapes: Integrate along it, Hide, Delete; a zero
   or pole: Turn into a pole/zero, Remove).
2. **At this point**: on X (and Phase or Landscape over z) **Add zero of fₖ here** / **Add pole of fₖ here**, placed at
   *w*ₖ₋₁ = *F*ₖ₋₁(*z*), with a muted "also at …" line when an earlier step is not one-to-one; plain Add zero here on the
   step's own input plane; never on Y (DESIGN.md §2.5). Add point here, Copy the coordinate.
3. **Constructions** (yours): with points selected, Circle through 3 points, Midpoint; with one curve under the pointer,
   Point on this curve; with two, Intersect. (No "Line through 2 points": the Line tool snaps to points.) Name the items in sentence case, at most 4 items, each
   with a shortcut if it has one.

## Tablet and without the panel

- 1024–1279 px: the Inspector stays docked (264 px); the left panel is a rail. Same two sections.
- 768–1023 px (portrait): the Inspector docks under the chain, full width, 320 px tall, Selection ⅔ | Parameters ⅓;
  no right rail.
- Inspector hidden (`]`): a selected step's editor opens as a **temporary Inspector**, 288 px, over the stage's right
  edge, never over the picture's centre or a plane's options strip; Parameters open the same way. Esc or `]` closes it.
- Phone: the phone designer decides (notes/ui-redesign-2/phone/).

## Please tell me (append below)

- The Parameters section's minimum height and its row height.
- Any control a construction needs that is not a field, a slider or a menu item.


## Answers from the constructions designer (notes/ui-redesign-2/constructions/DESIGN.md)

- **Agreed:** Parameters in the Inspector's lower section; constructions are shapes in the Shapes list; the
  "Constructions" group in the planes' context menu (Line through 2 points, Circle through 3 points, Midpoint with
  points selected; Point on this curve with a curve under the pointer; Intersect with two curves there).
- **Parameter row: 56 px** (52 px plus a 4 px gap). Line 1 (24 px): the name in STIX 15, "=", the value field
  (B612 Mono, 72 px), a play button (24 px) and ⋯. Line 2 (20 px): the slider at full width, with min and max in
  `--t-micro`. "used by *g*, *m*" shows in the Selection section, not in the row.
- **Parameters section, minimum 240 px**: the 28 px head, three rows and the 32 px "+ Number" row. Below that it
  scrolls.
- **A selected parameter** in the Selection section shows its range (min, max, step), its play mode (loop or bounce,
  speed) and "used by …" with links.
- **A selected construction** in the Selection section shows its definition ("circle through *P*, *Q*, *R*"),
  "uses … · used by …", **Make free** (keep the shape, forget the definition) and **Delete** (the toast lists the
  dependents that go with it).
- **Controls beyond a field, a slider or a menu item.** All of them are small:
  1. a play button on each parameter row;
  2. a pick chip on the plane while a construction tool waits ("Circle through three points: point 2 of 3"), the same
     chip style as the polygon draft chip;
  3. a snap ring with "on *P*" when a drawing tool's point lands on an existing point (it binds the handle);
  4. hover highlighting of everything connected to an object (no control, just emphasis).
- **Draw grid**: two new tools, **Circle (3 points)** and **Intersect**. Midpoint, Perpendicular bisector and
  Point on curve go under More. The existing tools gain point snapping and binding; no other new tools.


## Revision 2: rules shared by desktop, tablet and phone

### Long-press (one state machine, both platforms) [design-6, users-12]

| State | Enter | Leave |
|---|---|---|
| Idle | pointer down on a plane (one finger, or the mouse) | — |
| Pending | the press | moved > 8 px: pan, drag or draw (as today); a second finger: pinch (never the menu) |
| Ring | 450 ms without moving: a ring fills under the finger (Android: 10 ms vibration) | — |
| Probe | from Ring, the finger slides: live readout of *z* and *F*(*z*) in the title chip | release: the readout stays until the next pan |
| Menu | from Ring, release without sliding | the context menu opens, headed by the point and *F* there |

- The mouse never needs it (right-click). A pen behaves like a finger.
- The same numbers everywhere: 8 px slop, 450 ms, 44 px rows on touch.

### Keyboard and screen readers [design-9]

- **The chain is a listbox** (`role="listbox"`, cards are `option`s, the F tile is the last option). Arrows move, Enter
  selects (the Inspector edits it), `L` toggles Show alone, Delete removes (with Undo), Home/End jump.
- **Each card has a name**: "f₂, Möbius", plus ", shown alone", ", bypassed", ", error: …". The picture is decorative.
- **The plane menu without a pointer:** Shift+F10 or the Menu key opens it at the keyboard probe (the crosshair that the
  arrow keys move; sound stage 2 already plans it). Items are `menuitem`s, arrows move, Enter acts, Esc closes and
  returns focus.
- **Popovers, sheets and the temporary Inspector** take focus when they open and return it when they close. Sheets are
  non-modal on the phone, so Tab can leave them; Esc closes them.
- **Announcements** (`aria-live="polite"`): "Added slider a", "Added zero of f₃ at 0.39 + 0.27i", "X₁: they meet only
  at ∞", "c is undefined: two of the points coincide".
- Touch targets: 44 px on touch; every control has a visible label or a tooltip/long-press label.

### One tool set (desktop, tablet, phone) [design-14, users-16]

- The existing tools snap to existing points (snap radius 8 px with a mouse, 22 px on touch) and bind to them. **The
  Line tool through two points is "a line through 2 points".**
- New in the Draw grid: **Circle (3 points)** and **Intersect**.
- Under More, in the same tile style: **Midpoint**, **Bisector**, **Point on curve**.
- The phone's More tools sheet lists exactly these, as tiles.

### Names in fields [design-16, design-17, users-5, users-6]

- A step's own coefficients carry the step index (*a*₂, *b*₂, …); a plain name is always a shared number.
- Cyrillic look-alikes are read as Latin; other Cyrillic letters are refused («Используйте латинские буквы»).
- One standalone unknown letter per edit becomes a slider; a run of letters that is not a function is an error.
