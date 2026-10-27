# Complex Map Workbench: how easy it is to use, and what to change

Build audited: the v16.4 merge (released as v16.4.1). Checked on laptops at 1280×800, 1366×768, 1440×900 and 1920×1080, and on Android phone sizes 412×860, 412×915, 360×780 and 915×412, in light and dark, English and Russian. Only ease of use is covered here. Speed is left out.

Nothing has been built. You choose first (section 4), and then we build.

Image links open the pictures in this folder. `shots/verify/…` are screenshots of today's build that were checked a second time. `mockups/…` are drawings of the options.

---

## 1. In one paragraph

On a laptop the app is capable and mostly easy to learn. Tool names are visible, tooltips are good, right-click menus are rich, and the docked tour teaches well. The trouble is the most common job, changing F, and the places where things hide. Adding a function quietly switches both planes to "that step alone". There is no Replace, so trying another F costs 5–9 steps. The right half of the header is a row of unlabelled icons. Shape editing and the display settings sit at the bottom of the left panel, below the fold. ⌘K finds functions but misses most other commands.

On a phone, the one-screen layout works and every main control is at least 44 px. The frame fails in specific places, though. The **+** and F buttons start off-screen. Landscape hides the tools and Undo under the chain bar. Android Back leaves the app, and a pinch on the header zooms the whole page. On the plane, fingers lose: handles are 7 px, you cannot pan when a shape fills the view, tools draw again over what you just drew, and a polygon can't be finished. A shape you select can't be edited where you are.

**The five biggest weak spots:**
1. Changing F: no Replace, and adding a step switches the planes to "alone".
2. The phone frame: **+** off-screen, landscape hides the tools, Back leaves the app, a pinch zooms the page.
3. Fingers and gestures on the plane.
4. Editing what you selected, on both devices.
5. Finding things: ⌘K misses most words, the header is unlabelled icons, and the phone help talks about a desktop.

---

## 2. Routine scorecard

**How steps are counted.** A step is a click, tap or key press, and typing a formula counts as one. On the laptop, "type, then Enter" counts as one step, as in the audit. A 0 means you can't do it, or nothing shows the way forward. **After** assumes the recommended options in section 4 plus the quick wins in section 5.

**Fine today, and unchanged:** switching views (2 / 2), inspecting a step or F (1 / 1), zeros and poles (2 / 2, though the phone long-press is not taught yet), playing the deformation on the laptop (1).

| Routine | Now: laptop / phone | What gets in the way | After: laptop / phone |
|---|---|---|---|
| First look: what is this, what do I do first | 0 / 0 | The only "what to do" is a pop-up card. The header is unlabelled icons. On the phone the big plane has no name. | seen at once / seen at once |
| Make F = sin z, starting from the opening example | 5 / 8 | No Replace. Clear chain is hidden. On the phone **+** is off-screen. The planes jump to "alone". | 3 / 3 |
| Replace one step with another function | 6 / 9 | No Replace: you remove the step and insert again. | 3 / 4 |
| Add a typed or LaTeX formula | 2 / 4 | On the phone **+** is off-screen. Afterwards the view switches to "alone". | 2 / 3 |
| Recover from a typo in a formula | 0 / 0 | The error gives no place and no fix, and Enter does nothing. | 1 / 1 |
| Step with a parameter *a*, then the slider or Play | 7 / 7 | The palette says "press Enter", and Enter does nothing. | 2 / 5 |
| Reorder or remove a step | 3 / 3, plus 3 per place | No keyboard move. The ⊕ is 18 px. Phone Remove is the last of 10 items. | 2 / 2, plus 1 per place |
| Undo and redo | 1 / 1, but missing on the phone in landscape, in sheets and during the deformation | Undo is silent. Phone Redo is hidden. In the middle of a construction, Undo deletes earlier work. | 1 / 1 everywhere, and it says what it undid |
| Draw a disc, then move or resize it | 4 / 3, and on the phone it often fails | The tool stays on, so the first fix draws a second disc. Handles are 7 px. | 2 / 2 |
| Draw a polygon | 5 / 6, and the phone can't close it | No Done, Cancel or "remove last point". The close radius is 9 px. | 5 / 5 |
| Region from a formula | 3 / 5 | On the phone the box is buried in More tools. The placeholder looks like typed text. | 3 / 4 |
| Type an exact centre or radius | 3 plus a scroll / 6 | The editor is low in the left list. On the phone there is no Edit for a selected shape. | 2 / 3 |
| Delete a shape | 2 / 2 (long-press, never taught) or 5 | | 2 / 2 |
| Change the pattern or opacity | 2 plus a scroll / 2 | The settings are below the fold on the laptop. | 2 / 2 |
| Pan when a shape fills the view | 1 / 0 | On the phone one finger moves the shape and two fingers only pinch. | 1 / 1 |
| Read F(z) at a point | hover, two chips 438 px apart / a hidden gesture with no F(z) | | one readout / hold and slide, showing z and w |
| Put a plane on the sphere and turn it | 2 / 2 | The switch is two unlabelled icons. A drag that starts on a region doesn't turn the sphere. | 2 / 2 |
| Expand one plane and come back | 2 / – | The other plane vanishes without a trace, and Esc does nothing. | 1–2 / – |
| See all sheets of √z | 2 / not measured | Only Landscape has All sheets, and nothing points to it. | 2 / 2 |
| Line through 2 points | 2, drag only / 2 | Click, then click again, fails silently. | 2 / 2 |
| Circle through 3 points | 4 / 5 | The prompt doesn't say what to pick. On the phone a slow tap opens the menu. | 4 / 4 (6 the first time) |
| Hyperbolic line | 5 / 6 | It has no name until it exists. "Inside" is a small icon. | 4 / 4 (6 the first time) |
| Cancel a half-finished construction | 1, but it deletes earlier work / 1 | Undo removes your earlier shape instead of the last pick. | 1 / 1 |
| Draw a target in Y and see its preimage | 3 / 3 | On the phone the note says "shaded on the left", but X is a 114 px inset. | 3 / 3, with clear wording |
| Integrate F along a curve | 2 / not measured | With nothing selected, ⌘K picks a curve for you. The result covers both planes. | 2 / 2 |
| Deform only some steps | 2 / 5 | The bracket has no label. On the phone it is behind the Display icon, with 12 px handles. | 2 / 3 |
| Change the deformation speed | 1 / 0 | On the phone the "1x" button does nothing. | 1 / 1 |
| Export a PNG | 4 / 4 | No "Save PNG" button. "For Overleaf" also replaces your clipboard. Phone targets are 22–34 px, and there is no Share. | 3 (2 the next time) / 3 |
| Export a video of the deformation | 4 / 5 | Video is listed only while the deformation is on. | 3 / 4 |
| Copy the figure's LaTeX | 2 / 4 | Three LaTeX items with near-identical names. | 2 / 3 |
| Copy a link, or open a scene file | 2 / not measured | They hide under a download icon called "Export images or LaTeX". | 2 / 3 |
| Turn on Hear the function | 3 / 4 | It is the fourth box under a 17 px caret, and nothing shows when it is on. | 2 / 2 |
| Listen along a curve, then stop | 2 plus Esc / 2 with no way to stop | It is not in the row menu, and there is no Stop button. | 2 plus Stop / 3 |
| Play the Grieg example | 4 / 5 | It is the last example and not marked as sound. Its hint disappears after 9 s. | 3 / 4 |
| Switch to the dark theme | 2 / 2 | On the laptop the theme button cycles without saying what comes next. | 2 / 2 |
| Resume the tour after a reload | 3 / 3 | Nothing on screen says the tour can be continued. | 1 / 1 |
| Look up a topic (export, add a zero) | 4–5 / not measured | ⌘K doesn't know help words. The guide has no contents and no search. | 2 / 3 |
| Open an example and know what to try | 2 / 3 | The "try this" half of the description is cut off, and gone once the example opens. | 2 / 3, and the hint stays |
| Start fresh with an empty canvas | 2 / 3 | "Empty canvas" hides in a menu whose button reads "Strip to disk". | 2 / 2 |

Two routines get longer the first time on the phone: the circle through 3 points and the hyperbolic line, because of the new Construct tab. After that the tool stays in the tool row. Every routine that is 0 today gets a path.

---

## 3. What is bad or suboptimal, by area

**How to read each item:** the ID, then the device (phone / laptop / both), then the severity (high / medium / low), then what happens and the fix.
- **Severity:** high means a common routine fails or loses work; medium costs steps or guessing; low is polish.
- **QW** marks a quick win that needs no decision (section 5).
- **D1–D12** point to a decision in section 4.
- **Restores** marks a fix that brings back one of your earlier rules, which the build breaks today.

### 3.1 First run and learning

- **UX21** · both · medium. **What happens:** on the first visit the tour invitation pops up as a card over Y and the Inspector. On the laptop it covers the Möbius title row and the Pattern legend; on the phone, the top of X, with 28 px buttons. **Fix:** the same invitation as one line in the tour's docked slot. **QW, restores** "docked strip, no pop-ups". (Only the laptop case was checked twice.) [`shots/verify/ux21_firstrun_1440.png`](shots/verify/ux21_firstrun_1440.png)
- **UX03** · both · high. **What happens:** ⌘K ("Add function or command") finds about 30 commands, but only by the exact words on their buttons. "theme" works and "dark" doesn't; "guide" works and "help" doesn't. export, png, examples, scene files, copy link and the drawing tools find nothing. "zero" first shows a red "Unknown function zero". **Fix:** index every action, tool, example and guide section, with synonyms. Show each command's key on its row, say "Enter to run" on actions, and raise formula errors only for input that looks like a formula. **QW** (about a day). [`mockups/laptop/L2-palette.png`](mockups/laptop/L2-palette.png) (b)
- **UX17** · phone · high. **What happens:** on the phone, the guide and in-app texts talk about a desktop: "the tools on the left", "the right pane", "Double-click", "Shift-click", "Right-click the circle", "Drag a card's header". The tour's touch text for *Add a function* says the last one too, and a phone cannot drag cards. **Fix:** touch versions of every sentence that names a place or a gesture, picked by the same touch check the tour uses. Hide "Palette and keys" on touch. **QW** (about a day).
- **UX26** · both · medium. **What happens:** the guide is a 2,600-word window with no contents and no search. Adding zeros is explained under "Branch cuts", Export and Examples have no section, and the keys list shows P twice. **Fix:** contents and search, new sections (Export, Examples, Zeros and poles), and a "Show me" button per section. **D7**
- **UX75** · both · medium. **What happens:** the strip's "Basics · 2 of 10" looks like a menu but only opens Why. Basics runs straight into Views. To jump to a chapter you end the tour and reopen Help. **Fix:** the chapter label becomes a menu (chapters with ✓ and minutes), and the end of a chapter says "Basics done ✓". **D7**
- **UX76** · both · medium. **What happens:** reload in the middle of the tour and it is gone, with nothing saying it can be continued. **Fix:** a line "Continue the tour: Views [Continue] [×]" in the docked slot. **D7**
- **UX41** · both · medium. **What happens:** an example's description is cut to one line ("Drag the red cut to move t…"), and it is gone once the example opens. **Fix:** two-line descriptions in the menu, and a "Try: …" line in the docked slot that stays until you act or close it. **D7**
- **UX40** · phone · medium. **What happens:** the long-press menus are good, but nothing teaches them, so "add a zero on the map" can't be found on a phone. **Fix:** tips inside sheets (under Add zero and Add pole, and on the Construct tab), plus one tour step. Never on the plane. **QW**
- **UX77** · laptop · medium. **What happens:** Why is open by default at 1280 px and wider, so the strip takes 157 px of the planes, and the strip's first line and Why repeat each other. **Fix:** start with it folded everywhere, rename it "Details", and edit the lines so Details adds something. **QW**
- **UX28** · both · medium. **What happens:** one thing has many names, so the help, the tour and the tooltips don't match what you see:
  - "3 points" vs "Circle through 3 points", and "Orthogonal" vs "Perpendicular circle";
  - "Add function or command", "Search functions and commands" and "Append to the chain";
  - "Draw" vs "Region tools";
  - Help, Reference guide and "Using the Workbench";
  - Clear, Clear chain, Clear the chain and Empty canvas;
  - in Russian, «Вид» means both Display and the view switch.

  **Fix:** one glossary applied to labels, tooltips, help and tour, in English and Russian. **QW** (about a day).
- **UX78** · both · medium (Russian). **What happens:** «Переходить дальше самому» reads as the opposite of "move on by itself". **Fix:** «Дальше автоматически». **QW**
- **UX89** · phone · low. **What happens:** during the tour, a tap outside the function list closes it, but also opens Why over X and stops the auto-advance. **Fix:** a tap that closes something does nothing else. **QW**
- **UX90** · both · low. **What happens:** the tour says "your work is kept", but what you draw during the tour is cleared. **Fix:** "Practice freely: what you draw here is cleared at the end, and your own work comes back." **QW**
- **UX93** · phone · low (Russian). **What happens:** the welcome title is cut («Добро пожаловать в Со…»), tool names break with hyphens, and the tour is called «Обзор». **Fix:** «Добро пожаловать», one-line tool names, and «Обучение» for the tour. **QW**

### 3.2 Adding and editing functions

- **UX01** · both · high. **What happens:** you add a function, and both planes jump to "f₃ alone". The left pane becomes the w₂-plane and your shape seems to vanish. Only the pane titles and a small "f₃ alone ×" chip change, and no message says why. Move and Duplicate do the same. This breaks "X on the left" and your redesign rule "Show alone is a separate choice". **Fix:** keep showing F, select the new card, and show a message "Added f₃ Sine · Show alone · Undo". No tour step depends on today's behaviour. **QW, restores.** [`shots/verify/ux01_after_add.png`](shots/verify/ux01_after_add.png)
- **UX02** · both · high. **What happens:** there is no way to replace F or a step. The palette only inserts, and the step menu offers the inverse and the derivative but not another function. "Clear chain" sits under the chain's ⋯ on the laptop and is reachable only through search on the phone. **Fix:** **D1**
- **UX16** · both · high. **What happens:** you type "z^2 + a" and the palette says "press Enter to add the number a", but Enter does nothing. The same text works in the Inspector. **Fix:** a normal row "f(z) = z² + a, with a new number a = 1", and Enter adds both as one undo. **QW** [`mockups/laptop/L2-palette.png`](mockups/laptop/L2-palette.png) (c)
- **UX23** · both · medium. **What happens:** a formula error doesn't say where or how to fix it ("Expected ')'", "Unexpected '^'"). The list and the preview go empty, and the footer still says "Enter to add". **Fix:** underline the bad spot, offer fixes as rows ("Close the bracket: sin(z)", "Did you mean sin z?"), and show it in grey, not red. **QW** (about a day). [`mockups/laptop/L2-palette.png`](mockups/laptop/L2-palette.png) (d)
- **UX22** · laptop · medium. **What happens:** at 1280 and 1366 px the words "Add function" appear nowhere: the header shrinks to a magnifier, and the + card's label is hidden at every laptop width. **Fix:** keep "Add function ⌘K" as text down to 1280 px, and show the card's label while the chain has 3 steps or fewer. **QW** (the card) and **D5**
- **UX29** · phone · medium. **What happens:** the phone function list has no visible close; you can only tap a thin band above it, and Back leaves the app. Its rows are 40 px. **Fix:** a 44 px Cancel in the search row, 48 px rows, and the insert position as a chip you can tap. **QW**
- **UX65** · both · medium. **What happens:** a new number is linked to nothing, and nothing says how to use it. Numbers also go by three names: Numbers, Parameters and Shared numbers. **Fix:** call them Numbers everywhere. An unused number shows "Not used yet [Use in f₁]", and each step's editor lists the numbers it uses. About a day, no decision needed.
- **UX32** · both · medium. **What happens:** placeholders look like typed text ("|z-1| < 2" in the region box, "a" for a new number). Add on an empty field is silent or shows a red error. **Fix:** placeholders in hint style ("e.g. |z−1| < 2"). Add on an empty field puts the cursor there and says what to type. A new number is prefilled with the next free letter as real text. No example chips, so your rule holds. **QW**
- **UX33** · both · medium. **What happens:** step fields are bare symbols (θ, k, n₃, a₁). θ also shows for steps that have no cut, and after you drag the cut on the map it shows a different value. **Fix:** a word before each symbol ("Cut angle θ", "Sheet ‹ 0 of 2 ›"), and θ only when there is a cut, kept in step with the map. **QW**
- **UX79** · both · low. **What happens:** Undo and Redo don't say what they did, and on the phone Redo is a hidden long-press on Undo. **Fix:** a message "Undid: add pole p₂ of f₁ · Redo", and tooltips that name the action. About a day.
- **UX81** · both · low. **What happens:** reordering is costly. On the laptop the ⊕ between cards is 18 px and shows only on hover, and there is no key for it. On the phone it takes 3 taps per place. **Fix:** Alt+←/→ moves a card; a 24 px ⊕ that also shows with the keyboard; ← → buttons in the phone step sheet. **QW**
- **UX82** · both · low. **What happens:** each palette row ends with seven letters "A E R P M Pr I" that are explained nowhere. **Fix:** drop them, and let the highlighted row name its property in words. **QW**
- **UX84** · both · low. **What happens:** an empty chain's F tile says "Möbius, Polynomial deg 1", and every typed step is called "Custom formula". **Fix:** "F = z" for an empty chain, and "Formula" as the type, with the formula itself only in the tooltip. **QW**
- **UX85** · both · low. **What happens:** "Show this step alone" is a magnifier icon, and the tour calls it "the lens". **Fix:** one name, "Show alone", an icon that is not a magnifier, and the label "Show F" while it is on. **QW**

### 3.3 Drawing regions

- **UX06** · both · high. **What happens:** after you draw, the tool stays on. Drag inside the disc you just drew and a second disc is drawn on top. **Fix:** **D9** [`shots/verify/ux06_laptop_drag_inside.png`](shots/verify/ux06_laptop_drag_inside.png)
- **UX07** · phone · high. **What happens:** tap a shape: rings appear, and nothing opens. Its fields hide behind the Region card, or under More, past 24 tool tiles, in Shapes. Long-press offers Hide and Delete but no Edit, and a formula region can't be selected by tapping at all. **Fix:** **D3** and **D6**; add "Edit…" to the long-press menu now. [`shots/verify/ux07_longpress_disc.png`](shots/verify/ux07_longpress_disc.png)
- **UX09** · phone · high. **What happens:** handles are 7–8 px. A drag that starts 10 px from the rim handle moves the view instead of resizing the disc. A line is picked only within 5 px. **Fix:** draw handles at 12 px and accept a grab within 22 px (zeros and poles already work this way), and pick lines within 16–20 px. **QW** [`shots/verify/ux09_disc_handles_zoom.png`](shots/verify/ux09_disc_handles_zoom.png)
- **UX14** · both · high. **What happens:** on the phone, the hint says "press Enter to close" (a phone has no Enter), and a tap 14 px from the first point adds a new point instead of closing. Undo is greyed out while you draw, and there is no Done or Cancel. On the laptop, Backspace and Undo don't touch the polygon you are drawing. **Fix:** on both devices, Undo (and Backspace) removes the last point and Enter closes. On touch, a tap within 24 px of the first point closes. Done and Cancel come with **D3**. **QW**
- **UX19** · laptop · medium. **What happens:** click a disc. Its editor opens at the bottom of the left list, with the centre field cut ("-1.384615 +"), while the Inspector keeps showing a step. Hide the left panel and there is no editor at all. **Fix:** **D4** [`shots/verify/ux19_select_disc_1440.png`](shots/verify/ux19_select_disc_1440.png)
- **UX18** · laptop · medium. **What happens:** pattern, cell, opacity and mesh are at the bottom of the left panel. At 1440×900 the "Display" heading sits on the bottom edge with nothing under it, and the mesh setting is 545 px below the window. **Fix:** **D4**
- **UX42** · both · medium. **What happens:** a new shape hides the fill of the shapes under it, and a covered shape can't be picked on the plane. **Fix:** the plane menu lists every shape under the pointer, with Bring to front and Send to back, and list rows can be dragged to reorder. About a day.
- **UX43** · both · medium. **What happens:** shape rows cut their description after about 100 px, tooltips show raw LaTeX, and shapes can't be renamed. **Fix:** two-line rows in rendered maths, a Rename item, and half-planes described in words. About a day.
- **UX44** · both · medium. **What happens:** coordinate fields are too narrow ("0. 216667 - ("). **Fix:** full-width fields, 4 significant digits until you click in, and digits of equal width. **QW**
- **UX45** · phone · medium. **What happens:** rows in the phone Shapes list are 32 px, and their eye and ⋯ buttons overlap. **Fix:** 48 px rows, with the two buttons side by side. **QW**
- **UX46** · phone · medium. **What happens:** "|z| < 1" takes about 12 presses across 3 keyboard pages. **Fix:** a strip of symbol keys above the keyboard while a formula field has focus. Symbols only, never templates, so your no-chips rule holds. About a day.
- **V01** · phone · medium (new). **What happens:** you draw a target in Y. The note says "Shaded on the left", but there is no left: X is the 114 px inset. Y's chip still says "Draw a target in the w-plane". **Fix:** say "Shaded in X (the inset)", pulse the inset once, update the chip, and put the note in the pane head, not over the plane. **QW** [`shots/verify/cp_phone_target_drawn.png`](shots/verify/cp_phone_target_drawn.png)
- **UX91** · both · low. **What happens:** your first small shape changes the checker size on everything (1 to 0.2), without a word. **Fix:** keep the size steady, or say why in the legend chip. **QW**
- **UX92** · both · low. **What happens:** the note "Unbounded: drawn about 200 view-widths out" shows for a bounded disc (|z+1| < 1, seen in the tour). **Fix:** show it only for unbounded regions. This looks like a bug: reproduce it outside the tour. **QW**
- **UX94** · both · low. **What happens:** Snap on and Snap off look almost the same, and moving a shape never snaps. **Fix:** the word "Snap", filled with the accent colour when on; a switch on the phone; and moves that snap too (hold Alt to move freely). **QW**
- **UX95** · both · low. **What happens:**
  - "Click … or press Enter" shows on touch screens;
  - the colours are named "Preset 1" to "Preset 8";
  - the phone sheet says "Display" twice;
  - "Clear shapes", which deletes all shapes, sits in one shape's menu.

  **Fix:** correct each of these. **QW**
- **UX96** · both · low. **What happens:** a closed polygon can't gain or lose points. **Fix:** double-click or double-tap an edge to add a point, and right-click or long-press a point to remove it. About a day.

### 3.4 Constructions

- **UX15** · both · high. **What happens:** you start a construction, pick a curve and a point, and press Undo. The disc you drew before it disappears. The picks stay, and no message says what went. **Fix:** while a construction has picks, Undo removes the last pick, as Backspace already does. **QW** [`shots/verify/ux15_after_cmdz.png`](shots/verify/ux15_after_cmdz.png)
- **UX48** · both · medium. **What happens:** the prompt counts picks ("Point 1 of 3 · 3 points") but doesn't say what to pick, and the how-to exists only in hover tooltips. **Fix:** "Click a point or an empty spot · 1 of 3", then "⌫ undo pick · Esc", and a small ? that unfolds the how-to. **QW**
- **UX47** · both · medium. **What happens:** Line and Segment need a drag. Click, then click again (as with "3 points") does nothing, and nothing says why. **Fix:** accept two clicks or taps as well, with a dashed preview between them. About a day.
- **UX49** · phone · medium. **What happens:** a slow tap on a point (350 ms or more) opens the plane menu instead of picking the point. **Fix:** during a construction, lifting the finger on a point picks it, however long you held. **QW**
- **UX50** · phone · medium. **What happens:** there is no preview on touch, and the only sign of a pick is an 8 px point turning magenta under your finger. **Fix:** numbered rings on the picked items, and a preview while your finger is down for the last pick. About a day.
- **UX51** · both · medium. **What happens:** the chip's options (Curve or Region, Whole or Inside) are 28 px icons. **Fix:** 44 px buttons with words, and a chip that may take two lines. **QW**
- **UX52** · both · medium. **What happens:** pick errors appear as messages at the bottom centre, far from the pointer, and stay after you change the tool. **Fix:** show them in the construction chip for 2 s, and clear them when the tool changes. **QW**
- **UX53** · both · medium. **What happens:** selecting a point doesn't show what is built on it. Delete then says "and 2 shapes built on it" without naming them. **Fix:** a "Used by" list, the dependent shapes drawn faint, and a message that names them. **D4** (laptop) and **D3** (phone)
- **UX54** · both · medium. **What happens:** deleting a point renames the others (z₁ becomes z₀), and zeros the same, so construction descriptions change. **Fix:** a point or zero keeps its number for life, and "Renumber points" is there when you want tidy names. About a day.
- **UX55** · both · medium. **What happens:** "Hyperbolic line" (new in v16.4) appears nowhere until you have made one. You must pick Orthogonal, then a 49×20 px "Inside" icon, and the result is called "Arc 1". The chip offers 2 choices and the Inspector 3. **Fix:** a "Hyperbolic line" tool, results named "Hyperbolic line 1", one description sentence, and the same 3 choices in both places. **QW**
- **UX56** · laptop · medium. **What happens:** right-click a point that lies on a curve, and the menu is about the curve ("Delete Arc 1", "Add point here"). **Fix:** the point comes first in the menu. **QW**
- **UX57** · phone · medium. **What happens:** the construction tools sit below the fold of the More sheet at 360×780 and in landscape. **Fix:** **D6**
- **UX100** · both · low. **What happens:** the circle kept for the next Orthogonal or Touching construction can't be seen or changed in the chip. **Fix:** show it in the chip as "on Circle 1 ×". **QW**
- **UX101** · both · low. **What happens:** for parallel lines the message is "The curves do not meet here", and an intersection that goes to infinity vanishes from the plane. **Fix:** "These lines are parallel: they meet only at ∞", and a hollow marker at the edge of the plane. **QW**

### 3.5 Views and navigation

- **UX08** · both · high. **What happens:** a drag that starts on a shape grabs the shape instead of moving the view. On the phone you can't pan when a shape fills X: a two-finger drag of 250 px moved the view 2.6 px. On the sphere, on both devices, a drag that starts on a formula region does nothing at all, although the chip says "Drag to turn". **Fix:** **D9** [`shots/verify/ux08_globe_before.png`](shots/verify/ux08_globe_before.png)
- **UX10** · both · high. **What happens:** on the laptop, the z and w values sit in two chips 438 px apart. On the phone you need a hold-and-slide that nobody teaches, and the chip then reads "z z 2.2885 − 2.7885i …", with no F(z) at all. With X expanded, F(z) is shown nowhere. **Fix:** one readout with two lines, "z = …" and "w = F(z) = …". The scale chip that is already there teaches the gesture until you first use it. **QW** [`shots/verify/ux10_phone_probe.png`](shots/verify/ux10_phone_probe.png)
- **UX20** · both · medium. **What happens:**
  - on the laptop, the "Pattern · cell 1 in z · left view" box sits inside Y;
  - "View outline / Phase key" and the Phase and Landscape option bars sit on the bottom edge of the picture;
  - after you draw a target, "Shaded on the left…" covers the top of Y, on the phone too.

  On the phone the pattern legend is only a small icon, which is fine. **Fix:** legends and one-time notes become short chips in the pane head (**QW, restores** "nothing covers the work"); the option bars move into the Display menu (**D4**).
- **UX27** · both · medium. **What happens:** the left plane has six names (X, z-plane, Domain plane, input plane, left plane, left view). On the phone the big plane shows only "z 2 / div", while the inset says Y. **Fix:** one pattern everywhere, "X · z-plane, domain of F" and "Y · w = F(z), image", and an X tag on the phone's chip. **QW**
- **UX37** · laptop · medium. **What happens:** Plane or Sphere is chosen with two unlabelled 30×22 px icons. **Fix:** "Plane | Sphere" as words (it fits at 1366 px, in Russian too). Your backlog item 1 asked for exactly this switch. **QW**
- **UX35** · laptop · medium. **What happens:** Esc does nothing to the deformation, an expanded plane, "f₁ alone" or a construction tool, although the construction chip says "Esc cancels". **Fix:** **D10**
- **UX36** · laptop · medium. **What happens:** expanding one plane hides the other without a trace, and the way back is the same 26 px icon. **Fix:** **D10**
- **UX39** · phone · medium. **What happens:** Y is a 114 px inset, so to see what F did you swap away from your drawing. **Fix:** **D8**
- **UX38** · phone · medium. **What happens:** the plane's buttons (Sphere, Display, Fit) move between the top and bottom corners from view to view. **Fix:** one fixed column at the bottom right. **QW**
- **UX66** · laptop · medium. **What happens:** a double-click on empty X turned a branch cut from 180° to 115.3° instead of zooming, with no message. **Fix:** a double-click zooms ×2, and the cut moves only by its handle. **QW**
- **UX67** · both · medium. **What happens:** "All sheets" exists only in Landscape's options; X → Y shows a bare "k" field. **Fix:** "Sheets ‹ 0 of 2 › · Show all sheets" in the step's editor. **QW**
- **UX86** · both · low. **What happens:** "Grid" means four different things: a tool, a pattern, a Phase style and grid lines. **Fix:** a name for each role. **QW**
- **UX105** · both · low. **What happens:** in the monospace font, "(" looks like "[" and "0.5" like "0. 5". The imaginary-axis labels are rotated, so "2i" reads "21". **Fix:** a different monospace font for inputs, and horizontal axis labels. The maths drawing does not change. **QW**
- **UX106** · phone · low. **What happens:** Landscape 3D uses only the middle 230×330 px of a portrait phone. **Fix:** fit the camera to the plane's height too. **QW**

### 3.6 Deformation, sound and export

**Deformation**
- **UX61** · phone · medium. **What happens:** the time slider is 106 px wide at 412 px and 72 px at 360 px. The range handles are 12×52 px, and one is past the screen edge. At 360 px the × is clipped: 32 of its 44 px can be tapped. **Fix:** **D11** [`shots/verify/ux61_deform_bar_360.png`](shots/verify/ux61_deform_bar_360.png)
- **UX62** · phone · medium. **What happens:** "1x" ignores taps, because the other speeds are hidden on phones. **Fix:** tapping cycles 1× → 2× → ½×. **QW**
- **UX63** · phone · medium. **What happens:** Loop, Order and the step range hide under the plane's Display icon, and that sheet covers the controls. **Fix:** **D11**
- **UX64** · laptop · medium. **What happens:** the range bracket is a thin line with no label, and after you bracket √ the title reads "f2(z) -> w deformation". **Fix:** label it "Deforming f₁–f₂" with an "All steps" reset, and put the title in words. About a day.
- **UX102** · laptop · low. **What happens:** during the deformation the tools turn grey, and clicking one only says "press M". **Fix:** a "Turn off and draw" button in that message. **QW**
- **UX103** · both · low. **What happens:** "t = 0.84 / 3" reads like a page count, the titles say "z -> w deformation", and Russian mixes "0,21" with "0.5x". **Fix:** "Step 1 of 3 · √ · 84 %", titles in words, and "0,5×". **QW**
- **UX104** · laptop · low. **What happens:** the play button's tooltip still says "Pause" after you click it. **Fix:** update it. **QW**

**Sound**
- **UX70** · both · medium. **What happens:** Hear the function is the fourth box under a 17 px caret, and nothing shows when it is on. **Fix:** "Hear F" as the first row, and a small wave on the Sound button while it is on. It stays off by default. **QW**
- **UX71** · both · medium. **What happens:** listening has no Stop button; on the phone, the 23-second Grieg piece can't be stopped at all. **Fix:** a Stop button in the listening chip. **QW**
- **UX72** · both · medium. **What happens:** "Listen along" exists only in the plane's menu. On the phone that means a long-press exactly on a 1–2 px line. **Fix:** add it to the shape row's ⋯ and to the selected curve's editor. **QW**
- **UX73** · laptop · medium. **What happens:** reading the code, playback along an ordinary curve stops as soon as the mouse moves 4 px, and nothing says why. **Fix:** play until the end, Stop or Esc. **QW** (check it by ear).
- **UX74** · both · medium. **What happens:** Grieg is the last example and not marked as sound, and its hint disappears after 9 s. **Fix:** a ♫ mark, and a hint that stays until you play or close it. **QW**
- **UX87** · laptop · low. **What happens:** the Sound settings caret is 17 px and touches the Sound button; aiming for it turns the sound off. **Fix:** a 24–28 px caret with a gap. **QW** and **D5**
- **UX88** · both · low. **What happens:** the sound menu ends with "Audio engine: running · 16 kHz…", and phones get keyboard help they can't use. **Fix:** move the engine line under "Diagnostics", and show no keyboard help on touch. **QW**

**Export**
- **UX11** · both · high. **What happens:** there is no plain Save. After you pick PNG, the buttons are "For Docs" and "For Overleaf", and neither has a tooltip. "For Overleaf" saves the file and replaces your clipboard with LaTeX, and you learn this only after the click ("✓ Saved · LaTeX copied"). **Fix:** **D12** [`shots/verify/ux11_export_dialog_png.png`](shots/verify/ux11_export_dialog_png.png)
- **UX31** · both · medium. **What happens:** one download icon mixes the figure, three LaTeX items with near-identical names, the link and the scene files, so "How do I open a scene file?" has no obvious answer. **Fix:** **D5** (laptop) and **D6** (phone)
- **UX58** · phone · medium. **What happens:** the phone gets the desktop export window. 18 of its 21 controls are under 44 px, typesetting settings come first, and the LaTeX box is below the fold. **Fix:** **D12**
- **UX59** · phone · medium. **What happens:** there is no Share on Android, and the message "Saved root-sin.pdf." doesn't say where the file went. **Fix:** **D12**
- **UX60** · both · medium. **What happens:** Video is listed only while the deformation is on. **Fix:** always list it; choosing it turns the deformation on. **QW**
- **V02** · phone · low (new). **What happens:** ⋯ → "Links, scenes and LaTeX" opens a desktop menu over the plane. It shows "⌘E", which a phone can't use, and greyed "again" items that give no reason. **Fix:** make it part of the ⋯ sheet, with no shortcuts on touch, and hide the "again" items until a first export. **D6**, or **QW** [`shots/verify/cp_phone_links_menu.png`](shots/verify/cp_phone_links_menu.png)

**Integration**
- **V03** · laptop · medium (new). **What happens:** with nothing selected, ⌘K "Integrate along the selected curve" picks a curve for you: the strip's edge, cut to the current view, so the value depends on the zoom. The result card covers the space between X and Y, with a stuck "Close Esc" tooltip. The plane menu calls the same thing "∮ F dz around Disc 1". **Fix:** with nothing selected, ask "Pick a curve to integrate along"; use one name in both places; show the result in the Inspector or beside the curve in X, never over its image. **QW** [`shots/verify/cp_integrate_nosel.png`](shots/verify/cp_integrate_nosel.png)

### 3.7 The phone shell

- **UX04** · phone · high. **What happens:** the **+** (Add function) and the F tile start off-screen, at x 532 and 586 on a 412 px screen, and the f₁ label is cut to "Exponenti". **Fix:** **D2** [`shots/verify/ux04_phone_412x860.png`](shots/verify/ux04_phone_412x860.png)
- **UX05** · phone · high. **What happens:** turn the phone sideways (915×412). Undo, Select, Point, Disc, Polygon, More, **+** and F all sit hidden under the chain bar. A tap on the empty band still picks Disc, with nothing shown, and the tour's "Choose Disc" step can't be done. This breaks "Undo at the thumb". **Fix:** **D2** [`shots/verify/ux05_landscape_915x412.png`](shots/verify/ux05_landscape_915x412.png)
- **UX12** · phone · high. **What happens:** Android Back leaves the app instead of closing the open sheet, list, window or tour. **Fix:** Back closes the top layer and you stay in the app. **QW**
- **UX13** · phone · high. **What happens:** a pinch on the header, chain bar or tool row zooms the whole page (to 5× in the test), and getting back means a pinch on the thin chain strip. This breaks "one screen". **Fix:** stop page zoom on the app's own controls; the planes keep their own pinch. **QW, restores**
- **UX24** · phone · medium. **What happens:** Undo is covered while a sheet is open, and gone during the deformation. This breaks "Undo at the thumb". **Fix:** Undo in every sheet head and in the deformation bar. **QW, restores** [`shots/verify/ux24_editor_sheet.png`](shots/verify/ux24_editor_sheet.png)
- **UX34** · both · medium. **What happens:** tooltips stick. After you tap **+** on the phone, "Add a function +" stays over the plane. On the laptop, after an add, the + card's tooltip covers "Whole chain". **Fix:** on touch, tooltips appear only on a long-press and go when you lift; on the laptop, only on hover. **QW, restores**
- **UX68** · phone · medium. **What happens:** rotating the phone closes the open sheet and drops the field you were typing in. **Fix:** reopen the same sheet and put the cursor back in the same field. **QW**
- **UX69** · phone · medium. **What happens:** the on-screen keyboard isn't taken into account. Fields low in a sheet (the Numbers name, at y 550 of 915) can end up under it. The code confirms this, but it hasn't been seen on a real phone yet. **Fix:** when a field gets focus, grow the sheet, scroll the field up, and keep it above the keyboard. About a day.
- **UX83** · phone · low. **What happens:** phone card pictures show clipped text, "lo shape". **Fix:** drop the text. **QW**

### 3.8 The laptop shell

- **UX30** · laptop · medium. **What happens:** the right half of the header is seven 28 px icons, found by hovering one by one. Theme cycles Auto → Light → Dark without saying what comes next. **Fix:** **D5**
- **UX25** · laptop · medium. **What happens:** the Examples button is named after the open example ("Strip to disk", later "Empty canvas"); in English the word "Examples" never shows. Opening an example replaces your work without a message. **Fix:** a fixed "Examples ▾" label, "New" first in its list, and a message "Opened Strip to disk · Undo". **QW** and **D5**
- **UX80** · both · low. **What happens:** messages land on controls: X's zoom buttons on the laptop, the inset's swap key and Fit on the phone. **Fix:** on the laptop, show messages above the chain, between the planes' button columns; on the phone, above the chain bar. **QW, restores**
- **UX97** · laptop · low. **What happens:** common keys are missing. There is no ⌘D and no arrow nudge. Nothing reorders steps or plays the deformation from the keyboard (Space pans), and P changes meaning while it runs. **Fix:** add these keys and show them in tooltips. **QW**
- **UX98** · laptop · low. **What happens:** Tab walks about 45 stops, including 26 tools, before it reaches the planes. **Fix:** arrow keys inside each grid of buttons, and F6 to jump between areas. About a day.
- **UX99** · laptop · low. **What happens:** right-click works on the planes but not on chain cards or shape rows. **Fix:** right-click opens the same ⋯ menu at the pointer. **QW**

---

## 4. Decisions for you

There are twelve choices. For each, the recommended option comes first.

**Effort:** S is hours, M about a day, L several days.

**What every option keeps.** Every option below keeps:
- X on the left and Y on the right;
- nothing covering the work unless you open it;
- the tour as a docked strip, with its completion conditions and the 3 s auto-advance;
- no "No shapes yet" banner, no example chips, no always-on Select hint;
- pattern descriptions as tooltips;
- chain cards as type plus picture;
- big Add zero and Add pole buttons;
- one F tile;
- the phone as one screen with sheets;
- sound on, with Hear F off.

**Light and dark.** The mockups are drawn in light. Every option uses the app's existing colour tokens, so dark comes along, but each built option still gets a dark screenshot check. Where the tour or Russian needs work, the option says so.

**Overview.**

| # | Choice | Device | Recommended |
|---|---|---|---|
| D1 | Replacing F or a step | both | A: the palette offers Replace as well as Insert |
| D2 | The phone's bottom area | phone | A: pinned **+** and F; a tool column on the right in landscape |
| D3 | Finishing what you selected or started | phone | A: one context bar above the tool row |
| D4 | Where you edit a shape and set the display | laptop | A: the Inspector follows the selection; a Display button on each plane |
| D5 | The header | laptop | A: buttons with words, one Settings menu |
| D6 | More tools, the ⋯ menu and search | phone | A: a Tools sheet with tabs; a grouped Menu with search |
| D7 | Learning | both | A: the tour's docked slot also holds the first-run, resume and example lines |
| D8 | Seeing Y | phone | A: a "Both" button |
| D9 | Gestures on the plane | both | A: two fingers always move the view; the selected shape wins one finger |
| D10 | Modes and the way back | laptop | A: a mode chip in the pane head, and Esc steps out one level at a time |
| D11 | The deformation bar | phone | A: two rows |
| D12 | Export | both | A: Save first; Share first on the phone |

### D1. Replacing F or a step (both: UX02, UX16, UX84, UX85)

Today the palette only inserts. Trying another F means clearing the chain or removing steps, and Clear chain is hidden.

- **A (recommended). The palette replaces as well as inserts.**
  - *What you see:* type "sin z" while F has steps. The palette lists "Replace F with sin z", "Insert sin z after f₂" and "Replace f₂ Möbius with sin z". A chip in the search row switches between them (Tab) and remembers your last choice. "Replace…" is the first item in the card's ⋯ menu, and clicking the Inspector's title ("Möbius ▾") opens the palette ready to replace that step. "Clear chain" shows as text in the chain head.
  - *Solves:* F = sin z goes from 5 / 8 steps to 3 / 3, and replacing one step from 6 / 9 to 3 / 4.
  - *Costs:* one more row in the palette. Nothing moves.
  - *Effort:* M.
  - *Mockup:* [`mockups/laptop/L2-palette.png`](mockups/laptop/L2-palette.png) (a).
  - *Keeps:* the tour already listens for a replaced step, so a "Replace a step" task is cheap to add. Russian is about 10 strings, and the chip «Вставить после f₂ ▾» (about 150 px) fits.
- **B. An editable "F(z) = …" line above the chain.**
  - *What you see:* type a formula there and press Enter, and it replaces the whole chain, with the existing offer to split it into steps.
  - *Solves:* replacing F, but not replacing one step.
  - *Costs:* a formula line above the cards, which comes close to your "no formula on cards" rule.
  - *Effort:* M.
- **C. The smallest change.**
  - *What you see:* each card's type becomes a dropdown ("f₁ Exponential ▾") that opens the palette to replace that step, and Clear chain becomes visible.
  - *Costs:* replacing F still means Clear chain plus Add.
  - *Effort:* S.

### D2. The phone's bottom area (phone: UX04, UX05, UX24, UX83)

Today **+** and F start off-screen. In landscape the tools and Undo are hidden. Undo also disappears when a sheet is open or the deformation runs.

- **A (recommended). Pinned ends, and a tool column in landscape.**
  - *What you see:* compact cards (88×52 px) scroll between Numbers and a pinned **+ | F** pair. In landscape the tools become a column on the right edge, with Undo at the bottom under your right thumb, and the chain bar gets the full width. Undo also sits in every sheet head and in the deformation bar.
  - *Solves:* UX04, UX05, UX24 and UX83.
  - *Costs:* in landscape each plane is about 30 px narrower.
  - *Effort:* M.
  - *Mockups:* [`mockups/phone/s1-bottom-zone-portrait.png`](mockups/phone/s1-bottom-zone-portrait.png) (middle) and [`mockups/phone/s1-bottom-zone-landscape.png`](mockups/phone/s1-bottom-zone-landscape.png) (B).
- **B. Pinned ends, and one shared bar in landscape.**
  - *What you see:* portrait as in A. In landscape the chain and the tools share one bar.
  - *Costs:* in landscape the deformation slider gets only about 330 px.
  - *Effort:* S.
  - *Mockup:* [`mockups/phone/s1-bottom-zone-landscape.png`](mockups/phone/s1-bottom-zone-landscape.png) (A).
- **C. A mode dock.**
  - *What you see:* Undo plus four tabs: Draw, Chain, Numbers, Deformation.
  - *Costs:* the chain is no longer visible while you draw, every routine starts with picking a tab, and it changes the layout you approved. Not recommended.
  - *Effort:* L.
  - *Mockup:* [`mockups/phone/s1-bottom-zone-portrait.png`](mockups/phone/s1-bottom-zone-portrait.png) (right).
- *Keeps:* with A or B, the tour's "Add a function" step lights the pinned **+**, and "Choose Disc" works in landscape again. In landscape the tour strip stays in the header, where it is today. In Russian, «Отмена» fits a 60 px button; «Деформация» may need «Деформ.».

### D3. Phone: finishing what you selected or started (UX07, UX14, UX15, UX48, UX51, UX52, UX53, UX71, UX72, UX100)

Today a tapped shape opens nothing. A polygon can't be finished, and a construction doesn't say what to pick. Listening along a curve can't be stopped.

- **A (recommended). One context bar.**
  - *What you see:* a 56 px bar above the tool row, only while something is selected or under way.
    - A selected shape shows its name and definition, with **Edit**, **Delete** and ⋯ (Listen along, Integrate, Hide, order).
    - A polygon shows "⌫ Last", **Done** and Cancel.
    - A construction shows what to pick next, "Undo pick", ? and ×, with options as worded buttons.
    - Listening shows **Stop**.

    The plane shrinks from the bottom, so your drawing doesn't move.
  - *Solves:* the 10 findings above.
  - *Costs:* the plane loses 56 px while something is selected.
  - *Effort:* M.
  - *Mockup:* [`mockups/phone/s2-context-bar.png`](mockups/phone/s2-context-bar.png).
  - *Keeps:* it is not an always-on hint, because it exists only while something is selected or under way. The Basics steps of the tour can light Edit, Done and Undo pick. In Russian at 360 px, the polygon state leaves about 140 px for its text: two short lines.
- **B. No bar; a second tap opens the editor.**
  - *What you see:* long-press gains "Edit…", and the chips on the plane get 44 px buttons.
  - *Costs:* the second tap must be taught, and the buttons stay on the plane, against "nothing covers the work".
  - *Effort:* S–M.
- **C. Selecting opens the Shapes sheet at that shape's row.**
  - *Costs:* X and Y shrink every time you tap a shape.
  - *Effort:* M.

### D4. Laptop: where you edit a shape and set the display (UX18, UX19, UX20, UX44, UX53, UX67)

Today a selected shape is edited at the bottom of the left list, and the display settings are below the fold. A legend box sits on Y.

- **A (recommended). The Inspector follows the selection; a Display button on each plane.**
  - *What you see:*
    - The Inspector edits whatever you last selected: a shape, point, construction, step or F. Shape fields are full width, there is a "Used by" list, and "‹ Back to f₂" returns to the step.
    - Each pane head gets a "Display ▾" button: pattern, cell size, opacity, unit circle, mesh, and that view's Phase or Landscape options.
    - The legend becomes a small chip in the pane head.
    - The left panel keeps the tools on top and a one-line formula box, and Shapes fill the rest.
  - *Solves:* the 6 findings above, and the phone and laptop now share one Display model.
  - *Costs:* while a shape is selected you don't see the step; one click on its card brings it back.
  - *Effort:* M.
  - *Mockups:* [`mockups/laptop/L1-recommended-1366.png`](mockups/laptop/L1-recommended-1366.png) (items 7, 9, 13) and [`mockups/laptop/L4-left-panel-options.png`](mockups/laptop/L4-left-panel-options.png) (A).
- **B. Tabs in the left panel: Draw | Shapes | Display.**
  - *What you see:* selecting a shape opens its editor in the Shapes tab. The Inspector stays for steps.
  - *Costs:* you can't see the tools and the list together, and Display sits far from the plane it changes.
  - *Effort:* M.
  - *Mockup:* [`mockups/laptop/L4-left-panel-options.png`](mockups/laptop/L4-left-panel-options.png) (B).
- **C. The smallest change.**
  - *What you see:* selecting a shape opens the left panel and scrolls its row into view. Display folds right under Draw, with a one-line summary.
  - *Costs:* the fields stay narrow.
  - *Effort:* S.
- *Keeps (A and B):* tour steps that light the Display section, the pattern grid or the Shapes list need new targets, and steps that say "the Shapes list edits them" need new text. In Russian the button is «Оформление ▾» (not «Вид»), and «Плоскость | Сфера» fits at 1366 px. Pattern descriptions stay tooltips.

### D5. Laptop: the header (UX22, UX25, UX30, UX31, UX87, and the way into UX11)

Today the right half of the header is seven unlabelled icons. The Examples button carries the example's name, and the Sound caret is 17 px.

**Whatever you choose:** ⌘K finds everything (UX03), and **?** keeps opening the tour with its chapter list (your backlog item 12). The guide and a search field are added inside that list.

- **A (recommended). Buttons with words.**
  - *What you see:* "Examples ▾" (the open example's name muted beside it), "Add function ⌘K", "Export ▾" (figure, "Save … again", LaTeX of F), "Share ▾" (Copy link, Save scene, Open scene), "Sound | ▾" with a real caret, ⚙ Settings (Theme Auto / Light / Dark, Language, sound settings, show or hide the panels), and ?.
  - *Costs:* theme and language move from 1 click to 2.
  - *Effort:* M.
  - *Mockups:* [`mockups/laptop/L3-header-options.png`](mockups/laptop/L3-header-options.png) (A) and [`mockups/laptop/L1-recommended-1366.png`](mockups/laptop/L1-recommended-1366.png) (items 1–4).
- **B. A menu bar: File, Edit, View, Insert, Help.**
  - *Solves:* every command gets a named home, and the menus teach the keys.
  - *Costs:* one more level for everything, and it feels like desktop software.
  - *Effort:* L.
  - *Mockup:* [`mockups/laptop/L3-header-options.png`](mockups/laptop/L3-header-options.png) (B).
- **C. Today's icons, plus the phone's ⋯ sheet at the end.**
  - *Costs:* the icons stay unlabelled, and things live in two places.
  - *Effort:* S.
  - *Mockup:* [`mockups/laptop/L3-header-options.png`](mockups/laptop/L3-header-options.png) (C).
- *Keeps:* the Russian header at 1280 px must be measured before building; if it doesn't fit, Share becomes an icon at that width. The tour steps that light Examples, Export, Help, the palette and Sound get their new targets.

### D6. Phone: More tools, the ⋯ menu and search (UX02, UX03, UX07, UX25, UX55, UX57, UX70, UX74, V02)

Today More tools is 24 tiles, then Construct below the fold, then your shapes at the very bottom. ⋯ is one flat list, and Clear chain and "New" can't be seen anywhere.

- **A (recommended). Two named sheets and one search.**
  - *What you see:*
    - **More** opens Tools with three tabs: Draw, Construct (with a Hyperbolic line tool) and Shapes 3. Each tab fits without scrolling at 360×780, the sheet reopens on your last tab, and the More button shows the shape count.
    - **⋯** opens a Menu grouped by task, with a search field on top: Scene (New, Examples, Share or save), Figure, Sound (with Hear F), Help and Look.
  - *Costs:* the first construction takes one more tap (the Construct tab).
  - *Effort:* M.
  - *Mockup:* [`mockups/phone/s3-tools-and-menu-sheets.png`](mockups/phone/s3-tools-and-menu-sheets.png). Keep today's inline Auto / Light / Dark for Theme, not the ▸ the mockup shows.
- **B. A search field at the top of both sheets.**
  - *What you see:* Shapes moves above the tiles. Nothing else changes.
  - *Costs:* finding still depends on knowing the word, and Construct stays below the fold at 360 px.
  - *Effort:* M.
- **C. Reorder only.**
  - *What you see:* Shapes first, then Construct, then Draw. New and Clear chain become rows in ⋯.
  - *Effort:* S.
- *Keeps:* tour steps that pick a tool from More open the right tab first. In Russian the tabs «Рисование | Построения | Фигуры» fit 3 × 120 px; use «Оформление» for Look.

### D7. Learning (both: UX26, UX41, UX74, UX75, UX76, UX77, and UX40 and UX17 in part)

Today nothing offers to continue the tour after a reload. An example's "try this" is lost, the strip has no chapter list, and the guide has no contents.

- **A (recommended). One learning lane in the tour's own slot.**
  - *What you see:* the slot the tour already uses holds these lines, one at a time, each closable:
    - "New here? A 2-minute tour [Start the tour] [Not now]";
    - "Continue the tour: Views [Continue] [×]" after a reload;
    - an example's "Try: drag the red cut in X [Show me] [×]", with Listen as the button for Grieg.

    The slot is the top row of the stage on the laptop, a row under the header on a phone held upright, and the header itself in phone landscape. The strip's label becomes a chapter menu, Details starts folded, and the guide gets contents, search, new sections and "Show me" buttons. On the phone, tips go inside sheets.
  - *Costs:* nothing for people who skip learning: the lane stays empty unless something is offered, and × ends a line for good.
  - *Effort:* M.
  - *Mockups:* [`mockups/laptop/L5-learning-lane-and-modes.png`](mockups/laptop/L5-learning-lane-and-modes.png) (1–4) and [`mockups/phone/s4-s5-both-and-learn-slot.png`](mockups/phone/s4-s5-both-and-learn-slot.png) (left, middle).
  - *Keeps:* no pop-ups and nothing over the work. Each line appears once, for a reason. The space the strip needs is already reserved by the app's layout. Russian is about 20 strings, and the tour becomes «Обучение».
- **B. A "Learn" place.**
  - *What you see:* on the laptop, a Learn tab next to the Inspector; on the phone, a ? button that opens a Learn sheet with chapters, examples, a Gestures card and the guide.
  - *Costs:* it reaches no one who doesn't open it, and it competes with the Inspector for space.
  - *Effort:* M–L.
- **C. A Help hub that opens on ?.**
  - *What you see:* search, chapters, examples and keys in one place. There are no lines for first run, resume or examples.
  - *Effort:* M.

### D8. Phone: seeing Y (UX39; UX10, UX27 and UX38 come along)

Today Y is a 114 px inset, and to see what F did you swap away from your drawing.

**Whatever you choose:** the plane's buttons sit in one fixed column at the bottom right, the big plane's chip starts with X (or Y after a swap), and the readout shows z and w = F(z).

- **A (recommended). A "Both" button.**
  - *What you see:* it shows X above Y (each about 341 px tall at 412×860) without opening a sheet, and the choice is remembered. The inset stays the default.
  - *Effort:* S–M.
  - *Mockup:* [`mockups/phone/s4-s5-both-and-learn-slot.png`](mockups/phone/s4-s5-both-and-learn-slot.png) (right).
  - *Keeps:* "one plane with a live inset" stays the default, as you decided. Each plane keeps its own zoom when you switch Both on or off (your backlog item 25). In Russian, «Обе» fits a 44 px button.
- **B. A resizable inset.**
  - *What you see:* drag the inset's corner to make it bigger.
  - *Costs:* the gesture is hidden, and a bigger inset covers more of X.
  - *Effort:* M.
- **C. Double-tap the inset to show both planes.**
  - *Costs:* the gesture is hidden, and every single-tap swap gets slower.
  - *Effort:* S.

### D9. Gestures on the plane (both: UX06, UX08, UX09, UX49)

Today drawing tools draw over the shape you just drew, a drag that starts on a shape can't move the view, and the sphere doesn't turn over a region.

- **A (recommended). Two fingers always move the view; the selected shape wins one finger.**
  - *What you see:*
    - Two fingers pan and pinch with every tool, on the plane and on the sphere.
    - With any drawing tool, a press on the shape you just drew moves or reshapes it, and a press elsewhere draws. On the laptop, Alt forces drawing.
    - On touch, the first tap on a shape only selects it.
    - On the sphere, a drag turns it unless it starts on a handle or on the selected shape. On the laptop, Space-drag always turns it.
    - The outer 16 px of a phone plane only pans, so Android's Back gesture never cancels half a shape.
  - *Costs:* nothing to unlearn.
  - *Effort:* M.
  - *Keeps:* no new hint line. Only the sphere chip that is already there gains "two fingers turn" (phone) or "Space turns" (laptop). The tour's "Drag the sphere to turn it" works over a region.
- **B. One-shot tools.**
  - *What you see:* after one shape the tool goes back to Select. Double-click or long-press a tool to keep it on.
  - *Costs:* fixes only the redraw problem, and drawing several discs needs the lock.
  - *Effort:* S.
- **C. A "Move view" button in the tool row.**
  - *Costs:* fixes only phone panning, and adds a mode to forget.
  - *Effort:* S.

### D10. Modes and the way back (laptop: UX35, UX36, and UX71, UX85, UX102 in part)

Today "f₁ alone", an expanded plane, the deformation and listening each look different and sit in different places. Esc leaves none of them.

- **A (recommended). A chip in the pane head, and Esc one level at a time.**
  - *What you see:* each active mode is one chip at the right end of the pane head, with its key and ×: "Showing f₂ alone Esc ×", "Y hidden Esc ×", "Deformation M ×", "Listening along Spiral Stop". A hidden plane stays visible as a labelled strip at the edge. Each Esc press closes one level: a menu, then the picks, the selection, the tool, "alone", the expanded plane, the deformation.
  - *Effort:* S–M.
  - *Mockup:* [`mockups/laptop/L5-learning-lane-and-modes.png`](mockups/laptop/L5-learning-lane-and-modes.png) (5).
  - *Keeps:* the tour already lets the app's Esc act first. The new modes must report themselves to the tour as busy, so that Esc leaves them before it ends the tour.
- **B. A mode bar under the header.**
  - *Costs:* the planes jump when it appears.
  - *Effort:* M.
- **C. A trail in the pane title ("F › f₁ alone").**
  - *Solves:* only "alone" and the expanded plane.
  - *Effort:* S.

### D11. Phone: the deformation bar (UX61, UX62, UX63, UX103, and UX24 in part)

Today the time slider is 72–106 px wide, the range handles are 12 px, speed can't be changed, and the settings hide behind the Display icon.

- **A (recommended). Two rows.**
  - *What you see:* row 1 is a full-width time slider showing the steps, with "f₂ · 24 %" on the handle. Row 2 has Undo, Play, speed (tap to cycle), Paths, "Steps f₁–f₂ ▾" (a picker in place of the 12 px handles, which also holds Order and Loop) and ×.
  - *Costs:* the plane gives up about 44 px while the deformation is on.
  - *Effort:* M.
  - *Mockup:* [`mockups/phone/s6-s7-deformation-export.png`](mockups/phone/s6-s7-deformation-export.png) (left).
  - *Keeps:* it still fits one screen. In Russian, «Шаги f₁–f₂ ▾» and «0,5×» fit. With D2 A, landscape gives the time slider the full width and the tool column keeps Undo.
- **B. One row with a ⋯.**
  - *What you see:* Play, a 220 px slider, and a ⋯ holding speed, Paths, Steps, Order and Loop.
  - *Effort:* S.
- **C. A Deformation sheet.**
  - *What you see:* a sheet with all the controls, and X and Y above it.
  - *Costs:* the planes shrink whenever you play.
  - *Effort:* M.

### D12. Export (both: UX11, UX58, UX59, UX60, and UX31 in part)

Today there is no Save button: the buttons say "For Docs" and "For Overleaf". The phone gets the desktop window, and there is no Share.

- **A (recommended). Save first; Share first on the phone.**
  - *What you see, on the laptop:* the main button names the format: "Save PNG", "Save PDF", "Save SVG", "Save video". "Copy image" sits beside it, and Overleaf becomes a second button that says both things it does ("Save + copy LaTeX for Overleaf"). The last format is remembered, the file is named after F or the scene, and Video is always listed.
  - *What you see, on the phone:* a bottom sheet with the preview, the format, **Share PNG…**, Save to Downloads, Copy LaTeX, and Print settings folded. The message says "Saved to Downloads: …".
  - *Costs:* people used to "For Overleaf" find it one place to the left, with a longer name.
  - *Effort:* M.
  - *Images:* today [`shots/verify/ux11_export_dialog_png.png`](shots/verify/ux11_export_dialog_png.png); the phone mockup [`mockups/phone/s6-s7-deformation-export.png`](mockups/phone/s6-s7-deformation-export.png) (right).
- **B. Keep the destinations.**
  - *What you see:* "For Overleaf" stays the main button, with the subtitle "Saves the PNG and copies the LaTeX". The phone gets the same window with 44 px controls, plus Share where the browser has it.
  - *Effort:* S.
- **C. Destination tabs: File, Clipboard, Overleaf, Video.**
  - *Costs:* one more choice before the format.
  - *Effort:* M.
- *Keeps:* the exported figure itself does not change. The tour's Export steps that light For Overleaf and For Docs get the new buttons as targets. In Russian, «Сохранить PNG» and «Поделиться PNG…» fit, and the footer may take two lines.

---

## 5. Quick wins that need no decision

Each is a few hours unless marked "a day". The first group brings back rules you set, which the build breaks today.

**Bring back your rules**
- **UX01** After Add, Move or Duplicate, keep showing F. A message offers "Show alone · Undo".
- **UX21** The first-run invitation becomes a line in the tour's docked slot, not a card.
- **UX20 and V01** Legends and one-time notes move to the pane head. The phone wording becomes "Shaded in X (the inset)".
- **UX24** Undo in every phone sheet head and in the deformation bar.
- **UX13** A pinch on the phone's own controls no longer zooms the page.
- **UX34** Tooltips no longer stick after a tap or an add.
- **UX80** Messages no longer cover the zoom buttons, the inset or Fit.

**Phone frame**
- **UX12** Back closes the open sheet or list instead of leaving the app.
- **UX29** The function list gets a Cancel button and 48 px rows.
- **UX68** Rotating the phone keeps the open sheet and your field.
- **UX38** The plane's buttons stay in one fixed column.
- **UX62** The speed button cycles.
- **UX45** Shape rows are 48 px, with the buttons side by side.
- **UX83** No clipped text on card pictures.
- **UX49** A slow tap still picks a point.
- **UX40** Long-press tips inside sheets and the tour.
- **UX106** The 3D landscape fills a portrait phone.

**Functions**
- **UX16** "z^2 + a" offers "with a new number a".
- **UX23** Formula errors show the bad spot and offer fixes (a day).
- **UX03** ⌘K finds commands, tools, examples and help, with synonyms (a day).
- **UX32** Placeholders look like hints.
- **UX33** Step fields get words before their symbols.
- **UX81** Alt+arrow keys move a step; ← → buttons on the phone.
- **UX82** No more guarantee letters in the palette.
- **UX84** "F = z" for an empty chain, and "Formula" as the type.
- **UX85** One name: "Show alone".
- **UX22** The + card says "Add function".

**Drawing and constructions**
- **UX15** Undo removes the last pick, not earlier work.
- **UX14** Undo or Backspace removes the last polygon point; Enter closes; a 24 px close radius on touch.
- **UX09** Bigger handles, and a wider grab area for handles and lines.
- **UX44** Wider coordinate fields.
- **UX48, UX51, UX52** The construction chip says what to pick, uses worded buttons and shows its own errors.
- **UX55** A Hyperbolic line tool, and results named for what they are.
- **UX56** A point comes first in its right-click menu.
- **UX100** The kept circle shows in the chip.
- **UX101** "These lines are parallel."
- **UX91** The checker size stays steady when you draw.
- **UX92** "Unbounded" shows only for unbounded regions.
- **UX94** Snap clearly shows whether it is on.
- **UX95** Wording fixes in the region tools.

**Views**
- **UX10** One readout with z and w = F(z).
- **UX27** One name per plane.
- **UX37** "Plane | Sphere" in words.
- **UX66** Double-click zooms instead of turning a cut.
- **UX67** "Show all sheets" from the step's editor.
- **UX86** "Grid" gets a different name for each of its uses.
- **UX105** Clearer parentheses and axis labels.

**Deformation, sound and export**
- **UX60** Video always listed.
- **UX70** Hear F findable, with a sign when it is on.
- **UX71** A Stop button.
- **UX72** Listen along in the shape menus.
- **UX73** A mouse nudge doesn't stop playback.
- **UX74** Grieg marked ♫, and its hint stays.
- **UX88** Sound menu text tidied.
- **UX102** "Turn off and draw" during the deformation.
- **UX103** The deformation readout in words.
- **UX104** The play button's tooltip updates.
- **V02** Phone links menu tidied.
- **V03** Integrate asks which curve, and its result no longer covers the planes.

**Words and help**
- **UX17** Touch wording in the phone guide and tour (a day).
- **UX28** One glossary, English and Russian (a day).
- **UX25** A fixed "Examples ▾" label, with an Undo message after opening one.
- **UX77** Details folded by default.
- **UX78, UX93** Russian fixes.
- **UX89** A tap that closes something does nothing else.
- **UX90** Honest wording about what the tour keeps.

**Laptop keys**
- **UX97** Missing shortcuts added.
- **UX99** Right-click on cards and shape rows.

**Order:** start with UX01, UX15, UX16, UX12, UX13, UX34 and UX14. They fix the worst moments of the most common routines.

---

## 6. What already works well and stays

- **The docked tour strip.** It makes room instead of covering the planes, lights the exact control, confirms results in words, and auto-advances after 3 s, with mouse and with touch.
- **The phone's one-screen layout.** There is no page scroll, every main control is at least 44 px, and X | Y sit side by side above an open sheet.
- **Picking from More tools.** Choosing a tool closes the sheet and puts the tool in the tool row.
- **The function search and formula recognition.** "sin z" finds Sine, LaTeX Möbius is recognised, the live preview works, and the "Add as 2 steps" offer is one undo.
- **Zeros and poles.** Big Add buttons, right-click and long-press menus with coordinates, one-finger drag, and Undo messages.
- **The F tile.** It opens the whole map (formula, steps, guarantees, domain, Copy) in one click.
- **Construction feedback on the laptop.** The snap ring names its target ("on z₀", "on Disc 1 ∩ Line 2"), a dashed preview follows the pointer, built shapes follow their parents live, and "built from … drag those" explains itself.
- **Undo after removing.** Remove, Clear chain, Delete shape and Clear shapes each show an Undo message and are one undo step.
- **Tooltips and menus.** Laptop tooltips give the name, the key and a one-line how-to. The right-click plane menu is rich and fits what is under the pointer. Keyboard focus is clearly visible, and dark-mode text contrast is at least 4.5:1.
- **The export preview.** It shows the figure as it will sit in an article, and video export has its own moving preview.
- **The phone ⋯ sheet.** It is the clearest settings place in the app: every row is labelled. D5 A reuses it for the laptop.
- **Russian.** It fits almost everywhere, including the view switch, the chain header and the sheets at 360 px.

---

## Not checked, and caveats

- **Phone checks used Chrome's phone emulation with simulated touches, not your Android phone.** Confirm these five on the real phone:
  - landscape (UX05);
  - two-finger pan (UX08);
  - Back (UX12);
  - pinch (UX13);
  - the keyboard covering fields (UX69, seen only in the code).
- **Read from the code, not heard:** UX73. Headless Chrome has no sound.
- **First run seen on the laptop only:** the published page, opened straight from `dist`, has no phone viewport setting, so the phone first run (UX21) comes from the first audit. Make sure the published page keeps that setting.
- **Not exercised in this audit:**
  - Show the roots;
  - the derivative step, and "Replace with derivative" or "with the inverse";
  - Landscape walls (new in v16.4);
  - the Unit circle toggle;
  - Pictures | Names;
  - Fit both planes;
  - the Freehand, Lasso, Segment, Ray, Arc, Annulus, Sector, Grid and Polar grid tools beyond placing them;
  - hide and show as a routine;
  - Help → Keyboard shortcuts;
  - Language Auto.
- **Estimates to measure before building:** the Russian header at 1280 px (D5 A) and the Russian pane head at 1366 px (D4 A).
- **Out of scope:** speed. Example pictures and the first switch to Phase or Landscape take 1–3 s in headless Chrome; that was not judged.