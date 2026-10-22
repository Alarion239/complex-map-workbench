# Complex Map Workbench: "Living mathematical plates"

Design proposal, v1, 2026-10-18. Scope: visual system, components, plot rendering, motion. It is written so an engineer can build it from `src/page.html`, `src/app.js`, `src/view.js` and `src/gl.js` without asking questions. Where a number is given, use that number.

---

## 1. Concept

Each plane is a **plate**: a framed figure with a plate mark, a scale, a key and a caption that writes itself from the current chain. It reads like a figure in Needham, Wegert or Ahlfors, except that you can grab it. The chrome is printed in one ink, an indigo graphite, on cool vellum (and on a deep night-plate blue in dark mode). Colour belongs to the mathematics: phase portraits, the regions carried by the map, branch cuts, poles. Every ornament comes from the subject. The brand mark is the image of a square grid under z². Guaranteed properties are marked with the tombstone ∎. Branch cuts are drawn as hatched slits. The 3D view is a geological block diagram of the analytic landscape, standing on its own domain plate.

What the user should feel: *a precise instrument that also prints beautiful figures.* Boldness is spent in one place, the plates. Everything around them stays quiet.

---

## 2. Colour

### 2.1 Principles

- **One ink for the UI.** Text, icons, borders and selected states all use the `--ink-*` ramp. The one accent, **verdigris** (the patina of copper, as on copper engraving plates), is kept for focus, the current selection, and primary actions. It is never used in plots.
- **No colour fills for status.** Guaranteed properties show a ∎ glyph in `--good`. There are no green boxes.
- **Panels are tonal.** Panels are separated from the ground by tone and a 12 px gutter, not by borders or shadows.
- **Plot colours are data.** They come from the shape palette and the phase wheel, which are the same in both themes. Only the plate, grid and axes change with the theme.

### 2.2 Light theme: "Vellum"

| Token | Hex | Use |
|---|---|---|
| `--ground` | `#E3E7E2` | App background behind panels |
| `--panel` | `#ECEFEA` | Side panels, chain strip |
| `--raised` | `#F7F8F5` | Step cards, popovers, segmented-control thumb, secondary buttons |
| `--sunk` | `#DDE2DC` | Segmented-control track, hover wash on quiet buttons, slider track background |
| `--field` | `#FCFCFA` | Input backgrounds |
| `--overlay` | `#FBFBF8E0` | On-plate control clusters, chips, legends (88% plate + `backdrop-filter: blur(6px)`) |
| `--ink-1` | `#16202C` | Primary text, icons at rest when emphasised, key ink (15.4:1 on raised) |
| `--ink-2` | `#475261` | Secondary text, icons at rest (6.8:1 on panel) |
| `--ink-3` | `#5A6572` | Tertiary text, captions' meta, placeholders (5.1:1 on panel, 4.75 on ground) |
| `--ink-4` | `#8E97A0` | Disabled, "off" stamps, decorative dots only (not for readable text) |
| `--line-1` | `#D0D6CE` | Hairlines: card borders, table rules |
| `--line-2` | `#A9B2AA` | Secondary-button borders, slider track |
| `--line-3` | `#7E8880` | Input borders (3.6:1 on field, so it meets WCAG 1.4.11) |
| `--accent` | `#0D6E62` | Verdigris: focus, selection border, primary button (white on it 6.1:1) |
| `--accent-strong` | `#095449` | Primary hover/pressed |
| `--accent-wash` | `#D5EAE4` | Selected backgrounds (accent text on it 4.9:1) |
| `--accent-ring` | `#0D6E6247` | 3 px focus halo around inputs |
| `--on-accent` | `#FFFFFF` | Text on accent |
| `--good` | `#2F6F2A` | ∎ for "guaranteed", "on" stamps, valid parse |
| `--good-wash` | `#DDEBD6` | "On" stamp background |
| `--warn` | `#8F5A00` | Warnings (constant map, heavy mesh) |
| `--warn-wash` | `#F3E6CC` | Warning row background |
| `--err` | `#A8213E` | Errors: parse failure, step error (madder crimson) |
| `--err-wash` | `#F5DDE2` | Error background in cards |
| `--err-ring` | `#A8213E40` | Focus halo on invalid inputs |
| `--plate` | `#FBFBF8` | Plane background |
| `--plate-rule` | `#8F9890` | Plate keyline (1 px border of the figure) |
| `--plate-mark` | `#C6CDC5` | Second keyline 3 px outside (the plate mark) |
| `--grid-minor` | `#ECEEE9` | Minor grid |
| `--grid-major` | `#D5DAD3` | Major grid (every 5th minor) |
| `--axis` | `#6F7972` | Real and imaginary axes, unit circle |
| `--axis-label` | `#566069` | Tick labels, "Re z" / "Im z" (6.2:1 on plate) |
| `--cut` | `#C0391F` | Branch cuts (slit line + hatch), cut handle |
| `--pole` | `#6B2A86` | Pole crosses (aubergine) |
| `--zero` | `#16202C` | Zero rings |
| `--probe` | `#16202C` | Hover crosshair |
| `--halo` | `#FBFBF8` | Text and marker halos on plates (equal to `--plate`) |
| `--scrim` | `#16202C5C` | Modal scrim |
| `--relief-sky` | `#F4F5F1` | 3D background, top |
| `--relief-ground` | `#E2E6E0` | 3D background, bottom |
| `--shadow-1` | `0 1px 2px #16202C1A` | On-plate overlays (with 1 px `--line-1` ring) |
| `--shadow-2` | `0 14px 36px -10px #16202C47, 0 2px 6px #16202C1A` | Popovers, palette, drawers, modal |

### 2.3 Dark theme: "Night plate"

The base is a deep indigo slate rather than near-black. The accent is a soft patina, not an acid green.

| Token | Hex |
|---|---|
| `--ground` | `#111823` |
| `--panel` | `#161E2A` |
| `--raised` | `#1C2533` |
| `--sunk` | `#0C121B` |
| `--field` | `#121A25` |
| `--overlay` | `#0F1620D9` |
| `--ink-1` | `#E5E9EF` |
| `--ink-2` | `#AEB8C5` |
| `--ink-3` | `#8B97A7` |
| `--ink-4` | `#5D6979` |
| `--line-1` | `#253041` |
| `--line-2` | `#3A475A` |
| `--line-3` | `#5E6E84` (3.2:1 on panel) |
| `--accent` | `#5CC2B1` |
| `--accent-strong` | `#82D7C9` |
| `--accent-wash` | `#173532` |
| `--accent-ring` | `#5CC2B152` |
| `--on-accent` | `#062420` |
| `--good` | `#93CF73` |
| `--good-wash` | `#1C3420` |
| `--warn` | `#E8B04A` |
| `--warn-wash` | `#3A2C10` |
| `--err` | `#FF8592` |
| `--err-wash` | `#3E1A22` |
| `--err-ring` | `#FF859247` |
| `--plate` | `#0F1620` |
| `--plate-rule` | `#4A586C` |
| `--plate-mark` | `#263245` |
| `--grid-minor` | `#151E2A` |
| `--grid-major` | `#223042` |
| `--axis` | `#7A889A` |
| `--axis-label` | `#93A0B1` |
| `--cut` | `#FF6B4E` |
| `--pole` | `#D9A2EC` |
| `--zero` | `#E5E9EF` |
| `--probe` | `#E5E9EF` |
| `--halo` | `#0F1620` |
| `--scrim` | `#05080DB3` |
| `--relief-sky` | `#16233A` |
| `--relief-ground` | `#0B111A` |
| `--shadow-1` | `0 1px 2px #00000066` |
| `--shadow-2` | `0 18px 44px -10px #000000A6, 0 2px 6px #00000066` |

All text pairs in both themes meet 4.5:1, except `--ink-4`, which is decorative and disabled-only.

### 2.4 Shape palette (8 pigments, theme-independent)

These are mid-tones, with relative luminance between 0.12 and 0.28. Each one has at least 3:1 contrast against **both** `#FBFBF8` and `#0F1620`, so boundaries read on either plate. Their tints (§6.3) stay distinct on top of checker patterns. No palette colour is near `--cut` (vermilion) or `--accent` (verdigris), so a shape can never be mistaken for a branch cut or a selection. This fixes the current palette's `#e0532f`, which collides with the red cut.

| # | Name | Hex | vs light plate | vs dark plate |
|---|---|---|---|---|
| 1 | Prussian | `#3461B8` | 5.7 | 3.1 |
| 2 | Madder rose | `#C2436E` | 4.7 | 3.7 |
| 3 | Sap green | `#4F8A2B` | 4.1 | 4.3 |
| 4 | Ochre | `#C08417` | 3.1 | 5.7 |
| 5 | Violet | `#7B57C8` | 5.0 | 3.5 |
| 6 | Cerulean teal | `#16899E` | 4.0 | 4.4 |
| 7 | Umber | `#9A6B45` | 4.4 | 4.0 |
| 8 | Slate | `#5B6B80` | 5.3 | 3.3 |

Assign colours in this order. Order 1→2→3 gives the most separation for the first three shapes, which is the common case.

---

## 3. Typography

### 3.1 Families (Google Fonts)

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..600&family=Red+Hat+Mono:wght@400;500&display=swap">
```

| Role | Family | Fallback stack |
|---|---|---|
| **Plate voice**: plane names, captions, panel headings, wordmark, math variables in HTML (z, w, i, f), guide prose | **Newsreader** (variable: opsz 6–72, wght 400–700, italic) | `"Newsreader", "Iowan Old Style", Charter, Georgia, serif` |
| **Instrument voice**: controls, labels, numbers, tables, tick labels | **Archivo** (variable: wdth 62–125, wght 400–700) | `"Archivo", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` |
| **Source**: LaTeX and formula entry fields only | **Red Hat Mono** 400/500 | `"Red Hat Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace` |

MathJax keeps its TeX fonts for typeset formulas. Newsreader's text italic sits comfortably next to Computer Modern, which STIX and Plex did not.

Monospace appears **only** inside source-entry fields. Coordinates, parameters and tick labels use Archivo with tabular lining figures, which is why they look like an instrument and not a terminal.

### 3.2 Type scale (px)

| Token | Size / line | Family, weight, settings | Used for |
|---|---|---|---|
| `--t-micro` | 10.5 / 12 | Archivo 500, `wdth` 90, +0.01em, tnum | Tick labels, matrix header letters, slider tick values |
| `--t-stamp` | 9.5 / 12 | Archivo 700, `wdth` 80, +0.02em | Property stamps (A, E, R, P, M, Pr, I) |
| `--t-small` | 11.5 / 15 | Archivo 400/500, +0.005em | Hints, notes, secondary row text, kbd |
| `--t-ui` | 12.5 / 16 | Archivo 500 | Buttons, tabs, labels, shape names, card names (600) |
| `--t-body` | 13.5 / 19 | Archivo 400 | Descriptions in the guarantees panel and palette |
| `--t-caption` | 13.5 / 18 | Newsreader 400, opsz 12, `lnum` | Plate captions; "Fig. 1." in 600 |
| `--t-plane` | 16 / 20 | Newsreader 600 italic (variable) + 500 roman, opsz 16 | Plane labels "*z*-plane" |
| `--t-head` | 15 / 20 | Newsreader 600, opsz 16, −0.005em | Panel section headings (sentence case) |
| `--t-title` | 17 / 22 | Newsreader 600, opsz 20, −0.01em | Panel titles ("Guarantees"), chain title |
| `--t-brand` | 19 / 24 | Newsreader 600, opsz 24, −0.012em | Wordmark |
| `--t-display` | 26 / 32 | Newsreader 500, opsz 36, −0.015em | Guide modal title |

Math sizes for MathJax: 12 px in shape rows, 13.5 px in step cards and chips, 14 px in the chain header, 15 px in palette rows, 16 px in the composite formula box.

### 3.3 Rules

- **Sentence case everywhere.** Remove every `text-transform: uppercase` and every 0.09em tracking from the current CSS. Section headings become Newsreader 15 / 600: "Draw in the *z*-plane", "Region from a formula", "Shapes", "Pattern", "Guarantees", "Step by step".
- **Numerals.** Use `font-variant-numeric: tabular-nums lining-nums` on readouts, inputs, tick labels, the matrix and slider values. Captions use proportional lining figures. Guide prose uses `onum` (old-style figures) for a bookish feel.
- **Proper math glyphs in HTML and canvas text:** minus U+2212 (−), multiplication U+00D7, prime U+2032 (′), ∞, ∘. The imaginary unit and variables are set in Newsreader italic: `0.412 − 1.207<i>i</i>`.
- **Fixed slots for live numbers.** Every live number gets `min-width: 7ch` with right alignment, so readouts never jitter even if a fallback font lacks `tnum`.
- **No single-word emphasis** in headings, and no eyebrow labels above headings.

---

## 4. Layout, spacing, radii, borders, elevation

### 4.1 Spacing scale

`--s-1: 2px; --s-2: 4px; --s-3: 6px; --s-4: 8px; --s-5: 12px; --s-6: 16px; --s-7: 20px; --s-8: 24px; --s-9: 32px; --s-10: 48px.`

The app gutter is 12. Panel inner padding is 16. Sections are separated by 20 of vertical space plus a heading, **with no divider rules between sections**. Inside a group, the rhythm is 8. Inside dense controls it is 4.

### 4.2 Grid at 1440 × 900

```
 12 ┌──────────────────────────────────────────────────────────────────────────────────────────┐
 48 │ [mark] Complex Map Workbench    Examples: Joukowski airfoil ▾   ↶ ↷ │ ◐ │ ▯▮ ▮▯ │ Guide    │ header (ground, no bar)
    ├────────────┬───────────────────────────────────────────────────────────┬─────────────────┤
    │ 248        │ z-plane  domain              │ w-plane  [Image|Phase|Relief|Sphere|Morph]    │ 288
    │ Draw in    │ ╔══════════════════════════╗ │ ╔══════════════════════════╗ │ Guarantees    │
    │ the z-plane│ ║                       ⊞  ║ │ ║                       ⊞  ║ │ ┌───────────┐ │
    │ [tool grid]│ ║         plate            ║ │ ║         plate            ║ │ │ F(z)= …   │ │
    │            │ ║                          ║ │ ║                          ║ │ └───────────┘ │
    │ Region from│ ║ ⟝1⟞                key ▣ ║ │ ║ w = …               key ▣║ │ ∎ Analytic   │
    │ a formula  │ ╚══════════════════════════╝ │ ╚══════════════════════════╝ │ ∎ Proper     │
    │ Shapes     │ Fig. 1. The region in the …  │ Fig. 2. Image under w = F(z)…  │ □ Entire …   │
    │ Pattern    │──────────────────────────────────────────────────────────── │ Natural      │
    │ Display    │ Function chain   F = f₂ ∘ f₁                  [Whole chain] │ domain D     │
    │            │ [z Region] ─z→ [f₁ Exponential] ─w₁→ [f₂ Möbius] ─w₂→ [ + ]  │ Step by step │
    └────────────┴───────────────────────────────────────────────────────────┴─────────────────┘
```

- `#app`: `grid-template-rows: 48px minmax(0,1fr)`, padding `0 12px 12px`, using `max(12px, env(safe-area-inset-*))` on the sides.
- `.layout`: `grid-template-columns: 248px minmax(0,1fr) 288px; gap: 12px`. When a panel is hidden it becomes a 40 px rail.
- `.stage`: `grid-template-rows: minmax(0,1fr) auto; gap: 12px`. The chain strip is 36 (header) + 192 (cards) + 12 (bottom pad) = 240 px tall.
- `.planes`: two equal columns, gap 12. Each plate column is `grid-template-rows: 32px minmax(0,1fr) auto`: label row, plate, caption (2 lines max, 40 px).
- **Result:** on 1440 × 900 with both panels open, each plate is about 422 × 520 px. With both rails, each plate is about 650 × 520 px.
- **Alignment:** left-aligned everywhere. Captions sit flush with the plate's left keyline. Numbers right-align in their slots.

### 4.3 Breakpoints

| Width | Behaviour |
|---|---|
| ≥ 1280 | As above. At 1280–1439, left is 232 and right is 272. |
| 1024–1279 | Right panel starts as a rail. Opening it shows a **drawer** (320 px, `--raised`, `--shadow-2`) over the stage, closed by Esc or an outside click. The left panel stays docked at 232. |
| 768–1023 | Both panels are rails/drawers. Plates stay side by side, chain below. |
| < 768 (phone) | One column, no horizontal page scroll. Order: header (48: mark, short wordmark "Map Workbench", undo, overflow menu with Examples / Theme / Guide). Then a **tool strip** (a horizontally scrolling row of 44 × 44 icon-only tool buttons with `scroll-snap-type: x`, sticky at the top of the left plate). Then the left plate, then the right plate (each `aspect-ratio: 1`, `width: 100%`). Then the chain strip (cards 78vw, max 248, `scroll-snap-align: start`). Then accordions: Shapes, Formula, Pattern & display, Guarantees. Overlay controls are always visible. Touch targets are at least 40 px (`@media (pointer: coarse)`). Captions clamp to 1 line; tap to expand. Long-press on a plate probes (one-finger drag pans, pinch zooms). |

Only internal strips scroll horizontally (tool strip, chain). The page never does: use `overflow-x: clip` on `.layout`.

### 4.4 Radii

| Token | Value | Applies to |
|---|---|---|
| `--r-1` | 2px | Plate frame, swatches, stamps, the formula box, kbd |
| `--r-2` | 4px | Buttons, inputs, segmented controls, tool buttons, chips, on-plate overlays, shape rows |
| `--r-3` | 6px | Panels, step cards, the add slot, rails |
| `--r-4` | 8px | Popovers, command palette, modal, drawers |

No pills (999px) anywhere. Plates are nearly square-cornered on purpose, because they are figures, not cards.

### 4.5 Borders and elevation

| Level | What | Border | Shadow |
|---|---|---|---|
| 0 Ground | App background | none | none |
| 1 Tonal | Panels, chain strip, rails | **none**: tone difference only | none |
| 1 Plate | Each plane | `1px solid var(--plate-rule)` plus `outline: 1px solid var(--plate-mark); outline-offset: 3px` (the plate mark) | none |
| 1 Object | Step cards, shape rows (selected only), formula box | `1px var(--line-1)` | none |
| 2 On-plate | Zoom/fit cluster, readout chip, legends, scale bar backing | `0 0 0 1px var(--line-1)` (inside `--shadow-1`) | `--shadow-1` + blur(6px) |
| 3 Floating | Popovers, menus, palette, drawers, toasts | `1px var(--line-2)` | `--shadow-2` |
| 4 Modal | Guide | as level 3 | `--shadow-2` + `--scrim` |

Nothing at levels 0–1 has a shadow. Remove `--shadow` from `.pane` and the green box treatment from `.badge`.

---

## 5. Components

### 5.1 Header and brand mark

**Header.** 48 px tall, on `--ground`, no bar and no bottom rule.

- **Left:** mark (24 px), 10 px gap, then the wordmark "Complex Map Workbench" in Newsreader 19/600. Remove the current "w = fₙ ∘ ⋯ ∘ f₁(z)" signature; the chain header already shows the live composite.
- **Middle (flex 1, left-aligned after 24 px):** an **Examples menu button** whose label is the current example name, e.g. "Joukowski airfoil", or "Examples" when none is loaded. Quiet button style with a chevron. The menu lists each example with a 40 × 40 mini plate thumbnail, name (Archivo 12.5/600) and a one-line description.
- **Right:** undo and redo as 28 × 28 icon buttons; a 1 × 16 `--line-1` separator; a theme button that cycles Auto / Light / Dark and sets `data-theme` on `<html>`; a separator; two panel toggles (sidebar-left and sidebar-right glyphs, `aria-pressed`); then "Guide" as a quiet text button.

**Brand mark.** The image of the square grid under w = z²: two families of confocal parabolas crossing at right angles. It is conformality in one picture, inside a tiny plate frame, with the shared focus at the origin. Ink family = images of vertical lines; verdigris family = images of horizontal lines.

```svg
<svg viewBox="0 0 28 28" width="24" height="24" aria-hidden="true">
  <defs><clipPath id="cmw-clip"><rect x="2.25" y="2.25" width="23.5" height="23.5" rx="1.25"/></clipPath></defs>
  <rect x="1.5" y="1.5" width="25" height="25" rx="2" fill="var(--plate)" stroke="var(--ink-1)" stroke-width="1.25"/>
  <g clip-path="url(#cmw-clip)" fill="none" stroke-width="1.15" stroke-linecap="round">
    <g stroke="var(--ink-1)">            <!-- images of x = 0.65, 0.95, 1.2 -->
      <path d="M6.51 25.62Q27.83 14 6.51 2.38"/>
      <path d="M15.78 25.62Q25.76 14 15.78 2.38"/>
      <path d="M21.67 25.62Q27.93 14 21.67 2.38"/>
    </g>
    <g stroke="var(--accent)">           <!-- images of y = 0.65, 0.95, 1.2 -->
      <path d="M21.49 25.62Q0.17 14 21.49 2.38"/>
      <path d="M12.22 25.62Q2.24 14 12.22 2.38"/>
      <path d="M6.33 25.62Q0.07 14 6.33 2.38"/>
    </g>
  </g>
  <circle cx="14" cy="14" r="1.4" fill="var(--ink-1)"/>   <!-- common focus = 0 -->
</svg>
```

Each quadratic Bézier is an exact parabola segment (u = a² − v²/4a² mapped with 7.5 px per unit, centred at 14,14). For the favicon (16 px), drop the outer pair of each family. The page `icon` word stays "chart".

### 5.2 Tool palette

- **Groups**, each with a Newsreader italic 12.5 `--ink-3` group label: *Points and curves* (Select, Point, Segment, Line, Ray, Circle, Arc, Freehand), *Regions* (Disc, Rectangle, Polygon, Lasso, Half-plane, Annulus, Sector), *Grids* (Grid, Polar grid).
- **Grid:** 4 columns, gap 4. Each button is about 54 × 50 with radius 4. The 20 px icon is centred 8 px from the top. The label is Archivo 10.5/500 `wdth` 90, 4 px below.
- **States:**
  - Rest: icon `--ink-2`, label `--ink-3`, transparent.
  - Hover: `--sunk` background, icon `--ink-1`.
  - Selected: `--accent-wash` background, 1 px `--accent` border, icon and label `--accent`.
  - Focus-visible: 2 px `--accent` outline with offset 1.
- **Tooltip:** name plus shortcut key (V Select, P Point, S Segment, L Line, R Ray, C Circle, A Arc, F Freehand, D Disc, B Rectangle, G Polygon, O Lasso, H Half-plane, N Annulus, K Sector).
- **Hint line** under the grid: Archivo 12.5/17 `--ink-2`, 2 lines reserved so the layout never jumps. Keys appear as `kbd` (Archivo 11, 1 px `--line-2`, radius 2, padding 0 4).

**Icon style rules** (tools are 20 × 20; UI icons are 16 × 16):

1. Stroke 1.5, round caps and joins, `currentColor`, geometry on a 0.5 px grid, live area 16 × 16 (tools) or 13 × 13 (UI).
2. **Areas are engraved, never translucent.** Region tools fill their interiors with a 45° hatch at 3 px pitch and 0.9 px stroke. Define the pattern inside each icon's own `<svg>` so `currentColor` resolves, with a unique id per icon:
   `<pattern id="h-disc" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V3" stroke="currentColor" stroke-width=".9"/></pattern>`
3. Points are filled dots (r 1.75–2.5). Handles are 2.5 × 2.5 squares. Only the Select pointer is a filled shape.
4. **Lines differ from segments:** a line is drawn solid in the middle with dotted continuations to the icon edge. A segment has end dots. A ray has one end dot and an open 4 px arrowhead.
5. **Half-plane:** hatch above a horizontal boundary, with an arrowhead on the boundary showing orientation (the region is to the left).
6. **Annulus:** even-odd path between r 7 and r 3.25, both circles stroked.
7. **Never use Unicode glyphs as icons.** Replace ●, ◌, ⏻, ×, ‹, › with SVG icons (see Appendix A).

### 5.3 Segmented controls (and the right plate's mode tabs)

- **Track:** `--sunk`, radius 5, padding 2, height 28 (24 inside cards).
- **Segment:** padding `0 10px`, Archivo 12.5/500, `--ink-2`. Hover goes to `--ink-1`.
- **Selected thumb:** `--raised`, `box-shadow: 0 0 0 1px var(--line-2)`, text `--ink-1`. The thumb is a single absolutely positioned element that slides between segments (140 ms, `--ease-out`), not a background swap.
- **Right plate tabs:** **Image · Phase · Relief · Sphere · Morph** (rename "Color plot" → Phase, "3D" → Relief). These sit right-aligned in the plate's 32 px label row.
- **Pattern selector:** this is **not** a text segmented control. It is a swatch grid (§6.3).

### 5.4 Buttons

All buttons are radius 4, Archivo 12.5/500, height 28 (24 small, 36 on coarse pointers), padding `0 12px` (small `0 8px`), icon gap 6.

| Variant | Rest | Hover | Pressed / on |
|---|---|---|---|
| Primary (only "Add", palette ↵, modal confirm) | bg `--accent`, text `--on-accent` | bg `--accent-strong` | bg `--accent-strong`, inset 0 1px 0 `#0003` |
| Secondary | bg `--raised`, 1px `--line-2`, text `--ink-1` | border `--line-3` | bg `--sunk` |
| Quiet | transparent, text `--ink-2` | bg `--sunk`, text `--ink-1` | `aria-pressed=true`: bg `--accent-wash`, text `--accent` |
| Icon | 28 × 28 (24 in cards), 16 px icon `--ink-2` | bg `--sunk`, icon `--ink-1` | as quiet |
| Danger (inside menus only) | text `--err` | bg `--err-wash` | n/a |

Disabled: 40% opacity, `cursor: default`. Focus-visible: `outline: 2px solid var(--accent); outline-offset: 2px`. Button copy says what happens: "Add", "Add function", "Fit to region", "Reset camera", "Clear chain". No trailing arrows.

### 5.5 Inputs

**Text and number fields.**
- Size: height 28 (24 in cards), padding `0 8px`, bg `--field`, 1 px `--line-3`, radius 4, Archivo 13 tnum, `--ink-1`.
- Placeholder: `--ink-3`.
- Focus: border `--accent` plus `0 0 0 3px var(--accent-ring)`.
- Invalid: border `--err` plus `0 0 0 3px var(--err-ring)`, with the message under the field in Archivo 11.5 `--err`.
- Number fields hide spinners. ↑/↓ steps by 1, Shift ×10, Alt ×0.1. Dragging horizontally on the field's **label** scrubs the value (`cursor: ew-resize`, 1 unit per 4 px).

**Formula and LaTeX fields** (region formula, custom f, polynomial coefficients):
- Red Hat Mono 12.5.
- A live typeset echo appears 6 px below in a "proof strip": min-height 28, bg `--raised`, radius 2, padding `4px 8px`, MathJax 14.
- On a parse error, the strip shows the message and the offending token gets a wavy `--err` underline.

**Complex-number input** (params of type `cx`: c, a, b, d, α):

```
┌──┬────────────────────────────┐
│◎ │ e^{iπ/4}       = 0.707+0.707i │
└──┴────────────────────────────┘
```

- **Left:** a 24 × 24 **Argand pad button**. The glyph is a 12 px plane with a dot at the value's direction (unit-normalised), so the button itself shows arg c.
- **Field:** Red Hat Mono 12.5. When the text is an expression rather than a plain number, a right-aligned echo of the parsed value appears in Archivo 11.5 `--ink-3` tnum (`= 0.707 + 0.707i`).
- **Pad popover** (click): 184 × 208, level 3. It holds a 168 × 168 mini plate (grid, axes, unit circle) auto-scaled to max(2, 1.5|c|), with a draggable 10 px point in `--ink-1` with a `--halo` ring. Below it is a readout: "c = 0.707 + 0.707*i*" and "|c| = 1.000  arg c = 45.0°". Dragging snaps to the 0.05 lattice, the axes and the unit circle within 6 px; the snapped guide flashes `--accent` for 120 ms. Shift disables snapping.
- **Geometric params** (translate c, disc-automorphism a, rotation centre): while the field or pad is focused, the parameter is also drawn in the input plate as a labelled marker, and it is draggable there.

### 5.6 Sliders

- **Track:** 2 px `--line-2` with the filled part in `--ink-2`. Hit area height 20.
- **Thumb:** 14 px circle, `--raised`, 1.5 px `--ink-1` border. Hover adds a 6 px `--accent-ring` halo. Focus adds a 2 px `--accent` outline.
- **Value:** right-aligned Archivo 12 tnum in a 7ch slot. While dragging, a level-2 chip shows the value above the thumb.
- **Optional ticks:** 1 × 4 px `--line-3` under the track at preset values. Opacity ticks at 25/50/75/100.
- **Mesh control:** replace the raw mesh slider with **Quality: Draft · Normal · Fine · Ultra** as a segmented control, plus "Custom…", which reveals the slider (40–800) and the note. Default is Normal.

### 5.7 Shape list rows

Each row is a 40 px grid: `20px | minmax(0,1fr) | 24px | 24px`, gap 8, padding `0 6px 0 8px`, radius 4.

- **Swatch:** 16 × 16, radius 2, a **live mini of the current pattern** in the shape's tints (a CSS `conic-gradient` checker for Checker, else a 32 px canvas), with a 1 px inner border in the shape's ink (§6.3). Clicking it opens a menu with the 8 palette swatches (18 px, 2 px gap, selected = 1.5 px `--ink-1` ring) plus "Custom colour…".
- **Name:** "Disc 1" in Archivo 12.5/600 `--ink-1`; "(complement)" in 400 `--ink-3`. Below it, the definition in MathJax 12 `--ink-2` on one line, with a right fade (`mask-image: linear-gradient(90deg,#000 85%,transparent)`).
- **Eye button:** 16 px eye / eye-off icon. A hidden row has its name in `--ink-3` and an outline-only swatch.
- **More button (⋯):** Duplicate, Complement, Change colour, Delete (danger).
- **States:**
  - Hover: `--sunk` background. Both plates thicken this shape's boundary by 1 px and dim the other shapes to 60%.
  - Selected: `--accent-wash` background, 1 px `--accent` border. The row expands its editor below (padding `4px 8px 10px`, fields in a 72 px label column, gap 6).
- **Empty state:** "No shapes yet. Draw in the *z*-plane or type a region such as |z − 1| < 2." Below it, three quick-add chips (typeset): "Unit disc", "Upper half-plane", "Strip 0 < Im z < π".

**Formula chips** under "Region from a formula" render **typeset math**, not LaTeX source (the screenshot shows raw `\Re z>0`). Each chip is 24 tall, padding `0 8px`, radius 4, `--raised`, 1 px `--line-1`, MathJax 12.5. Show 6, plus "More examples".

### 5.8 Plate chrome (both planes)

Anatomy, top to bottom:

1. **Label row** (32 px, no background):
   - Left: the **plane label** in Newsreader, "*z*-plane" (variable italic 16/600, "-plane" roman 500). Then 8 px and a descriptor in Archivo 12 `--ink-3`: "domain", "input of *f*₂", "output of *f*₂", "image under *F*".
   - Right: on the right plate, the mode tabs. On the left plate, when a step is focused, a quiet chip "Viewing *f*₂ alone ×" that returns to the whole chain.
2. **Plate:** `position: relative`, bg `--plate`, 1 px `--plate-rule`, plate-mark outline (§4.5), radius 2. The WebGL canvas fills it. Overlays are HTML on top:
   - **Control cluster**, top-right, 8 px inset: a vertical stack of 28 × 28 buttons (zoom in, zoom out, fit, expand/restore) in one level-2 container with 1 px `--line-1` separators. On fine pointers it is hidden at opacity 0 and appears on plate hover or focus-within (120 ms). It is always visible on coarse pointers.
   - **Scale bar / readout**, bottom-left, 8 px inset, level-2 chip with padding `5px 8px`.
     - When not probing, it shows a **scale bar**: a 1.25 px `--ink-1` line with 5 px end ticks, its length the nice step nearest 64 px, labelled "1", "0.5", "2"… above it in Archivo 10.5 tnum.
     - While probing it becomes the readout. Line 1: "*z* = 0.4120 − 1.2070*i*" (variable in Newsreader italic 14, numbers Archivo 12.5 tnum in 7ch slots). Line 2, Archivo 11.5 `--ink-3`: "|*z*| 1.2754   arg *z* −71.15°".
     - On the right plate the readout says "*w* = *F*(*z*) = …" and, in Phase or Relief mode, adds "|*F*′(*z*)|" when the derivative is available.
     - Clicking the chip copies `0.412-1.207i`; the chip shows "Copied" for 1.2 s.
   - **Key / legend**, bottom-right, 8 px inset, level 2. It is mode-specific (§6.7–6.9). In Image mode it appears only when poles or cuts are present: "× pole of *f*₂" and a 14 px hatched-slit sample with "branch cut of √". Clicking it collapses it to a 20 px glyph.
   - **Progress line:** a 2 px `--accent` bar on the plate's top edge, indeterminate (a 30% segment sweeping in 1.2 s). It appears only if a computation exceeds 150 ms.
3. **Caption** (auto-written), Newsreader 13.5/18 `--ink-2`, max 2 lines with ellipsis (full text in `title`). It starts with "Fig. 1." / "Fig. 2." in 600 `--ink-1`. Inline math is typeset at 13 px. Templates:
   - Left, whole chain: "**Fig. 1.** The region in the *z*-plane: 3 shapes. The hatched slit is the branch cut of *f*₁."
   - Left, step focused: "**Fig. 1.** The *w*₁-plane, input of *f*₂. Draw new shapes in the *z*-plane." (This replaces the floating overlay note.)
   - Image: "**Fig. 2.** Image under *w* = *F*(*z*), *F* = *f*₂ ∘ *f*₁. The checker is carried by the map." If anything was truncated: "Unbounded parts are cut off at |*z*| = 10 (dotted edge)."
   - Phase: "**Fig. 2.** Phase portrait of *F* over the left view. Hue is arg *F*(*z*); each band doubles |*F*|."
   - Relief: "**Fig. 2.** Analytic landscape over the left view. Height is log |*F*(*z*)|; colours as in the phase portrait."
   - Sphere: "**Fig. 2.** *F* on the Riemann sphere; north pole is ∞."
   - Morph: "**Fig. 2.** Deformation from *z* to *w* at *t* = 0.42 (step *f*₁, exponential)."

Remove `.pane-head` and `.pane-foot` as bars. Their content moves into the label row, the overlays and the caption.

### 5.9 Function chain: step cards

The chain reads as a **commutative diagram**. Cards are maps, and the connectors between them carry the plane names.

```
 [ z  Region ]──z──▶[ f₁  Exponential ]──w₁──▶[ f₂  Möbius ]──w₂──▶[ + Add function ]
```

**Chain header** (36 px, padding `0 12px`): "Function chain" in Newsreader 17/600; 12 px gap; the composite in MathJax 14 ("*F* = *f*₂ ∘ *f*₁"); spacer; "Whole chain" as a quiet button, pressed when focus = 0; "Clear chain" as a quiet button that turns `--err` on hover and shows an Undo toast.

**Card**: width 212, height fills the strip (min 184), radius 6, bg `--raised`, 1 px `--line-1`, overflow hidden, `display: flex; flex-direction: column`.

| Part | Spec |
|---|---|
| Header (30 px, padding `0 4px 0 10px`) | **Token**: "*f*₁", where *f* is Newsreader italic 15/600 `--ink-1` and the subscript is Archivo 10.5 tnum. Then 6 px and the **name** in Archivo 12.5/600 with ellipsis. Spacer. Three 24 × 24 icon buttons: **inverse** (text glyph *f*⁻¹ in Newsreader italic 12.5; disabled when no inverse), **bypass** (jumper icon, `aria-pressed`), **more** (⋯: Move earlier, Move later, Duplicate, Remove). On hover, a 6-dot grip appears 2 px left of the token; dragging the header reorders the card (ghost at 85% opacity; a 2 px `--accent` insertion bar between cards). |
| Thumbnail (96 px) | A mini plate of this stage's **output**: bg `--plate`, 1 px `--line-1` top and bottom, the same pattern renderer at 0.75× line weights, no tick labels. Overlaid bottom-left: plane chip "*w*₁" in Newsreader italic 12 on `--overlay`, radius 2, padding `0 4px`. The live probe point shows here as a 4 px dot. |
| Formula (30 px, padding `0 10px`) | MathJax 13.5, "*w*₁ = e^{*z*}", with a right fade mask on overflow. |
| Params (padding `2px 10px 8px`) | Grid `40px 1fr`, row gap 4, inputs 24 px. Labels are **typeset symbols**: Newsreader italic 13.5 for *a*, *b*, *c*, *d*, *α*, *φ*, *n*. "cut" is Archivo 11.5 `--ink-3`, with a "°" suffix inside the field. `cx` params use the complex input (§5.5). Presets are a quiet "Presets" menu button (not a `<select>`), aligned right in the formula row. |
| Note | Archivo 11.5/15 `--ink-3`, 2 lines max. Example: "Principal sheet, k = 0 of 2. Drag the slit in the input plane." |
| Stamps (margin-top auto, padding `0 10px 8px`) | Seven 18 × 16 stamps, gap 3, radius 2, letters A E R P M Pr I in `--t-stamp`. On: `--good-wash` background, `--good` text. Off: transparent, `--ink-4` text, no border. The tooltip gives the full name and "yes" or "not guaranteed". |

**Card states:**

- Hover: border `--line-2`.
- **Focused:** border `--accent` plus `inset 0 0 0 1px var(--accent)` (2 px total), header background `--accent-wash`. The **two connectors around it turn verdigris** (1.75 px line, label in `--accent`). Their labels match the two plates' labels, which ties "left plate = input, right plate = output" together.
- **Bypassed:** the body is at 45% opacity (the header stays at 100%), the thumbnail is overlaid by a 45° hatch in `--ink-4`, and the incoming connector draws a **dashed jumper arc** over the card to the outgoing connector.
- **Error:** border `--err`, the formula row is replaced by the message (Archivo 12 `--err`), and the thumbnail is overlaid with an `--err-wash` hatch.

**Region card** (first): token "*z*", name "Region". The thumbnail shows the source region. The body reads "3 shapes" with three 8 px dots in the shape colours. No stamps.

**Connector** (36 px wide): a 1.25 px `--ink-3` line at the card's thumbnail mid-height, with an open 6 px arrowhead. The plane variable sits 4 px above it in Newsreader italic 13 `--ink-2` (*z*, *w*₁, *w*₂…).

**Add slot**: width 132, radius 6, 1 px **dashed** `--line-3`. Centred: a 20 px plus icon, "Add function" in Archivo 12.5/500 `--ink-2`, and a `kbd` "F" below. Hover: `--sunk` background and a solid `--accent` border. Shortcuts F or `/` open the palette.

### 5.10 Add-function command palette

- **Position:** a centred floating panel at `top: 12vh`, width `min(680px, 100vw − 32px)`, max-height `min(560px, 100vh − 96px)`, level 3, radius 8, bg `--raised`. On phones it is a bottom sheet (radius 8 8 0 0, 85vh).
- **Search row** (44 px): a 16 px search icon `--ink-3`, then an input with no border, Archivo 15, placeholder "Search functions: log, Möbius, z^2, Cayley…". 1 px `--line-1` below it.
- **Body:** two columns at ≥ 860 px (`1fr 216px`); a single column below that.
  - **Results:** grouped by family. Group heading: Newsreader italic 13 `--ink-3`, 28 px, sticky. Each row is 48 px: `112px | 1fr | auto`.
    - Column 1: the formula (MathJax 15, left-aligned).
    - Column 2: the name (Archivo 13/600) and a one-line description (Archivo 12 `--ink-3`), e.g. "Cayley: maps the upper half-plane onto the unit disc", "Joukowski: circles through ±1 become airfoils", "Logarithm: unwraps an annulus into a rectangle; slit at the cut".
    - Column 3: mini stamps (14 × 12).
    - The active row has an `--accent-wash` background (the whole row, **no side rail**). Hover moves the active row.
  - **Preview column:** a 184 × 184 mini plate showing the current region pushed through the chain **with the candidate inserted at the insertion point**, captioned "Preview: image after adding *f*₃" in Newsreader 12.5 `--ink-3`. It renders at the reduced mesh (≤ 80) and is debounced 60 ms.
- **Search:** fuzzy over name, aliases (sqrt, root, cayley, joukowsky, rotation, scale, translate, inversion, reciprocal, blaschke, exp, ln, sin, arcsin…) and LaTeX. If the query parses as an expression in z, the first row is "Custom formula: *f*(*z*) = ⟨typeset⟩".
- **Footer** (32 px, `--panel`, Archivo 11.5 `--ink-3`): "↑ ↓ to move, ↵ to add, Esc to close".
- **Motion:** opacity 0 → 1, translateY 6 → 0 and scale 0.985 → 1, 160 ms `--ease-out`. Focus is trapped while open and returns to the add slot on close.

### 5.11 Guarantees panel (right)

Rename "Properties" to **Guarantees** (rail and toggle labels included).

1. **Title row:** "Guarantees" in Newsreader 17/600, plus a collapse icon button.
2. **Formula box:** bg `--plate`, 1 px `--line-1`, radius 2, padding `10px 12px`. "*F*(*z*) = …" in MathJax 16. Below it, the steps "*w*₁ = …" in MathJax 12.5 `--ink-2`, gap 2. Horizontal overflow scrolls with a right fade.
3. **"Guaranteed for *F*"** (Newsreader 15/600). A **ledger of rows, not boxes**: each row is `16px 1fr`, gap 8, padding `6px 0`.
   - Column 1: the **∎** glyph, drawn as a 9 × 11 `--good` rectangle (radius 0.5), baseline-aligned with the name.
   - Column 2: the name in Archivo 13/600 `--ink-1`, an optional inline tag (e.g. "deg 2": Archivo 11 tnum, `--sunk` background, radius 2, padding `0 4px`), and the reason in Archivo 12.5/17 `--ink-2` below it.
4. **"Not guaranteed":** a wrap list of 12.5 `--ink-3` items, each preceded by a hollow **□** (9 × 11, 1 px `--ink-4` border). The tooltip reads "Not implied by the steps. It may still hold."
5. **Warnings** (a step error, a constant map) are rows with a `--warn` triangle glyph on a `--warn-wash` background, radius 4, padding `8px 10px`. This is the **only** tinted box in the panel.
6. **"Natural domain *D*":** "All *z* for which:" followed by a MathJax list.
7. **"Step by step" matrix:**
   - Table width 100%, Archivo 11.5 tnum. First column 96 px ("*f*₁ Exponential", with the serif token and ellipsis). Then 7 columns of 22 px.
   - Header letters A E R P M Pr I in Archivo 10.5/700 `--ink-3` with tooltips.
   - Rows are 26 px with 1 px `--line-1` bottom rules. Cells hold **∎** (`--good`, 7 × 9) for yes and a 3 px `--ink-4` dot for no.
   - The **total row "F"** has a **double rule** above it (`border-top: 3px double var(--line-3)`) and 600 weight, like a ledger total.
   - Hovering a column washes it in `--sunk` and highlights the matching stamp letter on every card. Hovering a row outlines the matching card in `--line-3`.
8. **"How these are decided":** a `<details>` with a summary in Archivo 12.5/500 `--ink-1` and a chevron. The body is Newsreader 13.5/20 with `onum`, max 60ch.

### 5.12 Popovers, menus, modal, toasts

- **Popover / menu:** level 3, radius 8, padding 4, min-width 200. Items are 30 px tall, radius 4, padding `0 10px`, Archivo 12.5. Hover: `--sunk`. Shortcuts are right-aligned in `--ink-3`. Separators are 1 px `--line-1` with 4 px margins. Entry: 120 ms opacity plus 4 px translate from the anchor side.
- **Modal (Guide):** `--scrim` with `backdrop-filter: blur(2px)`. The panel is max-width 680, radius 8, padding `28px 32px`, bg `--raised`. Title: Newsreader 26/500. Body: Newsreader 15/23 with `onum`, max 62ch. Section heads: Newsreader 17/600. Use real `kbd` styling. Close is an icon button at the top right; Esc also closes.
- **Toast:** bottom-centre, 16 px from the bottom, level 3, radius 4, padding `8px 12px`, Archivo 12.5. An inline quiet "Undo" button. Lasts 4 s. Example: "Chain cleared. Undo".

### 5.13 Side-panel rails

- **Size:** 40 px wide, full height, `--panel`, radius 6.
- **Top:** a 28 px chevron icon button.
- **Label:** vertical (`writing-mode: vertical-rl`; the left rail is also rotated 180°), Archivo 12/500 `--ink-2`, **sentence case**: "Region tools", "Guarantees".
- **Guarantees rail:** under the label, a column of small ∎ glyphs (one per guaranteed property, `--good`), so the count shows even when collapsed.
- **Hover:** `--sunk`. The whole rail is the hit target.
- **Phones:** rails become full-width 40 px accordion headers.

---

## 6. Canvas and plot rendering

All plate drawing uses WebGL2, with Canvas2D for text and markers on top. Theme colours are read from the CSS custom properties on load and on every theme change, converted to linear-light floats for shaders, and passed as uniforms. **Never hard-code colours in JS.** Replace the literal `'rgba(255,255,255,0.18)'`, `'#888'`, `[0.62,0.66,0.72]` and similar values in `app.js` and `gl.js` with tokens.

### 6.1 Layer order (one plate)

1. Plate background `--plate`
2. Minor grid, then major grid
3. Axes and unit circle
4. Region fills (patterns, §6.3), at fill opacity (default 0.9)
5. Region boundaries, truncation edges
6. Curves (segments, lines, circles, freehand, grids), with orientation chevrons
7. Branch cuts (slit + hatch), images of cut banks
8. Poles, zeros, branch points
9. Points and their labels
10. Selection handles, draft geometry, snap flashes
11. Probe crosshair
12. Tick labels and axis names, with halos (always on top so fills never hide them)
13. HTML overlays (controls, readout, legend, progress)

### 6.2 Grid, axes, labels

- **Steps:** major step is `niceStep(110 / scale)` (1, 2, 5 × 10ᵏ, as today); minor step is major/5.
- **Minor grid:** 1 *device* pixel in `--grid-minor`. Its alpha fades from 0 to 1 as the minor spacing goes from 10 to 22 CSS px, so zooming never pops.
- **Major grid:** 1 CSS px in `--grid-major`.
- **Axes:** 1.25 px `--axis`, pixel-snapped. Axis names in Newsreader italic 13 `--axis-label`: "Re *z*" just above the positive real axis, 8 px from the right edge; "Im *z*" just right of the positive imaginary axis, 8 px from the top. On the image plate, use the stage variable (Re *w*, Im *w*₁…).
- **Unit circle:** 1 px `--axis`, dash [2, 3], alpha 0.7. When its radius is above 80 px, a tiny label "|*z*| = 1" in Newsreader italic 11 sits at angle 40°.
- **Tick labels:** Archivo 10.5 tnum `--axis-label`. Every label is drawn with `strokeText` first (3 px `--halo`, round join), then `fillText`, so it reads over any pattern.
  - Real labels go 6 px below the real axis. Imaginary labels go 6 px right of the imaginary axis, formatted "2*i*", "−*i*", "0.5*i*" (the *i* in Newsreader italic).
  - When an axis is off-screen or within 24 px of an edge, its labels **dock** to the bottom or left edge on a 16 px band. The band is a 16 px gradient from `--plate` at 85% to transparent, so docked labels sit on paper, not on the fill.
  - Use U+2212 for minus.
  - Skip any label within 14 px of an edge, and skip the label at the origin (draw "0" once, below-left of the origin).

### 6.3 Region fills: patterns carried by the map

Every pattern is a function of the **source** coordinate `src` (the point in the *z*-plane). This is why it deforms with the map. Cell size `cell = niceStep(extent / 10)`, where `extent` is the width of the shape's own bounding box clipped to the domain extent (§6.12). Use the shape's box, not the left view, so the pattern doesn't change when you pan.

**Derived colours.** Mix in sRGB, where S is the shape colour and P is `--plate`.

| Derived | Light | Dark |
|---|---|---|
| `tintA` (strong tone) | mix(P, S, 0.78) | mix(P, S, 0.82) |
| `tintB` (light tone) | mix(P, S, 0.40) | mix(P, S, 0.46) |
| `wash` (background for line patterns) | mix(P, S, 0.20) | mix(P, S, 0.24) |
| `inkS` (lines, boundary, glyphs) | mix(S, #10161F, 0.38) | mix(S, #FFFFFF, 0.42) |

**Anti-aliasing and anti-moiré** apply to every pattern. Line coverage uses `fwidth`:

```glsl
float iso(float v, float px){            // AA lines at integer values of v, width px
  float w = max(fwidth(v), 1e-6);
  float d = abs(fract(v + 0.5) - 0.5);
  float hw = 0.5 * px * w;
  return 1.0 - smoothstep(hw - 0.75*w, hw + 0.75*w, d);
}
float moire(vec2 g){                     // 0 = crisp, 1 = too dense: blend to mean tone
  vec2 w = fwidth(g); return smoothstep(0.18, 0.45, max(w.x, w.y));
}
```

When `moire > 0`, mix the pattern towards its mean colour (for example (tintA+tintB)/2). Near poles and near the far edge of the image, this replaces the current aliasing noise with a calm tone.

**The 8 patterns.** These are offered in a 4 × 2 swatch grid in the "Pattern" section. Each swatch is 52 × 40, radius 2, a live render of the pattern in shape 1's colour, with the name below in Archivo 10.5. The selected swatch gets a 1.5 px `--ink-1` ring with offset 2.

| # | Name | Appearance (all in source coords) |
|---|---|---|
| 1 | **Checker** (default) | Cells `cell × cell`. Parity of floor(x/cell)+floor(y/cell) picks tintA or tintB. With "Cell edges" on, `iso` lines at cell edges: 0.75 px `inkS` at 45%. |
| 2 | **Conformal checker** | Log-polar about the origin (option: about the shape centre). u = ln\|z\| / (2π/16), v = arg z / (2π/16), so there are 16 sectors and the radial ratio is e^{π/8} ≈ 1.481. Cells are near-squares, and they **stay square under conformal maps**, which is the teaching point. Parity gives tintA or tintB. Inside radius cell/12 of the centre, use a flat tintA disc. |
| 3 | **Grid** (Needham) | `wash` fill. Lines at x = k·cell and y = k·cell: 1 px `inkS` at 80%. Every 5th line is 1.6 px at 100%. |
| 4 | **Polar web** | `wash` fill. Circles \|z\| = k·cell: 1 px `inkS` at 75%, every 5th 1.6 px. 24 rays (15°): 1 px at 75%; the rays at 0°, 90°, 180°, 270° are 1.6 px. |
| 5 | **Hatch** (engraving) | `wash` fill. Parallel lines along (x + y)/√2 with spacing cell/3: 0.9 px `inkS` at 85%. Under the map, hatch angle shows arg *f*′ and density shows \|*f*′\|. Option "Cross-hatch" adds the −45° family at 55%. |
| 6 | **Flags** (orientation) | tintB fill. In each cell, with local (s, t) ∈ [0,1)²: a staff from (0.32, 0.18) to (0.32, 0.82), 0.06 cell wide, plus a filled triangle (0.32, 0.82), (0.74, 0.67), (0.32, 0.52), both in `inkS` via SDF with `fwidth` edges. Rotation, scaling and **mirroring** (conjugation, orientation reversal) are visible at a glance. |
| 7 | **Source hue** | The phase portrait of the identity, carried forward: hue = wheel(arg(z − c₀)), lightness banded by log₂\|z − c₀\| as in §6.7 "Lithograph", with c₀ = 0. It shows where each image point came from, in the same colours as the Phase tab. The boundary (in `inkS`) identifies the shape. |
| 8 | **Solid** | tintA flat. Boundary only. |

**Overlap:** draw shapes in list order, each at fill opacity α (default 0.9, slider range 0.3–1), using premultiplied "over".

### 6.4 Boundaries and curves

- **Area boundary** (the true ∂ of the region): 1.75 px `inkS`, round joins.
- **Curve shapes** (segment, line, ray, circle, arc, freehand, grids): 2.25 px in the shape colour **S**, over a 4.5 px `--halo` underlay at 80%. Grid shapes use 1.25 px with every 5th line at 1.75 px.
- **Orientation chevrons:** one open 6 px chevron at 50% arc length on each open curve, and on closed boundaries at 0° from the shape centre, in the same colour. This makes orientation reversal visible (for example after *z̄* or 1/*z*). Toggle "Orientation marks" (default on).
- **Selected shape** (input plate only): +1 px on the boundary. Handles are 9 × 9 squares filled `--plate` with a 1.5 px `inkS` border; on hover the fill becomes S. The move handle is a 10 px circle.
- **Draft** (while drawing): the boundary in S at 1.5 px, dash [5, 4], pattern at 50% opacity. A live dimension chip (level 2) sits 12 px from the cursor: "r = 1.25", "centre 0.5 + 0.2*i*", "θ = 45°".
- **Truncation edge** (an artificial cut of an unbounded region, §6.12): 1.25 px `--ink-3`, dotted [1, 3]. The fill fades to transparent over the last 18 px inside the edge (screen space), so it never looks like a real boundary.
- **Thumbnails:** all weights ×0.75, no chevrons, no labels.

### 6.5 Points and labels

- **Marker:** a 9 px disc in S, with a 2 px `--halo` ring and an outer 0.75 px `--ink-1` hairline at 40%.
- **Label:** Newsreader italic 14 `--ink-1` with a 3 px `--halo` stroke, offset (+7, −7), flipping to the left or below near edges.
- **Naming:** points are named *a*, *b*, *c*… in the *z*-plane (or the user's label). Their images are **primed** in any later plane: *a*′ (Needham's convention). In the morph view the label is *a*ₜ.
- **Probe crosshair:** 1.5 px `--probe`, a 7 px ring plus four 6 px ticks with a 4 px gap. On the phase plate, the probe draws white (`#FFFFFF`) with a 1 px `#10161F` outer line, so it reads on any hue.
- **Snap flash:** a 6 × 6 square at the snapped point, `--accent`, fading out over 160 ms.

### 6.6 Branch cuts, branch points, poles, zeros

- **Branch cut: a hatched slit.** A solid 1.75 px `--cut` line plus 5 px ticks (1.25 px) every 9 px on the **counter-clockwise side** (the side the principal value approaches from). This is the classic "plane slit along…" figure and replaces the current red dashes.
- **Branch point:** a 6 px hollow ring, 1.5 px `--cut`, with a `--halo` fill.
- **Editable cut handle:** a 14 px `--cut` disc with a 4 px `--halo` centre dot and a 2 px `--halo` ring. An attached level-2 chip reads "cut at 180°" (Archivo 12 tnum).
  - **While dragging,** a faint protractor appears around the branch point: a circle at 0.6 × the handle radius, 1 px `--cut` at 35%, with 15° ticks (5 px; 10 px at multiples of 90°). The angle snaps to 15° with Shift.
- **Images of the cut's banks** (in the output plate of that step): two 1.25 px `--cut` lines at 70%, dash [3, 3]. They show where the slit went.
- **Pole:** a 9 px × (two 1.75 px strokes) in `--pole`, over a 4.5 px `--halo` × underlay.
- **Zero** (when known, e.g. polynomial and rational steps): a 7 px ring, 1.75 px `--zero`, with a halo.
- On the **phase plate**, poles and zeros take a white halo with a dark core (as for the probe) so they read on any hue.
- In thumbnails, marker sizes are ×0.66 and ticks are omitted.

### 6.7 Phase portraits (domain colouring)

**Render path.** A fragment shader evaluates the composite F per pixel. Compile the chain's expression trees to GLSL complex arithmetic (`cmul`, `cdiv`, `cexp`, `clog(z, cutAngle, sheet)`, `csin`…). It re-renders at full DPR on every pan and zoom frame. The CPU per-pixel loop and the blurry ¼-resolution upscale go away. A CPU fallback (in a Worker, half resolution, nearest-neighbour upscale, then full) is used only when compilation fails.

**Hue wheel "Lithograph"** (default). This is perceptually even, so there are no false yellow or cyan bands. The colour is OKLCH with L₀ = 0.74, C₀ = 0.125 and hue h = 25° + arg w. So arg 0 is a soft red, and increasing arg runs counter-clockwise through ochre, green, cyan, blue and violet. Clamp C to the sRGB gamut per hue (bake a 1D 256-entry LUT texture of max chroma at L₀; the minimum is 0.1258 at h ≈ 200°, so C₀ = 0.125 is in gamut nearly everywhere).

Anchor check values (arg → sRGB): 0° `#F28881`, 30° `#E99355`, 60° `#D0A43A`, 90° `#A8B44B`, 120° `#73C076`, 150° `#2DC5A6`, 180° `#15C1D0`, 210° `#47B7F1`, 240° `#82A8FD`, 270° `#B199F4`, 300° `#D48DD8`, 330° `#EA86AF`.

OKLab → linear sRGB (Ottosson):

```glsl
vec3 oklab2lin(vec3 c){
  float l_ = c.x + 0.3963377774*c.y + 0.2158037573*c.z;
  float m_ = c.x - 0.1055613458*c.y - 0.0638541728*c.z;
  float s_ = c.x - 0.0894841775*c.y - 1.2914855480*c.z;
  float l = l_*l_*l_, m = m_*m_*m_, s = s_*s_*s_;
  return vec3( 4.0767416621*l - 3.3077115913*m + 0.2309699292*s,
              -1.2684380046*l + 2.6097574011*m - 0.3413193965*s,
              -0.0041960863*l - 0.7034186147*m + 1.7076147010*s);
}
vec3 wheel(float arg, float L, float Cscale){            // arg in radians
  float h = radians(25.0) + arg;
  float C = min(0.125, texture(uCmax, vec2(fract(h/6.2831853), 0.5)).r) * Cscale;
  return oklab2lin(vec3(L, C*cos(h), C*sin(h)));         // then encode to sRGB
}
```

**Wheel "Vivid"** (option): classic HSV with S = 0.85 and V = 0.95, red at arg 0, as in Wegert's standard portraits. Anchors are `#F22424 #F28B24 #F2F224 #8BF224 #24F224 #24F28B #24F2F2 #248BF2 #2424F2 #8B24F2 #F224F2 #F2248B`.

**Colouring modes** (a "Colouring" menu in the phase legend chip):

| Mode | Lightness / overlays |
|---|---|
| **Lithograph** (default) | Modulus sawtooth: s = fract(log₂\|w\|), L = L₀·(0.80 + 0.20·s), C scaled by L/L₀. The sawtooth jump is anti-aliased over 1 px. Plus **12 phase isolines** (arg ≡ k·30°) at 0.75 px `#10161F` 22%. Each band doubles \|w\|. |
| **Conformal tiles** | Wegert's conformal portrait: sₘ = fract(ln\|w\| / (2π/16)) and sₚ = fract(16·arg/2π). L = L₀·(0.74 + 0.13·sₘ + 0.13·sₚ). Tiles are near-squares wherever F is conformal; zeros and poles become 16-armed stars. |
| **Phase only** | L = L₀, C = C₀. The clearest view of zeros and poles (colour order around zeros is counter-clockwise, around poles clockwise). |
| **Classic landscape** | L = 0.06 + 0.9·(2/π)·atan(\|w\|^0.6) and C = C₀·4L(1−L): zeros black, poles white. |
| **Pull-back grid** | Hue at C·0.55, L 0.86. Lines Re w = kΔ in `#1B2A3A` and Im w = kΔ in `#7A3E14`, both 0.9 px at 60%, with Δ = niceStep(image extent / 8). The circle \|w\| = 1 is 1.6 px `#FFFFFF` 85% with a 0.6 px `#10161F` core. This shows the image coordinate grid pulled back to the domain. |

Isolines fade out (`alpha *= 1 − smoothstep(0.15, 0.35, fwidth(v))`) where they would crowd. NaN pixels are `#8E97A0` with a 45° hatch. Infinite values are white `#FFFFFF`.

**Overlays on the phase plate:**
- Axes 1 px `#FFFFFF` at 55%.
- Tick labels white with a 3 px `#10161F` 60% halo.
- Region outlines (toggle "Region outline", default on): a 3 px `#FFFFFF` 90% underlay plus a 1.25 px `#10161F` core.
- Cuts as in §6.6.

**Legend chip** (bottom-right, about 132 × 72, level 2, padding 8):
- Left: a **hue ring**, outer radius 24, inner radius 14, drawn with `conic-gradient(from 90deg, …)` using 36 stops sampled from the active wheel in **reverse** arg order (CSS conics run clockwise from north; this puts arg 0 at east, increasing counter-clockwise). Labels sit outside the ring in Newsreader italic 11 `--ink-2`: "1" at east, "*i*" north, "−1" west, "−*i*" south.
- Right: "arg *w*" (Newsreader italic 12), and below it a **modulus key**: three stacked 30 × 6 bars showing the sawtooth, with "×2 per band" in Archivo 10.5. In Conformal tiles mode the key reads "16 sectors, ratio e^{π/8}".
- Collapsed: a 20 px hue ring.

### 6.8 Relief: the 3D analytic landscape

The goal is a convincing physical model, a **block diagram** like a geological plate. The surface stands on its own domain plate, with walls, lighting, contours and a height scale.

- **Geometry:**
  - The domain is the left view box, normalised so its longer side spans [−1, 1].
  - **Height:** h = 0.25·clamp(ln\|F\|, −4, 4). Mode "|F|" gives h = 0.28·min(\|F\|, 4) − 0.4.
  - **Grid:** 320 × 320 vertices at idle and 160 × 160 while the *view or chain* is changing. **Orbiting never rebuilds geometry.** Upload positions once to static VBOs; heights can be a float texture sampled in the vertex shader.
- **Pole caps and zero wells:** where h hits +1 or −1, the surface is flat (a "cut column") and coloured by phase. A 1.25 px `#10161F` 70% ring is drawn at the clamp contour. Remove the current tear-out holes; quads are dropped only for NaN.
- **Skirt walls:** extrude the four domain edges down to the floor. Wall colour is the edge's surface colour × 0.55, plus vertical hatch lines every 1/64 of the edge length (0.75 px `#10161F` 30%). The top edge of each wall is 1 px `#10161F` 60%. This gives the "model cut out of the landscape" look.
- **Floor:** the domain plate at z = −1.08, extended 6% beyond the walls, coloured `--plate`. On it: the major grid (`--grid-major`), axes (`--axis`), tick labels along the front two edges (Archivo 10.5 `--axis-label`, drawn in 2D after projection), "Re *z*" and "Im *z*" axis names, and the phase portrait **printed on the floor at 22% opacity** (the same shader). The floor has a 10% radial vignette from its centre to its edge.
- **Material:**
  - Base colour is the phase wheel and mode from §6.7, evaluated **per fragment** from F (not per-vertex colours), so contours stay crisp.
  - Normals are per fragment from screen-space derivatives of world position (`normalize(cross(dFdx(p), dFdy(p)))`). This gives faceting-free, sharp lighting at poles.
- **Lighting:**
  - Hemisphere ambient: sky `#E6EEF6` × 0.38, ground `#8C918A` × 0.14.
  - Key light: directional from azimuth 135° (upper left, behind the viewer's left shoulder), elevation 50°, colour `#FFF7EC`, Lambert × 0.78.
  - Specular: Blinn-Phong, shininess 42, strength 0.14 (satin porcelain, not plastic).
  - Rim: Fresnel (1 − n·v)³ × 0.10 in `#FFFFFF`.
  - Cavity: multiply by (1 − 0.25·(1 − n_z)²) to deepen the slopes.
  - Dark theme: same values, with sky ambient × 0.30.
- **Contours on the surface:** modulus contours at \|F\| = 2ᵏ, 0.9 px `#10161F` 45%. **The unit-modulus contour \|F\| = 1** ("sea level") is 1.8 px `#FFFFFF` 90% with a 0.6 px dark core. Phase isolines (12) are 0.6 px `#10161F` 22%. All use the `iso()` helper in screen-space width.
- **Height scale:** a vertical ruler at the back-left floor corner, from h = −1 to 1, 1 px `--ink-2`, ticks at \|F\| = 0.1, 1, 10 (and 0.01 / 100 when visible) labelled "0.1", "1", "10" in Archivo 10.5 tnum, plus "|*F*|" in Newsreader italic 12 at the top. Labels are drawn in 2D at projected positions with halos.
- **Background:** a vertical gradient from `--relief-sky` (top) to `--relief-ground` (bottom), with depth fog that mixes towards the background colour by `smoothstep(near, far, d)·0.30` over the far half of the model.
- **Camera:**
  - Perspective, FOV 30°. Default yaw −38°, pitch 34°, distance auto-fit to the bounding sphere × 1.08.
  - Drag orbits at 0.30°/px yaw and 0.25°/px pitch (clamped 6°–88°), with inertia (velocity × 0.90 per frame).
  - Wheel zooms ×1.1 per notch, eased over 120 ms. Shift-drag pans. Double-click resets.
  - Two quiet overlay buttons: "Plan view" (pitch 88°, animated 280 ms) and "Reset camera". MSAA on, DPR up to 2.
- **Probe:** hovering the left plate draws on the relief a 6 px dot at (z, h(z)) in `--probe` with a halo, a 1 px dotted drop line to the floor, and a 4 px floor dot.
- **Legend chip:** "height = log |*F*|" (or "|*F*|, clipped at 4"), with the same hue ring as Phase at 0.6 scale.

### 6.9 Sphere: F on the Riemann sphere

- **Two modes** (segmented in the legend chip):
  - **Phase**: the phase portrait of F over the whole extended plane, via inverse stereographic projection, computed per fragment. For unit sphere point (ξ, η, ζ), z = (ξ + iη)/(1 − ζ); the north pole ζ = 1 is ∞.
  - **Image**: the pushed-forward region meshes lifted to the sphere with their patterns.
- **Material:** the same lighting as the relief, with specular 0.22 and shininess 64 (a lacquered globe), plus a soft contact shadow under the sphere (radial gradient ellipse, 1.6:0.35 aspect, `#10161F` 18% → 0).
- **Graticule:**
  - Meridians every 30° (arg z = const): 0.7 px `#10161F` 30%.
  - Parallels at \|z\| = ¼, ½, 1, 2, 4 (latitude ζ = (r² − 1)/(r² + 1)): 0.7 px 30%.
  - **The equator \|z\| = 1:** 1.4 px `#10161F` 70% with a 2.5 px `#FFFFFF` 60% underlay.
  - Poles: 3 px dots labelled "∞" (north) and "0" (south) in Newsreader italic 16 with halos, drawn in 2D at projected positions. Labels on the hidden hemisphere fade to 0.
- **Equatorial plane** (toggle "Show plane", default off): a disc of radius 2.4 through the equator, `--plate` at 14% with the major grid at 25%. It is clipped by the sphere's depth so the sphere sits half through it, as in Needham's figures.
- **Probe:** a 1 px `--probe` line from the north pole through the sphere point to the plane point, with dots at all three.
- **Interaction:** arcball rotation with inertia; wheel zooms (FOV fixed at 28°). The default orientation is tilted 20° towards the viewer so both poles are visible.
- **Background:** as the relief.

### 6.10 Morph

- **Plate:** the regular image plate. The **start** outline (t = 0) is drawn dotted [1, 3] `--ink-3` at 50%, and the **end** outline (t = 1) is dashed [4, 3] `--ink-3` at 50%. Patterns and points move. Point labels read *a*ₜ.
- **Scrubber:** a level-2 overlay spanning the bottom of the plate (8 px inset, height 36).
  - A 28 px play/pause icon button.
  - A track divided into **one segment per active step**, labelled *f*₁, *f*₂ above the track in Newsreader italic 11. Segment boundaries are 1 × 8 ticks.
  - A speed toggle 0.5× / 1× / 2× (quiet segmented, 24 px).
  - A homotopy menu: "Step by step" or "Straight line".
  - The readout "*t* = 0.42" in Archivo 12 tnum, 6ch slot.
- **Timing:** 2.0 s per step, eased with `--ease-in-out`, a 0.6 s hold at the end, and a loop. Pausing keeps the frame.

### 6.11 Thumbnails (cards, palette preview, Examples menu)

These use the same renderer and colours at 0.75× line weights, with no tick labels or chevrons. Use one shared WebGL context and render into per-thumb 2D canvases only when they change, debounced 60 ms. Thumbs never re-render on pan or zoom of the main plates.

### 6.12 Image fidelity (fixes "the right image only shows what the left view shows")

- **Mesh each region over its own extent, never over the left view.**
  - **Bounded shapes** (disc, polygon, annulus, sector, rectangle, lasso) are meshed over their own bounding box, whatever the left view shows.
  - **Unbounded shapes** (half-plane, strip, complements, formula sets, lines and rays) are meshed inside a **domain extent** disc |z| ≤ R. R defaults to max(10, 4 × the left view's half-diagonal). It is set in Display ("Extent of unbounded regions: R"), and the mesh is refined adaptively towards the far edge.
- **Honest truncation.** The artificial edge is drawn as a truncation edge (§6.4) in **both** plates. When R is within 1.5× of the left view, the input plate shows a dotted circle "|*z*| = R" in `--ink-3`. The caption mentions it.
- **Panning the left plate** does **not** rebuild meshes unless the view leaves the extent. Then the extent grows (×2) in the background, and the new mesh is swapped in when ready.
- **Image plate fitting** uses the full image's robust bounding box (1st–99th percentile, as today) and animates the view change (§7).

---

## 7. Motion and micro-interactions

### 7.1 Tokens

```css
--ease-out:    cubic-bezier(0.2, 0.7, 0.2, 1);
--ease-in-out: cubic-bezier(0.45, 0, 0.25, 1);
--d-1: 90ms;   /* colour/hover */
--d-2: 140ms;  /* segmented thumb, toggles, chevrons */
--d-3: 200ms;  /* popover/menu/drawer in */
--d-4: 280ms;  /* view fits, plan view, panel collapse */
--d-5: 450ms;  /* chain-change homotopy */
```

No hover lifts, no scale-on-hover, no entrance animations on page load.

### 7.2 The signature moment: changes animate as homotopies

When the chain changes **discretely** (add, remove, invert, reorder, bypass, choose a preset, load an example), the image plate morphs from the old image to the new one over `--d-5` with `--ease-in-out`. It lerps vertex positions of the same source mesh between the old and new stage arrays, capped at mesh 120 during the transition, then swaps to full resolution. The caption crossfades at the same time. Continuous edits (typing a parameter, dragging a cut or handle) update live with no animation.

### 7.3 Views

- **Fit / Fit to region:** animate cx and cy linearly and scale **in log space** over `--d-4` `--ease-out`.
- **Wheel zoom:** eased over 120 ms towards the target. Pinch zoom is 1:1.
- **Drag pan:** 1:1, with momentum on touch only (decay 0.92 per frame).
- **Focus change** (clicking a card): both plates crossfade 160 ms. The verdigris connector highlight moves at the same time.
- **Panel collapse / expand:** grid column width animates over `--d-4`. Plates re-render at the final size once the animation ends (use transform scaling of the last frame during the animation; no re-render per frame).

### 7.4 Micro-interactions

- Hovering in either plate probes both. The card thumbnails show the probe dot, and the relief and sphere show the probe (§6.8, §6.9).
- Hovering a shape row thickens that shape in both plates and dims the others to 60% over `--d-1`.
- Hovering a guarantees row or a matrix column highlights the matching stamp letter on every card. Hovering a matrix row outlines the matching card.
- Dragging the cut handle shows the protractor (§6.6) and the live angle chip; the step card's "cut" field updates in sync.
- Snapping flashes the snapped point (§6.5). Drawing tools show a live dimension chip.
- Clicking the coordinate chip copies the value and shows "Copied" (1.2 s).
- Destructive actions (Clear chain, Delete shape, Clear shapes) show an Undo toast for 4 s instead of a confirmation dialog.
- Any computation slower than 150 ms shows the plate's progress line; there are no spinners.
- `prefers-reduced-motion: reduce`: all durations become 0, homotopy transitions and morph autoplay are off, and momentum is off.

### 7.5 Performance budget (part of the design, because "laggy" was the complaint)

| Interaction | Budget | How |
|---|---|---|
| Pan or zoom any 2D plate | 60 fps, ≤ 8 ms JS per frame | Positions live in world space in static VBOs, uploaded once per mesh. The view is a uniform. No per-frame `bufferData` or clip-space conversion in JS. Curves are cached in world space and transformed on draw. |
| Phase plate pan or zoom | 60 fps at DPR 2 on a 1440 × 900 laptop | Fragment shader (§6.7). |
| Relief or sphere orbit | 60 fps | Camera-only redraw. Geometry is untouched. |
| Parameter edit to first pixels | ≤ 50 ms | Preview mesh ≤ 120 shown immediately. Full mesh is refined in a Worker and swapped in ≤ 300 ms, with no visible blur step. |
| Add a step | Transition starts ≤ 16 ms | §7.2 uses the cached old stage. |

Draw directly into the visible WebGL canvas for each plate. Use one context per main plate (two or three in total) and the shared context for thumbnails. Stop blitting a shared offscreen GL canvas into 2D canvases for the main plates; that copy is a large part of the current lag.

---

## 8. The 10 most important changes vs. the current screenshots (by impact)

1. **The image plate shows the whole image.** Today regions are meshed only inside the left view (`clipWin`), so the right plate shows only what the left one shows (screenshot 3: half a disc). Mesh each shape over its own extent, truncate unbounded ones honestly at |z| = R with a dotted, feathered edge, and say so in the caption (§6.12).
2. **Smooth at 60 fps.** World-space static buffers with the view as a uniform, a GPU phase portrait, camera-only orbits, Worker refinement, and no offscreen-to-2D blits. The blurry low-resolution domain-colouring pass is removed (§7.5).
3. **The 3D view becomes a real model.** Per-fragment phase colour and normals, key, hemisphere and specular lighting, modulus and phase contours with the |F| = 1 "sea level" line, capped poles instead of holes, skirt walls, a domain-plate floor with the portrait printed on it, a height ruler in |F|, and inertia orbit. A new **Riemann sphere** view is added alongside it (§6.8, §6.9).
4. **Phase portraits with colour science and a key.** An even OKLCH "Lithograph" wheel, five colouring modes (including Wegert's conformal tiles and a pull-back grid), anti-aliased isolines, and a hue-ring legend with a modulus key (§6.7).
5. **Planes become plates.** A keyline plus plate mark, auto-written figure captions, a scale bar that turns into a typeset coordinate readout, edge-docked tick labels with halos, axis names, and hover-revealed zoom/fit/expand. The grey header and footer bars and the floating note go away (§5.8, §6.2).
6. **Eight patterns carried by the map,** chosen from live swatches: Checker, Conformal checker, Grid, Polar web, Hatch, Flags, Source hue, Solid. Tints are derived per theme, anti-moiré is applied, and orientation chevrons show reversal (§6.3, §6.4).
7. **New visual system:** vellum and night-plate tokens, a single verdigris accent, Newsreader + Archivo with Red Hat Mono only for source. All tracked uppercase headings, green status boxes, mono labels and Unicode icons are removed, and a custom engraved-hatch SVG icon set is added (§2, §3, §5.2, Appendix A).
8. **The chain reads as a commutative diagram.** Connectors carry the plane names, and the focused card lights its two connectors to match the plates. Cards are rebuilt: 3 header icons plus overflow, typeset parameter symbols, Argand-pad complex inputs, a presets menu, and quiet property stamps (§5.5, §5.9).
9. **The add-function palette becomes a searchable command palette** with descriptions, aliases, keyboard navigation, custom-formula fallback and a live preview of the image after adding the step (§5.10).
10. **Guarantees panel as a proof ledger:** ∎ for guaranteed and □ for not, rows instead of tinted boxes, a step matrix with a double-ruled total row, and cross-highlighting with the cards. The panel is renamed "Guarantees" and its rail shows the ∎ count (§5.11, §5.13).

---

## Appendix A: UI icon paths (16 × 16, stroke 1.5, round caps and joins, `currentColor`, fill none unless noted)

| Icon | Path data |
|---|---|
| plus | `M8 3.5v9M3.5 8h9` |
| minus (zoom out) | `M3.5 8h9` |
| close | `M4.5 4.5l7 7M11.5 4.5l-7 7` |
| chevron-left / right | `M10 3.5L5.5 8l4.5 4.5` / `M6 3.5L10.5 8 6 12.5` |
| more (fill) | circles r 1.1 at (3.5,8), (8,8), (12.5,8) |
| eye | `M1.75 8s2.3-4.25 6.25-4.25S14.25 8 14.25 8s-2.3 4.25-6.25 4.25S1.75 8 1.75 8z` + circle (8,8) r 2 |
| eye-off | eye path + `M2.5 13.5l11-11` |
| fit | `M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3` + circle (8,8) r 1.75 |
| expand / restore | `M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9` / `M13 3L9 7M9 3.5V7h3.5M3 13l4-4M7 12.5V9H3.5` |
| undo / redo | `M5.5 3.5l-3 3 3 3M2.5 6.5h7a3.5 3.5 0 0 1 0 7H6` / `M10.5 3.5l3 3-3 3M13.5 6.5h-7a3.5 3.5 0 0 0 0 7H10` |
| theme | circle (8,8) r 5.75 + filled `M8 2.25a5.75 5.75 0 0 1 0 11.5z` |
| bypass (jumper) | `M1.5 11h3.5M11 11h3.5M5 11C5 5 11 5 11 11` + rect x 6.5 y 9.5 w 3 h 3 |
| play / pause (fill) | `M5 3.5v9l7.5-4.5z` / rects (4.5,3.5,2.25,9) and (9.25,3.5,2.25,9) |
| search | circle (7,7) r 4.25 + `M10.25 10.25l3.25 3.25` |
| grip (fill) | circles r 1 at (6,4) (10,4) (6,8) (10,8) (6,12) (10,12) |
| panel-left / panel-right | rect (2,2.5,12,11) rx 1.5 + `M6 2.5v11` / + `M10 2.5v11` |
| orbit (reset camera) | ellipse (8,8) rx 6 ry 2.75 + `M12 4.2l2 1.3-1.6 1.8` + filled circle (8,8) r 1.25 |
| copy | rect (5.5,5.5,8,8) rx 1.5 + `M10.5 5.5V3.75c0-.7-.55-1.25-1.25-1.25h-5.5c-.7 0-1.25.55-1.25 1.25v5.5c0 .7.55 1.25 1.25 1.25H5.5` |
| trash | `M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.75 9h5.5l.75-9` |
| guide (book) | `M8 4c-1.5-1-3.5-1.25-5.5-1v9.5c2-.25 4 0 5.5 1 1.5-1 3.5-1.25 5.5-1V3c-2-.25-4 0-5.5 1zM8 4v9.5` |
| warning | `M8 2.5l6 10.5H2z M8 6.5v3` + filled circle (8,11.25) r .8 |

## Appendix B: CSS token block (paste-ready)

```css
:root {
  color-scheme: light;
  --ground:#E3E7E2; --panel:#ECEFEA; --raised:#F7F8F5; --sunk:#DDE2DC; --field:#FCFCFA; --overlay:#FBFBF8E0;
  --ink-1:#16202C; --ink-2:#475261; --ink-3:#5A6572; --ink-4:#8E97A0;
  --line-1:#D0D6CE; --line-2:#A9B2AA; --line-3:#7E8880;
  --accent:#0D6E62; --accent-strong:#095449; --accent-wash:#D5EAE4; --accent-ring:#0D6E6247; --on-accent:#FFFFFF;
  --good:#2F6F2A; --good-wash:#DDEBD6; --warn:#8F5A00; --warn-wash:#F3E6CC; --err:#A8213E; --err-wash:#F5DDE2; --err-ring:#A8213E40;
  --plate:#FBFBF8; --plate-rule:#8F9890; --plate-mark:#C6CDC5; --grid-minor:#ECEEE9; --grid-major:#D5DAD3;
  --axis:#6F7972; --axis-label:#566069; --cut:#C0391F; --pole:#6B2A86; --zero:#16202C; --probe:#16202C; --halo:#FBFBF8;
  --scrim:#16202C5C; --relief-sky:#F4F5F1; --relief-ground:#E2E6E0;
  --shape-1:#3461B8; --shape-2:#C2436E; --shape-3:#4F8A2B; --shape-4:#C08417;
  --shape-5:#7B57C8; --shape-6:#16899E; --shape-7:#9A6B45; --shape-8:#5B6B80;
  --shadow-1:0 1px 2px #16202C1A, 0 0 0 1px var(--line-1);
  --shadow-2:0 14px 36px -10px #16202C47, 0 2px 6px #16202C1A;
  --f-plate:"Newsreader","Iowan Old Style",Charter,Georgia,serif;
  --f-ui:"Archivo",system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  --f-src:"Red Hat Mono",ui-monospace,"SF Mono",Menlo,Consolas,monospace;
  --r-1:2px; --r-2:4px; --r-3:6px; --r-4:8px;
  --ease-out:cubic-bezier(.2,.7,.2,1); --ease-in-out:cubic-bezier(.45,0,.25,1);
  --d-1:90ms; --d-2:140ms; --d-3:200ms; --d-4:280ms; --d-5:450ms;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* DARK BLOCK */ }
}
:root[data-theme="dark"] { /* DARK BLOCK (identical) */ }

/* DARK BLOCK =
  color-scheme: dark;
  --ground:#111823; --panel:#161E2A; --raised:#1C2533; --sunk:#0C121B; --field:#121A25; --overlay:#0F1620D9;
  --ink-1:#E5E9EF; --ink-2:#AEB8C5; --ink-3:#8B97A7; --ink-4:#5D6979;
  --line-1:#253041; --line-2:#3A475A; --line-3:#5E6E84;
  --accent:#5CC2B1; --accent-strong:#82D7C9; --accent-wash:#173532; --accent-ring:#5CC2B152; --on-accent:#062420;
  --good:#93CF73; --good-wash:#1C3420; --warn:#E8B04A; --warn-wash:#3A2C10; --err:#FF8592; --err-wash:#3E1A22; --err-ring:#FF859247;
  --plate:#0F1620; --plate-rule:#4A586C; --plate-mark:#263245; --grid-minor:#151E2A; --grid-major:#223042;
  --axis:#7A889A; --axis-label:#93A0B1; --cut:#FF6B4E; --pole:#D9A2EC; --zero:#E5E9EF; --probe:#E5E9EF; --halo:#0F1620;
  --scrim:#05080DB3; --relief-sky:#16233A; --relief-ground:#0B111A;
  --shadow-1:0 1px 2px #00000066, 0 0 0 1px var(--line-2);
  --shadow-2:0 18px 44px -10px #000000A6, 0 2px 6px #00000066;
*/
body { background: var(--ground); color: var(--ink-1); font: 400 12.5px/1.3 var(--f-ui); }
```

(The shape palette is theme-independent, so it lives only in `:root`. JS reads `--shape-1…8` instead of the hard-coded `PALETTE` array.)
