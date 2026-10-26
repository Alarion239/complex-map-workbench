# Tour integration: v16.1 addendum (user request 5, the tour's controls)

Adds to notes/tour/INTEGRATION.md. On merge, copy the two sections below into it (test/t_tour.js reads this file
too, while it exists). Built in work/xvta; the write-up is AS-BUILT-tour.md beside this file.

### Anchors added in v16.1

Each names the one control that completes a step's task. A tool resolves to its own button where it shows: a
phone's More tools sheet (its tile), the Draw panel (`#tools`, `#constructTools`), the collapsed panel's rail
(`#railTools`), and on a phone, for a tool outside the tool row, the More key (`#toolMore > summary`, which then
shows the chosen tool).

| name | element | note |
|---|---|---|
| `tool:select` | the Select tool's button | dragging: Your shapes, zeros and poles, It follows its points, Branch cuts |
| `tool:line` | the Line tool's button | Intersections (a phone: the Line tile in More tools, else the More key) |
| `tool:circle3` | the Circle through 3 points tool's button | Circle through three points (a phone: its tile, then the More key) |
| `viewPhase` | `#viewSwitch > [data-mode="phase"]` | Three views: Choose Phase |
| `viewLand` | `#viewSwitch > [data-mode="land"]` | Cards follow the view: choose Landscape |
| `patStretch` | `#patternSeg .pat[data-pat="stretch"]` | Patterns: Choose Stretch (app.js gives each swatch `data-pat`) |
| `splitBtn` | `#propsPanel .insp-step .split-offer:not([hidden]) .so-btn` | A formula in steps: Split into n steps (the offer is unfolded for the tour's stop without saving the fold) |
| `card1` | `#pipeline .card[data-k="1"]` | The function chain: double-click (tap) f₁ |
| `card2Menu` | the card f₂, whose ⋯ shows on it; on a phone, once a tap on it opens the Editor sheet, f₂'s ⋯ there | Part of the chain, on a touch screen (`try.work`) |
| `paramSlider` | the first `#propsPanel .prm-row input[type="range"]` | Shared numbers: drag the slider of a |
| `tSlider` | `#morphRange` | Play and scrub: drag t |
| `playBtn` | `#morphPlay` | Play and scrub: Play |
| `copyTex` | `#propsPanel .insp-F .ihead .icon-btn` | The formula in LaTeX: F's Copy LaTeX button (with `composite`, which selects F) |

`tool:disc` (v12's contract) is now a function of the same kind: before, its selector found the rail's hidden copy
first, so it lit nothing while the Draw panel was open.

### Step fields and adapter calls added in v16.1

- `try.ctl`: the names of the controls that complete the Try it. Lit while the Try it shows (each its own area, or a
  dashed ring inside a lit area), brought into view with the step, reachable with Tab during the Try it.
- `live: true`: the step's anchor is looked up again whenever the layout changes, so a phone's tool tile in the More
  tools sheet is lit while the sheet is open and the More key once the tool is picked.
- `pictures: true`: the step is about the cards' pictures. `show()` calls the app's `chainPictures(on)` for every step
  (on only for such a step) and `stop()` calls `chainPictures(false)` before the work comes back.
- `chainPictures(on)` (app adapter, optional): on, the chain shows its cards' pictures (Pictures rather than Names, at
  the 188 px height when it is shorter), remembering the user's setting; off, that setting comes back unless the user
  changed it meanwhile. Returns true while the tour holds the pictures on (the step then says it will give the setting
  back). Nothing on a phone, whose chain bar always shows its pictures.
- `['panel', 'sheet', 'tools']` is now used by Circle through three points and Intersections: a phone's More tools
  sheet opens with the tool's tile (nothing on a wider screen, where the tool shows in the Draw panel or the rail).
  `['panel', 'sheet', 'display']` is used by All sheets: on a phone the check is in the Display sheet.
- A Try it's control that lies under an open layer it is not in is not lit. Example: a phone's tool row under the
  Editor sheet. The step has already switched to that tool.
- `reveal` scrolls the Try it's controls into view last. When the Select tool and the Shapes list do not both fit in a
  short side panel, the tool shows whole and the list shows from its top.
- `hostPlan` (a phone): a lit part in a panel that scrolls inside another lit part's panel is drawn in the outer
  panel. Example: the slider of a in its list inside the Editor sheet. Otherwise the two nested shades dim the lit
  part, and their windows over the page cancel out and block touches.
