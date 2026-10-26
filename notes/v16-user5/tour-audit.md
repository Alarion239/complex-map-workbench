# Tour audit: what each task needs and what is lit (v16 → v16.1)

The user (2026-10-25): the tour often asks to do something in the left panel without lighting the tool for it. The
request: light exactly the tool the task needs.

This table lists every step that asks the user to do something: a Try it, or a sentence that says to click or type.
"v16" is what the published build lit. "v16.1" is work/xvta. Steps that only describe something (welcome, y,
phase, sphere, key, inspector, targets, cauchy, guarantees, deriv) are left out.

| step | the task | control it needs | v16 lit | v16.1 lights |
|---|---|---|---|---|
| basics/x | scroll, drag empty space to pan | X, with Select | X | X; Basics now starts in Select, so a drag pans instead of drawing |
| basics/preimages | hover (hold) in Y | Y | Y and X | same |
| basics/draw | **Choose Disc, then drag in X** | **Disc tool** and X | the whole Draw section (phone: the whole tool row) and X | **the Disc button alone** (Draw panel, rail or phone row) and X |
| basics/shapes | **Press V, then drag the line** | **Select tool** and the line in X | Shapes list and X; Select not lit | Shapes list, X and **the Select tool**. In a short window the panel scrolls so Select shows whole and the list from its top |
| basics/formula | type a set, press Add | formula field and Add | the Formula section | same |
| basics/chain | double-click (tap) f₁ | card f₁ | the whole chain | the chain, with **card f₁** ringed |
| basics/add | press + or click here | the + card | the + card | same |
| basics/examples | open an example | Examples (⋯ when narrow) | same | same |
| views/switch | Choose Phase | Phase key | the whole view switch | the switch, with **Phase** ringed |
| views/land | drag to orbit | the panel | the panel | same |
| views/patterns | Choose Stretch | Stretch swatch | the whole pattern row and Y | the row, with **Stretch** ringed |
| edit/cards | press 3 or choose Landscape; the cards show pictures | Landscape key; **pictures on the cards** | the chain and the switch. With Names, the cards had **no pictures** | the chain and the switch, with **Landscape** ringed. **Pictures on for the step** (see below) |
| edit/split | press Split into 3 steps | the Split button | the offer. A folded offer hid the button | the offer, with **Split** ringed. The offer opens for the step and the fold is not saved |
| edit/zp | **drag a zero or a pole** | **Select tool**, a zero in X | the editor and X; the tool not switched | the editor, X and **Select**, switched on first. Not on a phone: the Editor sheet covers the tool row there |
| edit/zpHere | right-click (hold) X, Add zero here | X | X | X; Select switched on first (a hold with a drawing tool would draw) |
| edit/numbers | drag the slider of a | the slider | the Parameters block and the panes | the block, with **the slider** ringed |
| construct/c3 | **Choose Circle through 3 points**, click z₀ z₁ z₂ | **3 points tool** and X | the whole Construct grid (phone: the whole tool row) and X | **the tool alone** and X. On a phone the More tools sheet opens with its tile lit, then the More key (showing 3 points) once it is picked |
| construct/follow | **drag z₂ across the line** | **Select tool** and X | X only | X and **Select** |
| construct/meet | **draw a line from a crossing** | **Line tool** and X | X only | X and **Line**. On a phone the More tools sheet opens with the Line tile, then the More key |
| deform/toggle | click it or press M | Deformation | same | same |
| deform/transport | Play, or drag t | Play, the t slider | the transport bar and the panes | the bar, with **Play** and **t** ringed |
| deform/paths | Paths twice | Paths | same | same |
| deform/order | choose All at once | the order select | same | same |
| deform/range | drag the bracket's end (touch: f₂'s ⋯) | the bracket's end; touch: card f₂ | the bracket's end (phone: the chain bar) | same, plus on a touch screen **card f₂** (on a phone, then f₂'s ⋯ in the Editor sheet) |
| analysis/integral | right-click (hold) the circle, ∮ | the circle in X | X | X; Select switched on first |
| analysis/domain | select the F tile | F tile | the domain and F | same |
| branches/cut | **drag the red cut** | the cut in X, **Select** | X only | X and **Select**, switched on first |
| branches/inverse | Replace with the inverse, in ⋯ | the Inspector's ⋯ | same | same |
| branches/sheets | All sheets, in Landscape | the All sheets check | the check. Phone: the panes, since the check was hidden in the Display sheet | phone: **the Display sheet opens** with the check lit |
| export/figure | export a figure | Export (⋯ when narrow) | same | same |
| export/formula-tex | copy F's LaTeX | F's Copy LaTeX button | the formula; the button not lit | the formula and **the Copy LaTeX button** |
| keys/palette | ⌘K (⋯ › Search) | the palette key (⋯) | same | same |
| keys/sound, keys/help | the Sound and Help buttons | same | same | same |

## Measured

I added a control check to `test/tour_audit_cmd.js`. Its table says, for each step, which element completes the task,
using selectors from the app's own markup rather than the tour's anchor names. The check passes when that element's
visible box is a drawn hole or ring, within 1 px.

| build | config | controls checked | lit exactly | not lit | other |
|---|---|---|---|---|---|
| v16 (published) | 1440, dark, en, mouse, Names | 33 | 19 | 14 | the cards step showed no pictures |
| v16 (published) | 390, light, en, touch | 32 | 17 | 15 | |
| v16.1 (work/xvta) | 390 · 1024 · 1440, light · dark, en · ru, mouse · touch (24 configs; Names in dark from 768 px) | 800 | 800 | 0 | pictures shown in 24 of 24; Names and the chain height restored after the tour in 24 of 24 |
