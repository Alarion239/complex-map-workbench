# The steps view (#366): implementation issues, drafted

These are drafts to file when Alexander approves the design on #366. Until then nothing is filed and no PR is opened.

- **One issue per PR**, into `claude/funny-darwin-l5uis3`. Each says `Part of #366` and links here.
- **Behind `?view=steps`:** everything until K, so the default UI is untouched.
- **The prototype** is on `claude/w11-rework-366` (src/app/19-steps-view.js and hooks), published at
  https://claude.ai/artifact/N7AGnskgPveTccJjjfGTdJ.
- **Reviewers:** ux (design, a11y), phone (the phone layout), constr (maths and values), perf (frame cost).

Each PR's checks:
- `node ci/unit.js`;
- the lint ratchet;
- `ruff check .`;
- `node test/t_size_budget.js`;
- `node ci/browser_shards.js check`;
- its suites (`node ci/browser.js --only …`);
- for shader changes, `node ci/glsl.js`.

---

## A · The steps view's core
**Scope:** the prototype's view as a reviewed part, with no new features.
- the one plane in the left pane (solo 'L'), with `leftStage()` the shown plane and `focusMap()` the map into the colour
  plane;
- the colour plane T, with the pull-back on planes ≤ T and the carried colour (`svCarry`, CPU mesh) on planes > T and
  while gliding;
- Inside regions (the 2D compositing mask; on the globe, the colour-key mask);
- the Plane, Sphere and Landscape surfaces;
- the strip as a thread: plane dots and step chips; drag, park anywhere, snapping within ⅛ step;
- ‹ ›, ←/→, PageUp/PageDown and C; the edge swipe and flick on touch;
- the fixed-time glide and the speed setting; one camera for every plane;
- the live region and the accessible names.

**Files:**
- new `src/app/19-steps-view.js`;
- hooks in `01-core.js` (`leftStage`, `solo`), `02-gpu-regions.js` (`focusMap`), `05-panes-rulers.js` (`renderLeft`,
  `renderColor`, `sphereView`'s `lineMap` and `colorMap`, `renderSphereLeft`), `08-thumbnails-render.js` (the frame,
  `chainChanged`) and `20-init.js` (one call);
- desk.css and phone.css under `:root.sv`;
- ci/impact.js;
- the ru and it tables.

**Owner:** rework, Opus. **Wave:** 12.

**Done when:**
- a new browser suite `steps_view_cmd.js` (desktop and phone) passes:
  - planes and T by the hook `__cmwSteps`;
  - a glide lands on its plane in its time;
  - parking at 0.5;
  - Inside regions masks;
  - the edge swipe;
  - reduced motion jumps;
- axe is clean;
- the default view's suites are unchanged.

## B · Names follow the shown plane and the colour plane
**Scope (ux 1–5 on #366):**
- the plane's title is "w₁ · phase of f₂", i.e. the shown plane · the map from it to T;
- the probe readout and the coordinate letter name that map ("f₂(w₁) = …");
- the key's caption follows the same map;
- one name for the last plane (w₂ in the steps view; F is the map);
- the left panel groups shapes by plane ("In z", "In w₁", …), with no X or Y;
- the phone's probe hint names the map.

**Files:** 09-pane-titles.js (titles, the key's caption), 04-labels-zeros-poles.js (the readout), 10-tools-menus.js (the shape list), 19-steps-view.js.

**Owner:** a Sonnet worker; ux reviews. **Wave:** 12.

**Done when:** a suite checks the title, readout and key on Cayley, then cube for T = z, w₁, w on each plane, in en and ru.

## C · The view in saves and links
**Scope:**
- `S.sv = {at, T, scope, surf, speed}` is saved, shared in links and kept by undo;
- old states and links open on their equivalent (concept §6): X → Y is T = last with Inside regions when it has areas,
  Phase is T = last everywhere, Landscape is the relief;
- parking between planes is saved as a fractional `at`.

**Files:** 01-core.js (`blankState`, `sanitizeState`), view.js (`Views.migrate`), 18-params.js (links), 19-steps-view.js.

**Owner:** a Sonnet worker; constr reviews. **Wave:** 12.

**Done when:**
- a unit test round-trips `S.sv` through save, link and undo;
- three old links (xy, phase, land) open on their equivalent.

## D · Chain editing on the strip
**Scope (ux 7, 8):**
- a ⋯ on each fₖ chip: bypass, delete, move ‹ ›, show alone, and the Inspector;
- "+ Add function" at the thread's end;
- an empty chain shows only that;
- the chips' menus reuse 11-pipeline.js's actions.

**Files:** 19-steps-view.js, 11-pipeline.js (exported actions).

**Owner:** a Sonnet worker; ux and phone review. **Wave:** 13.

**Done when:** a suite edits the chain from the strip on the desktop and the phone, and undo restores each change.

## E · Play on the thread
**Scope:**
- ▶ plays along the thread through every plane, with a loop and the speed setting;
- dragging across the thread with Shift (desktop), or with a long press (touch), marks a range, which Play keeps to;
- this replaces the Deformation bar and its brackets.

**Files:** 19-steps-view.js, 06-deformation.js (the range's model, `HomRange`).

**Owner:** a Sonnet worker; phone reviews. **Wave:** 13.

**Done when:** a suite plays a range, loops, stops, and keeps to the speed.

## F · The carried colour on the GPU
**Scope:**
- `GLR.drawCarried(st)`, which `svCarry` calls when it exists (with the CPU path as the fallback):
  - an instanced grid over plane s;
  - the VS places a point by the chain (homotopy maps, uBase = s);
  - the FS paints G(p) = chainRange(s, T) in T's style;
- torn triangles dropped by their Jacobian;
- past T, the sheets chosen by the inverse path's sheet key instead of the grid's order.

**Files:** src/gl/01-state-glsl-2d.js (a new program), 04-programs-resources.js, 05-frames-2d-draws.js, 19-steps-view.js.

**Owner:** hear, Opus high; perf reviews. **Wave:** 13.

**Done when:**
- the GLSL tiers match the CPU;
- FXC's inlined size is within the sweep's budget;
- a glide on the Mountain King, the ζ zeros and the dilogarithm holds 60 fps on the Mac (gpu-gate).

## G · Inside regions on the GPU
**Scope:**
- the regions' fill as a stencil (or an alpha target) in GL's frame, so the colour is drawn only inside them, with no 2D
  canvas compositing and no read-back;
- the globe's mask the same way, with no colour-key;
- later planes' regions pulled back into the same stencil.

**Files:** src/gl/04-programs-resources.js, 05-frames-2d-draws.js (a stencil pass), 19-steps-view.js.

**Owner:** rework, Opus; perf reviews. **Wave:** 13.

**Done when:**
- frame cost with Inside regions is within 10 % of without on the Mac;
- the globe mask matches the flat one at the equator;
- no `getImageData` in the path.

## H · The plane's head
**Scope (ux 9, 10):**
- #363's style cut (three glyphs);
- Cauchy as its own switch, with the title naming it ("Cauchy integral over Circle 1");
- the surface as one button on the laptop too;
- the head fits at 1024 px in ru.

**Files:** 19-steps-view.js, 09-pane-titles.js, 15-examples-guide.js (the style list).

**Owner:** ux or a Sonnet worker, after #363 is decided. **Wave:** 13.

**Done when:** the head-layout suite passes at 1024/1280/1440 in en, ru and it.

## I · (folded into F)
The exact colour while gliding is the carried colour (v5 on). No separate issue.

## J · Words
**Scope (ux 11):**
- the examples' Try lines, `tryDone` and "Show me" in the steps view;
- the tour (#34) for the thread, the colour plane and Inside regions;
- en, ru and it, through the tables.

**Files:** 15-examples-guide.js, src/tour.js, tools/ru_extra.json, tools/it_table.json.

**Owner:** phone and ux. **Wave:** 14.

**Done when:** example_try suites pass in the steps view, and the tour runs end to end on the desktop and the phone.

## K · The switch-over
**Scope:**
- the steps view becomes the default, with `?view=classic` keeping the old one for one release;
- the old views' suites are moved over;
- exports of the shown plane, and a filmstrip along the thread;
- then the old views' code is removed.

**Files:** many; split into K1 (default and flag), K2 (suites), K3 (exports), K4 (removal).

**Owner:** rework, with Alexander's go. **Wave:** 15.

**Done when:** the full gate is green, the GPU gate is green, and Alexander has checked on a real phone (#54–#58).
