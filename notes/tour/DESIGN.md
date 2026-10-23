# Guided tour: design

The user: "make a guided tutorial of what is possible. Highlight patches and write comments. Remember that the tutorial
was already shown if it was and make it as a suggestion on opening, no forced. Make it appear on the press of the help
button."

Built: `src/tour.js` (content, spotlight, callout, suggestion card, help menu, persistence, its own CSS on the app's
tokens). Nothing else in `src/`, nor `dist/`, `test/regress/` or `build.py`, was changed. The app's side is
`INTEGRATION.md`. Checked on the real v12 build through `harness.html` (below), in light and dark themes, at 1440 × 900
and on a 390 px phone.

## How it looks

- **Spotlight.** Everything except the patch the step is about is dimmed (the app's ink at 50 %, black at 64 % in
  dark). The patch is a rounded cut-out (radius 8 px, 10 px for a panel) with a 1.5 px accent ring and a soft 7 px
  accent glow at 22 %. Between steps the cut-out glides (the app's `--t-slow`, 240 ms); with reduced motion it jumps.
- **Several patches.** A step may light more than one area (Draw: the tools and the X pane). Areas that only touch
  are trimmed apart, 4 px between them, so the even-odd shade never dims their overlap. An anchor inside a lit panel
  (the Plane · Sphere control of the portrait, the transport of the merged deformation plane) lights the whole panel
  and gets a dashed accent ring of its own.
- **Callout** (320 px, the app's popover surface: `--surface`, `--line-strong`, `--r-4`, `--shadow-3`): a 3 px accent
  progress line along its top edge; the chapter name (caption, muted) and × (End the tour); the title (600 15/20); one
  to three sentences (13/19, `--ink-2`) with inline TeX through the app's MathJax and keys as the app's `.kbd`
  (punctuation after a formula stays on its line); an optional **Try it** box (`--accent-soft`) with a ring that fills
  with a check when the user does it; a footer with "3 of 10", Back and Next (the app's `.btn ghost` and
  `.btn primary`). The first step reads **Start**, the last step of the tour **Finish**. The last step of a chapter
  reads **Next: Views** with **Done** beside it, and the count gives way to them (the full progress line says it).
- **Placement**, in this order, taking the first place that covers no lit area:
  1. beside the patch, on the step's preferred side, else right, left, below, above, with a caret pointing at the
     patch (or at the marked anchor inside a lit panel, the card centred on it);
  2. beside all the lit areas together, without a caret;
  3. inside a patch as big as the stage, in the corner with the fewest controls (the portrait's options strip and zoom
     buttons are measured and kept clear);
  4. the place that covers the least of what is lit.
  A wide Phase or Landscape panel has the callout below it, over the dimmed chain, so the picture stays whole.
  Below 640 px the callout is a sheet: at the bottom, at the top when the patch is low, or between two lit areas (the X
  pane above, the tool bar below). The patch is scrolled into the free half, and a patch mostly cut off by a scrolling
  panel (a section low in a side panel, the add card at the end of a long chain) is scrolled into view first.
- **The welcome step** is a centred 380 px card over a full shade.
- **Interaction.** The lit patch stays operable (a click in the cut-out reaches the app). A click on the shade does
  not end the tour; it nudges the callout. Keys: → next, ← back (when the focus is in the callout or nowhere). Esc in
  the callout ends the tour. Anywhere else the app's own Escape comes first: a menu, the palette or a dialog, a field
  being typed in, and whatever the app reports with `api.busy()` (a drawing, a drag, a polygon or lasso being placed, a
  selected shape, an open drawer, the tools' More menu). Only when the app has nothing to cancel does Esc end the tour,
  so a student who presses Esc to cancel a polygon stays in the tour. Enter stays the app's (it closes a polygon). Focus: Next has it on each step; Tab cycles through the callout, plus the
  lit patch during a Try it (a toolbar's roving tabindex is respected); Tab is the app's while its palette or a dialog
  is open. The callout is `role="dialog"` with `aria-modal="false"`. A polite live region reads "Basics, step 3 of 10.
  Title. Body", with TeX as text (π, ≠, ∮, z², …).
- **Layering.** The shade sits at z 25 (above the panes and drawers, below popovers at 30), the callout at 35. So a
  menu, the palette (40) or the guide (50) opened during a Try it shows on top, bright. The app's hover tooltip (`#tip`,
  z 70) is hidden while it would cover the callout (a MutationObserver on it), and shows again as it moves away.
- **The lit patch** is the anchor's box cut by its scrolling ancestors. Ancestors that cannot clip are passed over:
  `display: contents` (the header's `#hdrMenu` popover on a wide screen has auto overflow and a 0 × 0 box, which used to
  shrink the Examples, palette, Export and Help patches to a 12 px dot) and any 0 × 0 box.

## The tour's own scenes and the user's work

The tour borrows the canvas only when it can give the work back (INTEGRATION.md §3, "The user's work"):

1. `api.sandbox(true)`: the app flushes any pending save and suspends autosave, so the saved copy on disk stays the
   user's own work for the whole tour, and a reload during a tour simply loads it.
2. `api.snapshot()` → `{ state, mem }`: kept in memory. Its `state` (what writeState saves, not the undo history) is
   also written to `cmw-tour-stash` as `{ page, snap: { state } }` and read back; a heartbeat (`cmw-tour-live`,
   `{ page, t }`, every 2 s) tells other tabs that this page holds it.
3. Scenes are loaded only when `snapshot`, `restore` and `loadScene` exist, the snapshot is not null, and the autosave
   is paused or the stash was verified. Otherwise the tour runs **without scenes**: only the steps that change nothing
   are shown (Figures for articles, Command palette, Help is here); a chapter with none of them is refused with a toast
   ("The tour is not available in this build.") and nothing is touched.
4. Every scene sets the display its copy assumes (`look`: Checker, the default opacity, height log|F|, one sheet, the
   Tiles phase style, Paths on, One after another; Every sheet of the logarithm: height Im, All sheets), through
   `api.setLook` right after `api.loadScene`. A user who left the pattern on Stretch or the height on Re F sees the
   checkerboard the copy talks about, and gets their own look back with their work.
5. Every way out (Finish, Done, ×, Esc) calls `api.restore(snapshot)`. Only when it succeeds: `sandbox(false)`, the
   stash and heartbeat go, and the toast says "Your work is back. The tour stays under Help." When it fails, the
   autosave stays paused, the stash stays, and the toast says "Your work could not be put back here, but it is safe:
   reload the page to get it back." Without scenes the toast only says where the tour lives.
6. After a reload or a crash, `Tour.init` restores the stash (`restore({ state }, { fromStash: true })`) and drops it
   only once that succeeds. It leaves alone a stash whose heartbeat is fresh and from another page, and a second
   `Tour.init` in the page that runs the tour only replaces the adapter.
7. A chapter started from inside a running tour (its help step, the palette, the help menu) takes it over: the first
   snapshot, the paused autosave and the stash stay, and the app gets no `onTour(false)` / `onTour(true)`. Starting is
   synchronous up to the new run, so two starts in the same tick never snapshot the tour's own scene, and every wait
   in a step's show checks that its run is still the live one (`run === r` and its sequence number), so a stale step
   never shows over the new chapter.

Scenes per chapter, in the app's example format:
- Basics, Deformation: **Strip to disk**, F = (eᶻ − 1)/(eᶻ + 1).
- Views: **A rational map**, (z² − 1)/(z² + 1) over the square [−1.5, 1.5]².
- Analysis: **Roots as preimages** (z³ − 1, targets 0 and |w| = 0.6); the zeros-and-poles step uses **Zeros and poles**,
  the same rational map as a `zp` step (a = 1, zeros ±1, poles ±i); the integral, natural domain and guarantees steps
  use **A residue by integration**, built as a `zp` step (a = 1, no zeros, poles ±i) when the build has it, so the
  natural domain panel reads z ∉ {i, −i} as the copy says, else as the typed formula 1/(z² + 1), whose panel reads "the
  formula is defined at z" (the copy says so too).
- Branches and inverses: **Logarithm of an annulus** (log z with its red cut), **The derivative in the chain**
  (z³ − 3z, then d/dz, target 0), **Every sheet of the logarithm** (Landscape, All sheets, height Im).
- Export, Keys: whatever is on screen.

A step shows the scene of the last `scene` action at or before it in its chapter (a list picks the first the build
can make), so Back always shows the right one.

## Chapters and steps

32 steps in 7 chapters; Basics is 10 steps with 4 Try its, about 2 minutes. Copy markup: `$…$` TeX, `{K}` a key,
`{mod}` ⌘ or Ctrl. "before" is what the tour does first: view, surface (pane, plane or sphere), deform (on or off),
focus (a chain card, 0 = Whole chain), panel (show a side panel), tool (`select`), look (a display key), scene. Each step
has one idea. The panes are named by their role, X and Y, never left and right (on a phone they stack, X above Y). A
step may have `touch` copy (no hover, no right-click, no keys: "Touch and hold a point w in Y"), `narrow` copy (below
640 px: "in this menu"), and copy by scene (`byScene`). `test/t_tour.js` checks that what a phone shows says no left,
right or hover.

The copy states only what is true for its scene (checked: tanh(z/2) maps the strip one-to-one and conformally onto the
disc and has period 2πi, so a w inside the disc has exactly one preimage in the strip and one outside it has two in
view, 2πi apart; conformal means right angles kept and tiny squares near-squares, not that the Checker cells stay
square, which is what Log-polar cells do; H_t is analytic for every t, so angles are kept wherever H_t′ ≠ 0, not
everywhere; (z²−1)/(z²+1) has zeros ±1, poles ±i and F(∞) = 1; Res_i 1/(z²+1) = 1/(2i), so the integral over
|z − i| = 1 is π; a closed curve's context menu item is "∮ F dz around …"; |z³ − 1| = 0.6 has three components because
the only critical value, −1, has modulus 1 > 0.6; (z³ − 3z)′ = 3z² − 3 vanishes at ±1; log z jumps by 2πi across its
cut and sheet k adds 2πik; the pattern names and the Stretch colours are the app's own).

### 1. Basics (2 min, scene: strip)

| # | anchor | title | copy | before | Try it (completes on) |
|---|---|---|---|---|---|
| 1 | none (centred) | Welcome to the Workbench | Draw a set in the $z$-plane, send it through a chain of functions and watch its image. This takes about two minutes, and your own work comes back when the tour ends. | view xy; deform false; surface L plane; surface R plane |  |
| 2 | paneL | X: the domain | X shows your shapes, here the strip $\|\operatorname{Im} z\|<\pi/2$, with a checkerboard drawn in $z$-coordinates. Scroll to zoom, drag empty space to pan, and {Z} fits both planes. (Touch: "X shows your shapes, here the strip $\|\operatorname{Im} z\|<\pi/2$, with a checkerboard drawn in $z$-coordinates. Pinch to zoom and drag empty space to pan.") |  |  |
| 3 | paneR | Y: the image | Y shows the image under $F(z)=(e^z-1)/(e^z+1)$: the strip becomes the unit disc. $F$ is conformal there: grid lines still cross at right angles, and tiny squares map to near-squares. |  |  |
| 4 | panes | Preimages | Hover a point $w$ in Y: X marks every $z$ in view with $F(z)=w$. Inside the disc there is exactly one in the strip, since $F$ maps the strip one-to-one onto the disc. Outside it there are two, $2\pi i$ apart, as $F$ has period $2\pi i$. (Touch: "Touch and hold a point $w$ in Y: X marks every $z$ in view with $F(z)=w$. Inside the disc there is exactly one in the strip, since $F$ maps the strip one-to-one onto the disc. Outside it there are two, $2\pi i$ apart.") |  | Hover inside the disc, then outside it. (Touch: Touch and hold inside the disc, then outside it.) (probe) |
| 5 | tools / toolsRail + paneL | Draw a shape | Pick a tool and drag in X to add a shape. The same tools in Y add a target in $w$ instead. |  | Choose Disc, then drag in X. (shape-added) |
| 6 | shapes + paneL | Your shapes | Each shape is listed with its equation; the eye hides it and ⋯ has the rest: duplicate, delete, integrate. With Select {V}, drag a shape or a handle and the image follows; {mod}{Z} undoes. (Touch: "Each shape is listed with its equation; the eye hides it and ⋯ has the rest: duplicate, delete, integrate. With Select, drag a shape or a handle and the image follows.") | tool select | Press {V}, then drag the line $\operatorname{Im} z=0.8$ up or down. (Touch: Drag the line $\operatorname{Im} z=0.8$ up or down.) (shape-moved) |
| 7 | formula | Sets from formulas | Type a set and press Add, such as $\|z-1\|<2$ or $0<\operatorname{Im} z<\pi$. An equation like $\|z\|=1$ adds a curve, and a formula in $w$ adds a target. |  |  |
| 8 | chain | The function chain | The cards apply in order: $F=f_2\circ f_1$ with $f_1(z)=e^z$. Click a card to focus that step, and X and Y become its input and output. (Touch: "The cards apply in order: $F=f_2\circ f_1$ with $f_1(z)=e^z$. Tap a card to focus that step, and X and Y become its input and output.") |  | Click the card $f_1$. (Touch: Tap the card $f_1$.) (step-focused) |
| 9 | addStep / chain | Add a function | Press {+} or click here to add a step: pick one from the catalog or type a formula such as $\sin(z^2)$. Drag a card by its header to reorder. (Touch: "Tap here to add a step: pick one from the catalog or type a formula such as $\sin(z^2)$. Drag a card by its header to reorder.") | focus 0 |  |
| 10 | examples / moreBtn | Examples | Worked examples, from the Joukowski airfoil to a residue found by integration. Open one whenever you want a starting point. (Phone: "Worked examples are in this menu, from the Joukowski airfoil to a residue found by integration.") |  |  |

### 2. Views (1 min, scene: rational)

| # | anchor | title | copy | before | Try it (completes on) |
|---|---|---|---|---|---|
| 1 | viewSwitch | Three views | X → Y shows the two planes side by side. Phase and Landscape are pictures of $F$ over X, each in one wide panel. Keys {1} {2} {3}. (Touch: "X → Y shows the two planes. Phase and Landscape are pictures of $F$ over X, each in one wide panel.") | deform false; view xy | Choose Phase. (view-changed; advances) |
| 2 | panes | Phase portrait | Each $z$ is coloured by $\arg F(z)$, here for $F(z)=(z^2-1)/(z^2+1)$, and the brightness bands are level sets of $\|F\|$. All colours meet at the zeros $\pm1$ and the poles $\pm i$, circling one way around a zero and the other way around a pole. | view phase; surface L plane |  |
| 3 | panes | Landscape | The graph of $\log\|F\|$ over X: zeros are pits and poles are peaks. Drag to orbit; the panel's options set the height and the colouring. | view land |  |
| 4 | surfaceL + panes | The Riemann sphere | Sphere wraps the plane onto the Riemann sphere, with $\infty$ at the north pole; here $F(\infty)=1$, neither a zero nor a pole. You can draw on the sphere too. | view phase; surface L sphere |  |
| 5 | patterns + paneR | Patterns | The pattern is painted on X and carried to Y by $F$. Checker shows how squares are bent and scaled, Log-polar cells stay square under a conformal map, and Stretch shades by $\|F'(z)\|$: blue shrinks, amber grows. | view xy; surface L plane; surface R plane; look pattern checker | Choose Stretch. (pattern-changed) |

### 3. Deformation (1 min, scene: strip)

| # | anchor | title | copy | before | Try it (completes on) |
|---|---|---|---|---|---|
| 1 | deformToggle | Deformation | Plays a homotopy $H_t$ from the identity to $F$, step by step, in every view. In X → Y the two panes merge into one plane. | view xy; surface L plane; surface R plane; deform false | Click it, or press {M}. (Touch: Tap it.) (deformation-toggled; advances) |
| 2 | transport + panes | Play and scrub | Play, or drag $t$. Each step follows its natural path when it has one (the caption names it): $H_t$ is analytic for every $t$, so angles are kept wherever $H_t'\neq0$. | deform true | Drag $t$. (deformation-t) |
| 3 | paths | Paths | Paths draws $t\mapsto H_t(z)$ for well-spread points $z$ of X, from $z$ to $F(z)$. Key {P}. (Touch: "Paths draws $t\mapsto H_t(z)$ for well-spread points $z$ of X, from $z$ to $F(z)$.") | deform true | Click Paths twice, or press {P} twice. (Touch: Tap Paths twice.) (paths-toggled, 2 times) |
| 4 | allAtOnce (needs `allAtOnce`) | All steps at once | With two or more steps, choose All at once: every step deforms at the same $t$, so $H_t=H^{(2)}_t\circ H^{(1)}_t$ with $0\le t\le 1$. | deform true |  |

### 4. Analysis (1½ min, scene: roots)

| # | anchor | title | copy | before | Try it (completes on) |
|---|---|---|---|---|---|
| 1 | panes | Targets and preimages | Shapes drawn in Y are targets in $w$, and X shades their preimages. The target point $0$ marks the roots of $F(z)=z^3-1$ with their multiplicity, here the three cube roots of unity; the circle $\|w\|=0.6$ pulls back to three loops around them. | deform false; view xy; surface L plane; surface R plane |  |
| 2 | zpCard + paneL | Zeros and poles | This step is built from its zeros and poles. Drag one, and the map, its image and its guarantees follow. | scene zp | Drag a zero or a pole. (zp-moved) |
| 3 | paneL | Integrals | Right-click the circle itself and choose $\oint F\,dz$: you get the integral, the winding number and the zeros and poles inside. It encloses the pole $i$ of $1/(z^2+1)$, so $\oint=2\pi i\,\operatorname{Res}_i F=\pi$. (Touch: "Touch and hold the circle itself and choose $\oint F\,dz$: you get the integral, the winding number and the zeros and poles inside. It encloses the pole $i$ of $1/(z^2+1)$, so $\oint=2\pi i\,\operatorname{Res}_i F=\pi$.") | scene 0 residueZp, 1 residue; view xy | Right-click the circle, then choose $\oint$. (Touch: Touch and hold the circle, then choose $\oint$.) (integral-opened) |
| 4 | domain | Natural domain | Where every step is defined. For a typed formula the panel reads "the formula is defined at $z$": here that is every $z$ except the poles $\pm i$. (Scene residueZp: "Where every step is defined: here every $z$ except the poles $\pm i$, which the panel writes $z\notin\{i,-i\}$.") | panel right |  |
| 5 | guarantees | Guarantees | A lamp is lit only when every step has the property and composition keeps it, so a lit lamp is always true; unlit means only that the chain does not imply it. Step by step, below, shows which step brings which property. | panel right |  |

### 5. Branches and inverses (1 min, scene: logAnnulus)

| # | anchor | title | copy | before | Try it (completes on) |
|---|---|---|---|---|---|
| 1 | paneL | Branch cuts | $\log z$ needs a cut: the red ray in X is where its values jump by $2\pi i$. Drag it to move the seam; the sheet $k$ on the card adds $2\pi i k$. | deform false; view xy; surface L plane; surface R plane | Drag the red cut. (cut-moved) |
| 2 | invBtn / chain | Inverses | $f^{-1}$ on a card replaces a step by its inverse when there is a single-valued one, as $e^z$ is for $\log z$. When there is none, as for $z^2$, it says why and offers the preimages instead. |  |  |
| 3 | chain + paneL | The derivative as a step | A $d/dz$ step differentiates the chain so far: here $F=3z^2-3$, the derivative of $z^3-3z$. The target $0$ marks its zeros $\pm1$, the critical points of $z^3-3z$. | scene deriv; view xy |  |
| 4 | sheets / panes + panes | All sheets | In Landscape, All sheets draws the whole Riemann surface of a multivalued map: $\operatorname{Im}\log z$ climbs a helicoid around $0$ instead of jumping at the cut. | scene logSheets; view land |  |

### 6. Export and LaTeX (30 s, scene: unchanged)

| # | anchor | title | copy | before | Try it (completes on) |
|---|---|---|---|---|---|
| 1 | exportBtn / moreBtn | Figures for articles | Export a vector figure of the current view, with a caption that states exactly what is drawn, or copy a LaTeX document with $F$, its natural domain and its guarantees. (Phone: "Export, in this menu, makes a vector figure with a caption that states exactly what is drawn, or a LaTeX document with $F$, its natural domain and its guarantees.") |  |  |
| 2 | composite | The formula in LaTeX | Composite map: $F$ in closed form; the copy button puts its LaTeX on the clipboard. | panel right |  |

### 7. Palette and keys (30 s, scene: unchanged)

| # | anchor | title | copy | before | Try it (completes on) |
|---|---|---|---|---|---|
| 1 | palette / moreBtn | Command palette | Search functions, region formulas, examples and commands with {mod}{K}. Type a formula such as $e^{z^2}$ to add it as a step. (Phone: "Search, in this menu, finds functions, formulas, examples and commands. Type a formula such as $e^{z^2}$ to add it as a step.") |  | Press {mod}{K}. (Touch: Open ⋯, then Add function or command.) (palette-opened) |
| 2 | helpBtn / moreBtn | Help is here | This button opens the tour by chapter, the reference guide and every shortcut. {?} opens the guide directly. (Phone: "Help, in this menu, opens the tour by chapter and the reference guide.") |  |  |

**What a build lacks is left out.** A step whose `needs` (or whose scene's `needs`) the app denies with
`api.has(feature) === false` is left out from the start, so the count is right from the first step ("1 of 4" in
Analysis on v12). A step whose anchor is missing when it comes up is skipped in the direction of travel, and the count
drops it; "Next: <chapter>" names the chapter that will actually show. On v12 the Deformation step All steps at once (`allAtOnce`) and the Analysis step Zeros and poles (`zp`) are
left out; the deformation round brings both (`#homOrderSel`, the `zp` step and its card are already in the working
`src/app.js` and `src/funcs.js`, and the default anchors find them).

**Try it.** A Try it never blocks: Next always works. When the app emits the event, the ring fills with a check
and Next gets a soft accent halo. A Try it may need the event more than once (Paths: twice, so Paths ends on) or a
sequence (Preimages: a probe inside the disc, then one outside it). Steps marked "advances" move on 0.7 s later (0.3 s with reduced motion), because
the next step explains what the action showed. A step listens only after its own actions ran, so the tour's own
setView or setDeformation never ticks a Try it.

## The first-run suggestion

A quiet card, 340 px, under the help button, with a caret pointing at it, so it also shows where the tour lives. It
holds the app mark, **New here? Take a 2-minute tour** (for a user with saved work, `api.hasWork()`: **Take the 2-minute
tour**), "Draw a region, send it through a chain of functions and watch its image. About two minutes, and your work is
kept.", and the buttons **Start the tour** (primary), **Not now** (ghost) and ×. It is not modal: there is no shade, it
does not take the focus, and the page works around it; a polite live region announces it, with where the tour lives
("under Help", on a phone "under ⋯ › Help").

- It shows 1.2 s after the app is ready, and never over a menu, the palette or a dialog (it waits for them to close,
  up to 15 s, then waits for the next opening).
- Once the user starts working (a press anywhere outside the card and the help button), the card shrinks to a pill
  under Help, ▶ Take the tour · 2 min, so it no longer covers the composite map; the pill starts the tour.
- **Start the tour** runs Basics. **Not now** and × dismiss it for good, with a toast: "The tour is under Help
  whenever you want it." (on a phone "under ⋯ › Help"). Esc hides it for this session only.
- Ignored (the page closed with the card up): it comes back on the next opening, at most 3 openings in all.
- It is never shown once the tour has been taken, dismissed, or started from the help menu.
- On a phone it is a full-width card under the top bar, clear of the tool bar along the bottom.

## The help button

The help button opens a menu, the app's `.pop.menu` component:

```
Guided tour
 ▶  Take the tour                     2 min     (or: Continue the tour · Views: Phase portrait)
 ─────────────────────────────────────────
 1  Basics                        ✓   2 min
 2  Views                             1 min
 3  Deformation                       1 min
 4  Analysis                        1½ min
 5  Branches and inverses              1 min
 6  Export and LaTeX                  30 s
 7  Palette and keys                  30 s
 ─────────────────────────────────────────
 📖 Reference guide                       ?
 ⌨  Keyboard shortcuts
```

- **Continue** appears when a tour was left mid-way, and picks up at that step (after Done: at the next chapter).
- A check marks a finished chapter. A chapter added or rewritten in a later tour version (`rev` > the version the
  user last saw) shows **New**.
- The menu has `role="menu"`; ↑ ↓ Home End move, Enter runs an item, and Esc or Tab closes it and returns the focus.
- On a phone the help button is in the ⋯ menu, which closes on the click; the help menu then hangs under ⋯.
- **Reference guide** is today's guide (`openGuide`). **Keyboard shortcuts** opens it at its Keys section. The `?`
  key keeps opening the guide directly; the palette can list "Tour: …" entries from `Tour.chapters()`.
- On a touch screen (or below 640 px) the menu shows no key hints and no Keyboard shortcuts item.

## Persistence

All keys go through `api.storageKey(k)` (the app's `lsk`, so `?ns=` test namespaces stay separate).

| key | value |
|---|---|
| `cmw-tour` | `{ v, shown, outcome, done, last }`: v the tour version last seen; shown how many times the suggestion appeared; outcome `null`, `'taken'` or `'dismissed'`; done `{ chapterId: rev }`, a chapter finished at that revision; last `{ ch, i }`, where to continue, or null |
| `cmw-tour-stash` | `{ page, snap: { state } }`: the persisted part of the user's snapshot while a tour runs (removed once `restore` succeeds, at the end or by `init` after a reload or a crash) |
| `cmw-tour-live` | `{ page, t }`: the heartbeat of the page whose tour holds the stash (every 2 s; stale after 6 s) |

`Tour.isSeen()` is true once the outcome is set, a chapter is done, or a tour was started. `Tour.reset()` clears the
record; it never drops a backup of the user's work. Storage that is missing, malformed or blocked never breaks the tour; it only forgets (checked with a fake
`localStorage`).

## Files

- `src/tour.js`: the module (global `Tour`, also `window.Tour`, and `module.exports` for node).
- `test/t_tour.js`: node, 853 checks. The content against `INTEGRATION.md` (every anchor a step uses is in its Anchors
  table and has a default; every Try it event is in its Events table and every listed event is used; the lead's anchor
  names and adapter methods, the sandbox, setTool, setLook, busy and hasWork included, are documented), the content
  rules (7 chapters, at most 36 steps, Basics 8 to 10 with at most 4 Try its, 1 to 3 sentences and at most 240
  characters a step and per variant, Try it text at most 60 as read, known actions and values, balanced TeX, no
  backslash left in the read-aloud text, the topics the tour must cover, no "left pane" or "right pane" anywhere, and no
  left, right or hover in what a phone shows), the facts the review found wrong (Select before Your shapes, Checker
  before Patterns, Paths twice, Natural domain before Guarantees, the ∮ menu item, no "squares stay square"), every
  scene's full look, the preimages Try it (inside, then outside), the copy markup and TeX as text, placement (cases, two
  lit areas, phone sheets between areas, inset clear of controls, a 6000-case fuzz), the lit areas, the record and the
  stash through a fake `localStorage` (namespaces, another page's live heartbeat, a stale one, a restore that throws or
  returns false, reset keeping the stash, malformed and blocked storage), the first-run rules over several openings,
  `api.has`, the scene fallback without `zp`, the steps left without scenes, and the step order with absent steps.
- `test/tour_cmd.js`: the browser, 83 checks on the real v12 app through the harness: the spotlight beside its anchor,
  dialog semantics and the read-aloud text, Tab inside the callout and into the lit patch during a Try it, the keys, a
  shade click, the stash (its persisted state only, this page's id, the heartbeat) and its restore (also across a
  chapter started inside the tour, and a second `Tour.init` during it), Draw then Your shapes (Select comes on, the
  line moves, no second disc), Escape with a selection, during a polygon and in the callout, two lit areas, Try its
  completed by real input, a scene's look over the user's Stretch, the tooltip hidden over the callout, the portrait's
  callout below it, the sphere's marked control, the chapter-end footer, absent steps and the counts, the integral and
  natural-domain copy against the panel, Done and Continue, the top-bar patches lit whole (Examples, palette, Export,
  Help), Escape left to the palette, the suggestion (position, copy, "New here?" only on a first visit, the pill, Not
  now, the cap of three openings, Start), the menu (seven chapters, done marks, keys), reduced motion, the harness
  panel, the phone (sheet, sheet between two areas, what the steps say, the suggestion under the top bar and its
  "⋯ › Help", the help menu from ⋯ without key hints), two starts in a row with a missing anchor, an adapter whose
  snapshot throws and one whose restore fails. Run it with the kit copy: `notes/tour/cdp/q.sh test/tour_cmd.js`.
- `test/tour_lit_cmd.js`: the browser, 60 checks: every step of every chapter at 1440 × 900 and 1024 × 700: the first lit area
  holds at least 90 % of the anchor's visible box. `notes/tour/cdp/q.sh test/tour_lit_cmd.js`.
- `harness.html`: the published v12 app (`notes/gate-merged-r2/dist/test.html`, its own stylesheet, renderer and
  MathJax) with `src/tour.js`, `demo/adapter.js` and `demo/panel.js` appended by `build_harness.py`. The harness panel
  (bottom left) starts any chapter, shows the suggestion or the help menu, forgets the tour, switches the theme, and
  logs every call the tour makes into the app and every event the app sends back. URL modes for checks and shots:
  `?ns=demo&tour=step&ch=views&i=1` (any chapter and step), `?ns=demo&tour=suggest`, `?ns=demo&tour=menu`,
  `?ns=demo&first=1` (as on a first visit), `&bare=1` (no panel). The demo adapter polls v12's test hooks for events
  (quiet for a moment after the tour's own calls), says `has('zp') === false` and `has('allAtOnce') === false`,
  pauses the autosave by holding back v12's writes to its saved-state key, tracks a drawing in progress from the
  pointer (v12 does not expose its draft), applies a look through `__cmwSet` and the pattern swatches, and restores by
  reloading, because v12 has no in-place restore (in the URL modes it does not reload). The real adapter does each of
  these directly.
- `shots/`: headless Chrome (ANGLE Metal), taken with the kit copy in `cdp/` (its daemon stopped and its profile
  deleted afterwards). Desktop 1440 × 900: `tour-x-light` (a pane, the callout beside it), `tour-draw-light` (two lit
  areas, Try it), `tour-shapes-light` (Try it done after drawing a disc), `tour-views-switch-dark` (top bar),
  `tour-phase-dark` (the callout below the portrait), `tour-sphere-dark` (the marked surface control),
  `tour-patterns-dark` (Try it done, the chapter-end footer, the callout below), `tour-paths-light`,
  `tour-integral-light`, `tour-welcome-dark`, `tour-examples-light` (end of Basics, the Examples button lit whole),
  `tour-palette-light`, `tour-export-light`, `tour-help-light` (the top bar's patches), `tour-suggest-light`/`-dark`,
  `tour-suggest-pill-light` (the card shrunk to a pill once the user works), `tour-menu-light`/`-dark`,
  `tour-harness-light` (the harness panel). Phone 390 × 844: `tour-phone-x`, `tour-phone-draw-dark` (the sheet between
  the pane and the tool bar), `tour-phone-suggest` (under the top bar), `tour-phone-menu` (no key hints).

## Open points

- After the deformation round lands, run `test/tour_cmd.js` and `test/tour_lit_cmd.js` against the integrated build
  (INTEGRATION.md §5) and look at the steps v12 cannot show: Zeros and poles, All steps at once, and the zp form of the
  residue scene (its natural domain should read z ∉ {i, −i}). Their copy is written against the working
  `src/funcs.js` (`zp`: a, zeros, poles) and `src/app.js` (`#homOrderSel`).
- The app must implement `busy()`, `sandbox(on)`, `setTool`, `setLook` and the `cut-moved` event (§3); the demo shows
  each on v12 from the outside. The demo cannot flush a save still pending when a tour starts (v12 has no hook).
- Branches and inverses: the f⁻¹ and All sheets anchors (`invBtn`, `sheets`) are found by markup today; the app may
  return them from `anchor()` instead.
- Taught since integration (INTEGRATION.md §6): the Phase key (Views), the Cauchy phase style (Analysis), the
  coordinate pad (a sentence in Zeros and poles), Sound (Palette and keys, when the build has it).
- At 1024 px, with a long example name in the Examples button ("Every sheet of the logarithm", which the demo's
  loadScene leaves there because v12's loadExample sets it), the v12 top bar runs past the right edge: the help button
  ends at x = 1040 (at 988 to 1016 with the default label). The tour lights the part on screen. The real `loadScene`
  must not set the label (§3); the header's overflow with a long label is worth a look in the app.
