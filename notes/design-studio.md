# Complex Map Workbench: "Studio" design proposal

Direction: pro creative studio tool. Dark-first, with a light theme held to the same standard. The plots are the hero. Everything here is specified to the pixel or hex. Where something is a rule rather than a value, the rule is stated so it can be applied without judgment calls.

Contents
1. Concept
2. Color tokens (light, dark, shape palette, phase wheel)
3. Typography
4. Layout, spacing, radii, borders, elevation
5. Component specs
6. Canvas and plot rendering
7. Motion and micro-interactions
8. The 10 most important changes, by impact
Appendix A. Rendering contract (what the look depends on for speed)
Appendix B. Copy rules

---

## 1. Concept

**Studio** is a graphite instrument where the only saturated color comes from the mathematics: the phase wheel, the eight region inks, and the amber seam of a branch cut. The chrome stays neutral so every hue on screen means something. The layout borrows from pro studio tools. Five rounded *areas* (tools, domain viewport, image viewport, function chain, properties) dock on a darker well, and controls float over the planes as translucent overlays instead of sitting in boxed header and footer bars. Every flourish is a mathematical convention drawn precisely: dashed boundaries for open sets, zipper-ticked seams for branch cuts, conformal square tiles in color plots, and a brand mark that is the phase portrait of log *z*, slit along its cut. It all runs at frame rate because the view transform, the patterns and the color plots live on the GPU (Appendix A).

Five rules that decide everything else:

1. **Hue is reserved for meaning.** Chrome is neutral graphite plus one UI accent (azure). On a canvas, hue always means either *phase* or *which shape*. The UI accent never appears on a canvas. Selection on canvas is shown with geometry (handles, heavier stroke, glow in the shape's own ink), never with accent blue.
2. **Plots get the pixels.** Viewports have no footer bar. Their header is a single 32px row. Readouts, zoom and legends float over the plane.
3. **One radius per level of hierarchy.** Area 6, card 5, control 4, token 3, popover 8, modal 10. Shadows are used only for things that float (overlays, popovers, modals, toasts).
4. **Numbers are instruments.** All numerals are tabular. The minus sign is U+2212. The imaginary unit is a math-italic *i*. Values can be scrubbed by dragging.
5. **No decoration without a mathematical referent.** If an ornament can't be named in complex-analysis terms (seam, branch point, tile, contour, pole, keyhole), it is cut.

---

## 2. Color

All values are hex. Colors were defined in OKLCH and converted with gamut mapping (chroma reduced until in sRGB). Contrast ratios quoted are WCAG 2.x, measured.

### 2.1 Token block: exact CSS

Light is the `:root` default. Dark is written twice with identical declarations: once inside `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { … } }` and once as `:root[data-theme="dark"] { … }`. The theme switch writes `data-theme="light" | "dark"` on `<html>`, or removes the attribute for Auto.

```css
:root {
  color-scheme: light;
  /* surfaces */
  --well: #DDE0E4;            /* app background and the 4px gutters between areas */
  --area: #F8F9FB;            /* docked areas: tools, properties, chain, viewport headers */
  --area-2: #F3F5F7;          /* sunken strip inside an area: chain track, palette footer */
  --card: #FFFFFF;            /* step cards, formula boxes, shape rows when expanded */
  --raised: #FFFFFF;          /* popovers, menus, command palette, modal */
  --field: #EEF0F3;           /* text inputs, scrubbers, selects */
  --control: #FFFFFF;         /* secondary buttons */
  --control-hover: #F1F3F5;
  --control-active: #E7EAED;  /* pressed, and the "on" state of icon toggles */
  --hover: #1A1E250A;         /* translucent hover wash for rows and ghost buttons */
  --pressed: #1A1E2514;
  --selection: #D0E6FD;       /* selected list row and matrix column highlight */
  --overlay: #F8F9FBE0;       /* floating chips over planes (with backdrop blur) */
  --scrim: #1A1E2566;
  --tooltip-bg: #1A1E25;
  --tooltip-text: #F8F9FB;
  /* lines */
  --line: #DDE0E4;            /* dividers inside areas, field borders (light only) */
  --line-soft: #E8EAEC;       /* matrix row rules */
  --line-strong: #C0C4CA;     /* control borders, dashed add-card, popover outline */
  /* text */
  --text-1: #1A1E25;          /* 15.9:1 on --area */
  --text-2: #4F565E;          /* 7.1:1 */
  --text-3: #666C74;          /* 5.0:1 on --area, 4.6:1 on --field */
  --text-4: #9FA3A9;          /* disabled and decorative only, never for meaning */
  /* accent (chrome only, never on canvas) */
  --accent: #0068BC;          /* 5.4:1 on --area, white on it 5.7:1 */
  --accent-hover: #005AA4;
  --accent-soft: #DBECFE;     /* accent text on it 4.7:1 */
  --on-accent: #FFFFFF;
  --focus: #0068BC99;
  /* semantic */
  --good: #057B4C;  --good-soft: #DDF8E8;   /* 5.1:1 / 4.7:1 */
  --warn: #995B0E;  --warn-soft: #FEF0D4;   /* 5.2:1 / 4.8:1 */
  --error: #C52A38; --error-soft: #FEEDED;  /* 5.3:1 / 4.9:1 */
  /* planes */
  --plane: #FEFEFF;
  --grid-minor: #F0F2F4;
  --grid-major: #DDE0E4;
  --axis: #6F757D;            /* 4.6:1 on plane */
  --axis-label: #5B6168;      /* 6.2:1 on plane */
  --halo: #FEFEFF;            /* text and stroke halos on canvas = plane */
  --cut: #CA5B04;             /* branch-cut seam, 4.2:1 on plane */
  --cut-ink: #B04907;         /* cut label text on --cut-soft, 4.8:1 */
  --cut-soft: #FEECE1;
  --pole: #1A1E25;            /* singularities are drawn in ink, not hue */
  --zero: #181B1F;
  --handle: #FFFFFF;          /* shape edit handles (fill) */
  /* 3D and sphere */
  --bg3-top: #FAFCFE;  --bg3-bottom: #E4E6EA;
  --floor: #EEF0F3;    --floor-grid: #D3D6DA;  --frame: #9A9FA6;
  --sky: #F4F9FE;      --ground: #CEC1B8;      --graticule: #1E2226;
  /* brand mark slit = header background */
  --mark-bg: var(--well);
  /* elevation */
  --shadow-overlay: 0 1px 2px #1A1E250F, 0 6px 16px -6px #1A1E2524;
  --shadow-pop: 0 0 0 1px #DDE0E4, 0 16px 40px -10px #1A1E2533;
  --shadow-modal: 0 0 0 1px #DDE0E4, 0 24px 64px -12px #1A1E2540;
}

/* DARK: put these declarations in BOTH dark selectors */
  color-scheme: dark;
  --well: #0D0E11;
  --area: #1B1E21;
  --area-2: #16191C;
  --card: #222529;
  --raised: #272A2F;
  --field: #131619;
  --control: #2A2E33;
  --control-hover: #33373C;
  --control-active: #393E43;
  --hover: #FFFFFF0D;
  --pressed: #FFFFFF17;
  --selection: #19324B;
  --overlay: #1B1E21D9;
  --scrim: #05070A8C;
  --tooltip-bg: #33373C;
  --tooltip-text: #ECEFF2;
  --line: #2C2F34;
  --line-soft: #23262A;
  --line-strong: #474C52;
  --text-1: #ECEFF2;          /* 14.5:1 on --area */
  --text-2: #B4B9C1;          /* 8.5:1 */
  --text-3: #8E949C;          /* 5.5:1 on --area, 4.7:1 on --raised */
  --text-4: #5F656D;
  --accent: #5AB4FC;          /* 7.5:1 on --area */
  --accent-hover: #7CC4FF;
  --accent-soft: #173859;
  --on-accent: #0B121A;       /* 8.4:1 on accent */
  --focus: #5AB4FCB3;
  --good: #58DA98;  --good-soft: #143525;
  --warn: #F6C159;  --warn-soft: #3C2E14;
  --error: #F8767E; --error-soft: #4A2325;
  --plane: #121416;
  --grid-minor: #171A1D;
  --grid-major: #222529;
  --axis: #6B7177;            /* 3.7:1 on plane */
  --axis-label: #9EA4AB;      /* 7.3:1 */
  --halo: #121416;
  --cut: #FF9E4D;             /* 9.0:1 on plane */
  --cut-ink: #FEB57D;
  --cut-soft: #492811;
  --pole: #F4F5F7;
  --zero: #ECEFF2;
  --handle: #F4F5F7;
  --bg3-top: #1B1E23;  --bg3-bottom: #090B0E;
  --floor: #15171A;    --floor-grid: #272A2F;  --frame: #494D54;
  --sky: #8395A4;      --ground: #261D16;      --graticule: #ECEFF2;
  --mark-bg: var(--well);
  --shadow-overlay: inset 0 1px 0 #FFFFFF0A, 0 6px 16px -4px #00000066;
  --shadow-pop: 0 0 0 1px #474C52, 0 16px 40px -8px #000000A6;
  --shadow-modal: 0 0 0 1px #474C52, 0 24px 64px -12px #000000B3;
```

`body { background: var(--well); color: var(--text-1); }`. Scrollbars use `scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent`.

The canvas reads colors through `getComputedStyle` (as `readTheme()` does today) and re-reads on theme change. In the current code, `readTheme()` derives darkness from `--plane`. Keep that.

### 2.2 Why these neutrals

- Dark is **graphite, not near-black**. Areas sit at OKLCH L 0.23 (`#1B1E21`), and the planes are darker (`#121416`) so colored regions glow out of a recessed viewport. The well is darkest (`#0D0E11`) and only ever shows as 4px gutters and the header strip. All neutrals carry a faint cool tint (hue 255, chroma ≤ 0.012), the same hue as the azure accent, so the accent looks native and not pasted on.
- Light is **cool paper, not cream**. Areas are `#F8F9FB`, planes are nearly white (`#FEFEFF`), and the well is a cool mid-grey (`#DDE0E4`) so areas read as separate panes.
- The gridlines are deliberately quiet: minor is 1.06:1 against the plane (dark) and 1.11:1 (light), major is 1.20:1 and 1.31:1. The axis is the first line that actually reads (3.7:1 and 4.6:1).

### 2.3 Shape palette: 8 inks

All eight share OKLCH L 0.70, C 0.14 (teal is gamut-limited to 0.118), so no color dominates. Hues alternate warm and cool in assignment order. Each ink has four tones:

- **base**: the main fill and checker tone A.
- **alt**: checker tone B, used in both themes (L 0.585). Base against alt is 1.57:1 for every hue: visible but not harsh.
- **ink-dark**: boundary and curve stroke on dark planes (L 0.88). This is lighter than the fill, so outlines glow.
- **ink-light**: boundary and curve stroke on light planes (L 0.46). This is darker than the fill.

| # | Name | base | alt | ink-dark | ink-light | base on dark plane | ink-dark on dark plane | ink-light on light plane |
|---|------|------|-----|----------|-----------|----|----|----|
| 1 | Azure   | `#58A2F2` | `#3A7EC6` | `#BCDBFE` | `#0359A1` | 6.9 | 12.9 | 7.1 |
| 2 | Coral   | `#E87A65` | `#BC5A48` | `#FEC9BE` | `#96301F` | 6.5 | 12.6 | 7.6 |
| 3 | Jade    | `#3DB87C` | `#19925D` | `#A8E9C2` | `#056940` | 7.3 | 13.3 | 6.7 |
| 4 | Violet  | `#AF88E6` | `#8B67BB` | `#E0CDFE` | `#674098` | 6.6 | 12.6 | 7.5 |
| 5 | Saffron | `#C59711` | `#9B7607` | `#F1D496` | `#6F5300` | 6.9 | 12.8 | 7.2 |
| 6 | Teal    | `#09B4BB` | `#098D93` | `#91E9EE` | `#016569` | 7.3 | 13.3 | 6.8 |
| 7 | Rose    | `#E177A3` | `#B65780` | `#FFC5DA` | `#902E5C` | 6.5 | 12.5 | 7.6 |
| 8 | Lime    | `#85AE47` | `#658A2A` | `#C7E3A7` | `#446401` | 7.2 | 13.2 | 6.8 |

The palette works on checker fills because, with fill opacity 0.85, the stroke against fill tone A and tone B is ≥ 2.35 and ≥ 3.6 (dark) or ≥ 3.0 and ≥ 2.1 (light) for every hue. A 4px halo in `--halo` is always drawn under the stroke (§6.4), so the outline separates even where a different shape's fill lies underneath.

Store shapes by **palette index**. For a custom color picked with the color input, derive the tones at runtime in OKLCH: alt = (L − 0.115, C × 0.93), ink-dark = (0.88, C × 0.6), ink-light = (0.46, C). Then gamut-clip by reducing chroma.

Curves and points use the **ink** tone of the current theme as their color, not base: base on the light plane is only 2.5 to 2.8:1. Areas use base and alt for fills and ink for boundaries.

Expose them as `--shape-N-base`, `--shape-N-alt`, and `--shape-N-ink`. `--shape-N-ink` takes the ink-light value in `:root` and the ink-dark value in the dark blocks.

### 2.4 The phase wheel (domain coloring source of truth)

The current HSV wheel has bright yellow and cyan spokes and a dark blue sector, which show up as false features. Replace it with a near-isoluminant OKLCH wheel:

- Hue: `h = 29° + deg(arg w)` (mod 360). This keeps the textbook convention (Wegert, *Visual Complex Functions*): positive reals red, then yellow, green, cyan, blue, magenta counter-clockwise.
- Lightness: `L = 0.75` for pure phase. Chroma: `C = min(0.16, 0.92 · Cmax(L, h))`.
- Measured relative luminance across the 12 stops is 0.388 to 0.451, versus roughly 0.07 to 0.93 for HSV.

Stops at arg = 0°, 30°, …, 330° (L 0.75):
`#F9897A #F79130 #D2A82C #A4BB30 #58C973 #32C8AF #32C2D6 #51B9F8 #90AAF8 #BA99F9 #E486DF #F981AC`

For CSS legends: `conic-gradient(from 90deg, #F9897A, #F981AC, #E486DF, #BA99F9, #90AAF8, #51B9F8, #32C2D6, #32C8AF, #58C973, #A4BB30, #D2A82C, #F79130, #F9897A)`. CSS conic runs clockwise from 12 o'clock, so "from 90deg" puts arg 0 at 3 o'clock, and the reversed list makes arg increase counter-clockwise.

Implementation: build a **256 × 32 RGBA8 lookup texture** at startup. u = arg/2π, v maps L ∈ [0.05, 0.98]. Each texel is the gamut-mapped OKLCH color with the chroma rule above. Sample it with LINEAR filtering, REPEAT in u and CLAMP in v. Every style in §6.7 is "pick L from the style, then sample the LUT", so there is no color math in the shader.

---

## 3. Typography

Google Fonts request (one stylesheet, `display=swap`):

```
https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..700&family=JetBrains+Mono:wght@400;500&family=STIX+Two+Text:ital,wght@0,400..600;1,400..600&display=swap
```

| Role | Family | Fallbacks | Why |
|---|---|---|---|
| UI, numbers, labels | **Archivo** (variable: weight 400 to 700, width 62 to 125) | "Helvetica Neue", "Segoe UI", system-ui, sans-serif | A technical grotesque with a width axis. Dense chrome uses width 87.5% for tokens and matrix headers, the wordmark uses 112.5%. It has tabular figures, so numbers don't need a monospace face. |
| Math variables on canvas and in titles (*z*, *w*₁, *i*, *θ*) | **STIX Two Text** italic 400 and 500 | "STIX Two Math", "Cambria Math", "Times New Roman", serif | It matches the MathJax glyphs that typeset the formulas. Serif is used **only** for mathematical symbols, as in typeset mathematics, and never for UI text. |
| Formula source (LaTeX entry fields only) | **JetBrains Mono** 400 and 500 | ui-monospace, "SF Mono", Menlo, Consolas, monospace | Typed `\frac{z-1}{z+1}` needs aligned braces. It is not used for readouts or data labels: those use Archivo tabular. |
| Typeset formulas | MathJax 3 SVG (as now) | the source text in JetBrains Mono, `--text-3` | `fill: currentColor` so formulas take the text token. |

Base settings: `font-family: Archivo, …; font-size: 12.5px; line-height: 17px; font-optical-sizing: auto; font-kerning: normal; font-variant-numeric: tabular-nums lining-nums;`. In the dark theme add `-webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale` so light-on-dark text doesn't bloom.

### Type scale (px)

| Token | Size / line | Weight | Width (`font-stretch`) | Tracking | Use |
|---|---|---|---|---|---|
| `--t-micro` | 10.5 / 12 | 600 | 87.5% | +0.02em | Property tokens (A E R P M Pr I), matrix headers, index badges, kbd |
| `--t-small` | 11.5 / 15 | 450 | 100% | +0.005em | Notes, hints, meta text, card notes, tooltips |
| `--t-body` | 12.5 / 17 | 400 | 100% | 0 | Default UI text, buttons, rows, fields |
| `--t-strong` | 12.5 / 17 | 600 | 100% | 0 | Section titles, card names, row names |
| `--t-title` | 14 / 19 | 600 | 100% | −0.005em | Viewport title (sans part), properties section titles at ≥ 1280px |
| `--t-heading` | 16 / 22 | 500 | 100% | −0.01em | Command palette input, modal section headings |
| `--t-display` | 20 / 26 | 600 | 112.5% | −0.015em | Modal title (the Guide) |
| Wordmark | 13.5 / 16 | 600 | 112.5% | +0.005em | Header |
| Math italic | 15 (titles), 13 (canvas labels), 11.5 (legend) | 400 (500 for titles) | | 0 | STIX Two Text italic |
| Canvas axis labels | 10.5 | 500 | 100% | +0.01em | Archivo, tabular |

Section titles are **sentence case**, `--t-strong`, `--text-1`, with no letter-spacing ("Draw", "Region from a formula", "Shapes", "Display", "Composite map", "Properties", "Natural domain", "Step by step"). This replaces the tracked uppercase labels in the current UI.

### Numerals and number formatting

- Use tabular, lining figures everywhere numbers can change: readouts, scrubbers, axis labels, the morph *t*, and mesh counts.
- Check at build time that `tabular-nums` actually equalizes Archivo's digit widths in the served font: "1111" and "0000" should measure the same with `ctx.measureText` or `getBoundingClientRect`. If they don't, fall back to JetBrains Mono 12px for the readout chip and scrubber values only.
- Minus is U+2212 "−", never hyphen-minus. Operators inside complex numbers get thin spaces (U+2009): `0.4521 − 1.2030i`.
- The trailing *i* is rendered as a separate span in STIX Two Text italic at the same size (`<span class="im">i</span>`). On canvas it is drawn the same way.
- Readouts show 4 decimals. Axis labels use the "nice number" step with the minimum decimals needed. Values with |x| ≥ 10⁵ or < 10⁻⁴ are shown as `1.5×10⁻⁴` with Unicode superscripts, never `1.5e-4`.
- Angles are in degrees with "°", or in multiples of π for arg readouts in the color plot: `arg w = 0.571π`.

---

## 4. Layout, spacing, radii, borders, elevation

### 4.1 Grid at 1440 × 900 (reference)

```
well (#0D0E11 dark) ------------------------------------------------------------------------------ 
| [keyhole mark] Complex Map Workbench   Examples v        [undo][redo]  [search: Add function or command  Ctrl K]  [L][R] [auto|light|dark] [?] |  40px header, sits on the well
|----4px-----------------------------------------------------------------------------------------|
| LEFT AREA 248 | VIEWPORT z (450)                    |4| VIEWPORT w (450)                         | RIGHT AREA 272 |
| Draw          | z-plane   domain       [snap][o][#] | | [Image|Color|Landscape|Sphere|Morph]  w = F(z) | Composite map |
| [7x3 tools]   | +---------------------------------+ | | +--------------------------------------+ | F(z) = ...    |
| hint line     | |                                 | | | |[mode options]          [legend]    | | Properties    |
| Region from   | |            plane                | | | |               plane                 | | (8 rows)      |
| a formula     | |                                 | | | |                                      | | Natural domain|
| Shapes        | |[z = 0.45 + 1.20i]  [- + fit max]| | | |[w = ...]           [- + fit max]    | | Step by step  |
| Display       | +---------------------------------+ | | +--------------------------------------+ | (matrix)      |
|               |-------------4px gutter, drag to resize (row-resize)------------------------| |
|               | Function chain   F = f2 o f1                          [Whole chain] [Clear] | |
|               | [Domain z]--f1-->[1 Exponential]--f2-->[2 Mobius]   [+ Add function]          | |  chain area 264px
|---------------------------------------------------------------------------------------------4px|
```

- Header: 40px, sits on `--well`, padding 0 12px. Areas start 4px below it.
- Gutters: 4px of `--well` between all areas and around the edge (`padding: 0 4px 4px`; respect `env(safe-area-inset-*)` with `max(4px, …)`).
- Left area 248px, right area 272px. Collapsed, each becomes a 44px rail (§5.15).
- Stage = viewports over the chain. Default chain height 264px, user-resizable from 168px to 50% of the stage by dragging the gutter above it (8px hit zone, `cursor: row-resize`, with a 2px `--line-strong` line that appears on hover). Store the height per viewer.
- The two viewports split the stage width 50/50. The 4px gutter between them is draggable (8px hit zone, `cursor: col-resize`). Double-click it to reset to 50/50. Expanding a viewport hides the other.
- Resulting plane size at 1440 × 900 with both docks open is 450 × 552 css px for each viewport (the viewport area is 584px tall, including its 32px header). With the right dock collapsed it is 564 × 552.

### 4.2 Breakpoints

| Width | Behavior |
|---|---|
| ≥ 1280 | Full layout as above. |
| 1024 to 1279 | The right area starts collapsed to its 44px rail. Opening it shows a 300px overlay drawer over the stage: `--raised`, `--shadow-pop`, slides in from the right, no scrim, Esc closes. Left area 232px. |
| 720 to 1023 | The left area becomes a 44px tool rail (all 17 tool icons in one column, plus a "Regions" button at the top that opens the formula, shapes and display sections as a 320px left drawer). The right area works as a drawer. Viewports sit side by side if the stage is ≥ 860px wide, otherwise stacked. |
| < 720 (phone) | Single column. The page scrolls vertically. See §4.3. |

### 4.3 Phone (360 to 719px)

```
| [mark] Complex Map    [undo][redo][...] |  48px header (theme, panels, guide, examples move into ...)
| z-plane  domain             [snap][o]   |  viewport L: width 100%, aspect-ratio 1/1, max-height 64svh
|               plane                     |
| [z = ...]                    [- + fit]  |
| [Image|Color|Landscape|Sphere|Morph] >> |  segmented control scrolls horizontally inside its own row
|               plane                     |  viewport R: same sizing
| Function chain  F = ...                 |
| [card][card][card][+]  >> scroll-snap   |  cards 248px wide, scroll-snap-type: x mandatory
| Region from a formula / Shapes /        |  left-area sections stacked, each collapsible
| Display / Properties / Step by step     |
|=========================================|
| [select][point][circle][disc][rect][polygon][more] | sticky bottom tool bar, 52px + safe-area-inset-bottom
```

- Horizontal page scroll is impossible by construction. Every grid child gets `min-width: 0`. Every wide strip (chain, segmented modes, matrix, formula boxes) scrolls inside its own container with `overflow-x: auto` and a 16px edge-fade mask. The palette and popovers are `width: min(<design width>, 100vw − 24px)`.
- Side gutter is 16px on phone: areas are full-bleed to 16px from the edge, and 8px between stacked areas.
- The bottom tool bar holds the 6 most used tools. "More" opens a bottom sheet with all 17 in a 6-column grid.
- With `@media (pointer: coarse)`: control heights go from 24/28 to 32/36px, tool cells to 44px, viewports accept pinch-zoom and two-finger pan, and long-press opens the context menu for a shape.

### 4.4 Spacing scale

`--sp-0: 2px; --sp-1: 4px; --sp-2: 6px; --sp-3: 8px; --sp-4: 12px; --sp-5: 16px; --sp-6: 20px; --sp-7: 24px; --sp-8: 32px.`

- Area padding: 12px left and right. Sections are 10px top, 12px bottom, separated by a 1px `--line` divider.
- Section header row: 28px tall, holding a collapse chevron (12px, `--text-3`), title, count token, then right-aligned actions.
- Inside cards: 8px horizontal padding. Parameter grid gap is 4px vertical and 8px horizontal.
- Overlay controls float 8px from the plane edges.

### 4.5 Control heights

`--h-xs: 20px` (icon buttons in card headers) · `--h-sm: 24px` (overlay controls, card fields, compact segmented) · `--h-md: 28px` (dock buttons and fields) · `--h-lg: 36px` (palette rows, menu rows on touch) · `--h-xl: 44px` (palette input).

### 4.6 Radii

| Token | px | Applies to |
|---|---|---|
| `--r-xs` | 3 | Tokens, chips, kbd, swatches, segmented thumb |
| `--r-sm` | 4 | Buttons, fields, segmented track, list rows, menu items |
| `--r-md` | 6 | Areas (including viewports), overlay groups over planes |
| `--r-card` | 5 | Step cards, formula boxes |
| `--r-lg` | 8 | Popovers, menus, command palette (tooltips use `--r-sm`) |
| `--r-xl` | 10 | Modal |

The plane canvas is clipped to the viewport's bottom radius (`overflow: hidden` on the area).

### 4.7 Borders and elevation: what gets what

| Element | Background | Border | Shadow |
|---|---|---|---|
| Header | `--well` | none | none |
| Areas (docks, viewports, chain) | `--area` (the viewport body is `--plane`) | none. Separation comes from the well gutter. | none |
| Dividers inside an area | | 1px `--line` | |
| Step cards | `--card` | 1px `--line` | none |
| Focused step card | `--card` | `box-shadow: inset 0 0 0 1.5px var(--accent)` | none |
| Fields | `--field` | light: 1px `--line`. dark: 1px transparent. Hover `--line-strong`. Focus `--accent` plus `0 0 0 3px var(--accent-soft)` | none |
| Secondary buttons | `--control` | 1px `--line-strong` (light), 1px `--line` (dark) | none |
| Ghost and icon buttons | transparent, `--hover` on hover | none | none |
| Overlays on planes (readout chip, zoom group, legend, mode options, morph transport) | `--overlay` with `backdrop-filter: blur(12px) saturate(1.4)` | 1px `--line` | `--shadow-overlay` |
| Popovers, menus, palette, tooltips | `--raised` (tooltips `--tooltip-bg`) | in the shadow token | `--shadow-pop` |
| Modal | `--raised` | in the shadow token | `--shadow-modal` plus `--scrim` behind |
| Toasts | `--raised` | | `--shadow-pop` |

Never: shadows on cards, rows, buttons or fields. Never a colored left or top bar on a card. Never a gradient on chrome. Focus is always `box-shadow: 0 0 0 2px var(--area), 0 0 0 4px var(--focus)` on `:focus-visible`.

Z-index scale: overlays 10, drawers 20, popovers 30, palette 40, modal 50, toast 60, tooltip 70.

---

## 5. Component specs

### 5.1 Header and brand mark

**Mark ("keyhole")**: a 20×20 SVG of the phase portrait of *z* on the unit disc, with a keyhole cut out along the negative real axis. That is the branch cut of log *z* and the keyhole contour around it. Paste-ready:

```html
<svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
  <path d="M10 10L18.21 12.20A8.5 8.5 0 0 0 18.21 7.80Z" fill="#F9897A"/>
  <path d="M10 10L18.21 7.80A8.5 8.5 0 0 0 16.01 3.99Z" fill="#F79130"/>
  <path d="M10 10L16.01 3.99A8.5 8.5 0 0 0 12.20 1.79Z" fill="#D2A82C"/>
  <path d="M10 10L12.20 1.79A8.5 8.5 0 0 0 7.80 1.79Z" fill="#A4BB30"/>
  <path d="M10 10L7.80 1.79A8.5 8.5 0 0 0 3.99 3.99Z" fill="#58C973"/>
  <path d="M10 10L3.99 3.99A8.5 8.5 0 0 0 1.79 7.80Z" fill="#32C8AF"/>
  <path d="M10 10L1.79 7.80A8.5 8.5 0 0 0 1.79 12.20Z" fill="#32C2D6"/>
  <path d="M10 10L1.79 12.20A8.5 8.5 0 0 0 3.99 16.01Z" fill="#51B9F8"/>
  <path d="M10 10L3.99 16.01A8.5 8.5 0 0 0 7.80 18.21Z" fill="#90AAF8"/>
  <path d="M10 10L7.80 18.21A8.5 8.5 0 0 0 12.20 18.21Z" fill="#BA99F9"/>
  <path d="M10 10L12.20 18.21A8.5 8.5 0 0 0 16.01 16.01Z" fill="#E486DF"/>
  <path d="M10 10L16.01 16.01A8.5 8.5 0 0 0 18.21 12.20Z" fill="#F981AC"/>
  <circle cx="10" cy="10" r="2.3" fill="var(--mark-bg)"/>
  <rect x="0.5" y="9.3" width="9.5" height="1.4" fill="var(--mark-bg)"/>
</svg>
```

The 12 flat wedges are deliberate: they read as the 12 isochromatic sectors of a phase portrait. At 32px and above (Guide modal, empty state), add a modulus contour: `<circle cx="10" cy="10" r="5.4" fill="none" stroke="var(--mark-bg)" stroke-width="0.7" opacity=".55"/>`. Use the same SVG as the favicon.

**Header row** (40px, left to right, gap 8px):
1. Mark (20px) and wordmark "Complex Map Workbench" (Archivo 13.5/600, width 112.5%, `--text-1`). The wordmark is hidden below 900px. On phone it reads "Complex Map".
2. A 1×16px divider in `--line-strong`.
3. **Examples**: ghost button with a 12px chevron. It opens the Examples popover (§5.12).
4. Spacer.
5. **Undo / Redo**: icon buttons, 28px. Tooltips "Undo  Ctrl Z" with platform-correct keys.
6. **Command field**: a button styled as a field, 240×28, `--field`, `--r-sm`. It holds a 14px search icon, placeholder text "Add function or command" in `--text-3`, and a kbd token "Ctrl K" (or "⌘K" on Mac) on the right. Clicking opens the palette (§5.11).
7. **Panel toggles**: two 28px icon toggles (left dock, right dock). When pressed they use `--control-active` with `--text-1`; when not pressed, `--text-3`.
8. **Theme**: an icon-only segmented control (Auto, Light, Dark). Each segment is 24px.
9. **Guide**: an icon button (question mark in a 14px circle).

The native `<select>` for examples and the text buttons "Undo / Redo / Guide" go away.

### 5.2 Tool palette

The left area's first section is "Draw". It is a **7-column icon grid** of 30×30 cells with 2px gaps (224px wide). Rows are grouped by mathematical type:

| Row | Tools (shortcut) |
|---|---|
| Mark | Select (V), Point (P), Segment (S), Line (L), Ray (R), Circle (C), Arc (A) |
| Fill | Disc (D), Rectangle (B), Polygon (G), Lasso (O), Half-plane (H), Annulus (N), Sector (E) |
| Nets and ink | Freehand (F), Grid (none), Polar grid (none) |

Rows are separated by 6px. There are no visible group labels, because the shapes of the icons make the groups obvious.

Cell states:
- Rest: icon `--text-2` on transparent.
- Hover: `--hover`, icon `--text-1`.
- Active: `--accent-soft` background, icon `--accent`, no border.
- Keyboard focus: the focus ring.

The tooltip, after a 500ms delay, shows the name and shortcut ("Disc  D").

Below the grid is the **tool hint**, reserving 34px so the layout never shifts. Line 1 is the 16px icon, then the tool name in `--t-strong`, then the kbd shortcut. Line 2 is the instruction in `--t-small` `--text-2`, for example "Drag from the center to set the radius."

**Icon drawing rules** (tools: 20×20 viewBox; chrome: 16×16 viewBox):
- Stroke 1.5 (tools) or 1.4 (chrome), `stroke-linecap: round; stroke-linejoin: round`, color `currentColor`. No gradients, no second color, no perspective.
- Each tool is drawn as its mathematical object. Area tools get `fill: currentColor; fill-opacity: .18` plus the stroke. Curves are stroke only. Defining points are filled dots r = 1.5 to 1.75. Unbounded objects (line, ray, half-plane) **touch the viewBox edge** to signal that they continue.
- Mathematical glyphs inside buttons (*f*⁻¹, ∘, *θ*) are typeset in STIX Two italic, never drawn as paths.

Tool icon geometry (20×20, stroke 1.5 unless noted):

| Tool | SVG |
|---|---|
| Select | `<path d="M5.5 3.5V15l3.1-2.9 2.1 4.5 1.9-.8-2.1-4.5h4.1z"/>` stroke only |
| Point | `<circle cx="10" cy="10" r="2.25" fill="currentColor" stroke="none"/><path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2"/>` |
| Segment | `<path d="M5 15L15 5"/>` plus dots r 1.75 at (5,15) and (15,5) |
| Line | `<path d="M1 17.9L19 2.1"/>` plus dots r 1.5 at (7,12.6) and (13,7.4) |
| Ray | `<path d="M5 15L19 2.7"/>` plus a dot r 1.75 at (5,15) |
| Circle | `<circle cx="10" cy="10" r="6.5"/>` plus a center dot r 1.25 |
| Arc | `<path d="M3.5 14.5A7.5 7.5 0 0 1 16.5 14.5"/>` plus end dots r 1.5 |
| Freehand | `<path d="M3 14c2.2-4.8 4.2-.4 6.2-3.6S13 5.6 17 7.5"/>` |
| Disc | `<circle cx="10" cy="10" r="6.5" fill="currentColor" fill-opacity=".18"/>` |
| Rectangle | `<rect x="3.5" y="5.5" width="13" height="9" rx=".5" fill="currentColor" fill-opacity=".18"/>` |
| Polygon | `<path d="M4 14.5L6.5 5 14 4.5l2.5 7L10 16z" fill="currentColor" fill-opacity=".18"/>` plus vertex dots r 1.25 |
| Lasso | `<path d="M5.2 12.8C3 9.6 5 4.8 9.6 4.5s7.4 2.6 6.4 6.2-5.6 4.9-8.6 4.3c-1-.2-1.7-1-2.2-2.2z" fill="currentColor" fill-opacity=".18"/><path d="M5 13l-1.5 3.5"/>` |
| Half-plane | `<rect x="0" y="0" width="20" height="10.5" fill="currentColor" fill-opacity=".18" stroke="none"/><path d="M0 10.5h20M14.5 8.5l2 2-2 2"/>` (the arrow points along the boundary, with the region on its left) |
| Annulus | `<path fill-rule="evenodd" d="M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14zm0 3.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 1 0 0-6.5z" fill="currentColor" fill-opacity=".18"/>` and both circles stroked |
| Sector | `<path d="M4 16h13A13 13 0 0 0 13.2 6.8z" fill="currentColor" fill-opacity=".18"/>` plus a vertex dot r 1.25 |
| Grid | `<path stroke-width="1" d="M4 4v12M8 4v12M12 4v12M16 4v12M4 4h12M4 8h12M4 12h12M4 16h12"/>` |
| Polar grid | `<circle cx="10" cy="10" r="3" stroke-width="1"/><circle cx="10" cy="10" r="6.5" stroke-width="1"/><path stroke-width="1" d="M10 3.5v13M3.5 10h13M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2"/>` |

Chrome icon set (16px): undo, redo, panel-left, panel-right, sun, moon, auto (half-filled circle), help, search, plus, minus, fit, expand, collapse, eye, eye-off, more (3 horizontal dots), trash, bypass (circle with a diagonal), play, pause, loop, copy, check, chevron (4 directions), grip (2×3 dots r 1), magnet (snap), unit circle (dashed circle), net (3×3 grid), camera-reset (circular arrow around a dot), sliders.

Mode icons for the right viewport segmented control:
- Image: a square with a 2×2 checker, two cells at 35% fill.
- Color: a circle r 5.5 with three spokes at 0°, 120° and 240°.
- Landscape: the contour `M1.5 12.5c2.5 0 3.5-6 6.5-6s4 6 6.5 6` over a baseline `M1.5 14h13`.
- Sphere: a circle r 6, an equator half-ellipse `M2 8a6 2.2 0 0 0 12 0`, and a meridian ellipse.
- Morph: a 4px square at the left, a short arc arrow, and a disc r 2 at the right.

Every Unicode glyph button in the current UI (●, ◌, ×, ⏻, ‹, ›) becomes an SVG icon.

### 5.3 Segmented controls

- Track: `--field`, `--r-sm`, 2px padding, no border in dark, 1px `--line` in light. Height 24px (compact, used in overlays and cards) or 28px (docks).
- Segments: `--t-body`, weight 500, color `--text-2`, padding 0 10px (0 6px for icon-only, which are 24px square).
- The selected thumb is a separate absolutely positioned element: `--raised` in dark or `--card` in light, `--r-xs`, `box-shadow: 0 0 0 1px var(--line-strong)` plus, in light only, `0 1px 2px #1A1E2514`. Text on the thumb is `--text-1`. The thumb **slides** between segments: transform and width over 180ms on `--ease-out`.
- Hover on an unselected segment: text `--text-1`. A segment with no label gets a tooltip.
- Keyboard: arrow keys move the selection (roving tabindex), with `role="radiogroup"` / `role="radio"`.

### 5.4 Buttons

| Variant | Height | Padding | Background | Text | Border | Hover | Pressed |
|---|---|---|---|---|---|---|---|
| Primary | 28 (24 compact) | 0 12 | `--accent` | `--on-accent` 12.5/600 | none | `--accent-hover` | translateY(0.5px) |
| Secondary | 28 / 24 | 0 10 | `--control` | `--text-1` 12.5/500 | 1px `--line-strong` (light), `--line` (dark) | `--control-hover` | `--control-active` |
| Ghost | 28 / 24 | 0 8 | transparent | `--text-2` 12.5/500 | none | `--hover`, text `--text-1` | `--pressed` |
| Icon | 28 / 24 / 20 square | | transparent | icon `--text-2` | none | `--hover`, `--text-1` | `--pressed` |
| Danger ghost | as ghost | | | `--text-2` | | text `--error`, `--error-soft` bg | |

Disabled: opacity 0.4, `cursor: default`, no hover. Labels are verbs in sentence case: "Add", "Clear chain", "Reset camera". Icon buttons always have `aria-label` and a tooltip.

### 5.5 Inputs

**Text field**: height 28 (dock) or 24 (card), `--field`, `--r-sm`, padding 0 8px, `--t-body`, tabular figures. Placeholder `--text-3`. Invalid: border `--error`, and an 11.5px `--error` message under the field (in cards, as a tooltip-style bubble so card height doesn't jump).

**Formula field** (region formula, custom f(z), coefficients): the same box in JetBrains Mono 12.5/400 with `font-variant-ligatures: none`. Under it is a 24px reserved preview line rendered by MathJax at 13px in `--text-1`. The **Add** button sits inside the field's right end (primary, 20px tall, 6px from the edge). Enter also adds.

**Complex-number field** (the `cx` parameter type, used for Möbius a, b, c and d, the affine coefficients, *c* in translate and multiply, and α):
- One text field that accepts any constant expression ("1+i", "2i", `e^{i\pi/3}`, "-0.5").
- When the field is not focused, the value is shown formatted: `0.5 + 0.866i` with a math-italic *i*. When focused, the raw text the user typed is shown.
- If the raw text was an expression, an evaluated hint appears right-aligned inside the field in `--text-3`: "= 0.5 + 0.866i". It is dropped if the field is too narrow.
- **Argand dot** adornment at the field's right edge: a 16×16 button showing a 12px unit circle (1px `--text-4`) with a 2.5px `--text-1` dot at the value's position. Values with |c| > 2 sit on the rim with a 2px outward tick. Clicking opens the **Argand picker** popover (§5.12).

**Numeric scrubber** (int, real and angle params; Display "Cell"; 3D height scale):
- Layout: a label zone and a value zone in one field. The label is the parameter symbol in STIX italic (*n*, *φ*, *θ*) or a word in `--text-3`.
- Dragging horizontally on the **label** changes the value. The cursor is `ew-resize`, and pointer lock (`requestPointerLock`) allows unlimited travel.
- Step: integers change by 1 per 8px. Reals change by `10^(floor(log10(max(|v|, 0.1))) − 2)` per px. Angles change by 1° per 2px. Shift ×10 (angles snap to 15°), Alt ×0.1.
- While dragging, the value text is `--accent` and the field border is `--accent`.
- Up and Down arrow keys step ±1, with Shift for ×10. Double-click or Enter edits the value as text.
- **Angle variant**: the label is a 14px dial glyph (a circle with a 1.5px tick at the angle, measured from the positive real axis counter-clockwise). The value shows "180°". The branch-cut angle uses this.

**Select**: the native element only for long plain lists, styled `appearance: none`, `--field`, with a 12px chevron 6px from the right. Presets and examples use popover menus instead.

**Switch** (replaces checkboxes in Display): a 28×16 track, `--r` 8. Off: `--control-active` track with a 12px `--handle` knob. On: `--accent` track. The knob slides 12px in 140ms. The label is `--t-body` `--text-1` on the right, and the whole row is clickable.

### 5.6 Sliders (opacity; the morph scrubber is §5.9)

- Track 4px tall, `--r` 2, `--line-strong`. The filled part from min to value is `--accent`.
- Thumb 12px circle, `--handle`, `box-shadow: 0 0 0 1px var(--line-strong), 0 1px 2px #00000033`. It grows to 14px on hover or drag (90ms).
- Value to the right: `--t-small` tabular `--text-2`, min-width 36px, right-aligned, editable on double-click.
- Optional preset ticks: 2px dots under the track in `--text-4`.
- Keyboard: arrows ±1%, Page Up/Down ±10%.

### 5.7 Shape list rows

The section header is "Shapes" with a count token (`--t-micro`, `--field` background, `--r-xs`, 0 5px), and on the right a ghost "Clear" button. Clearing is undoable and shows a toast (§7).

Row (32px tall, `--r-sm`, padding 0 6px 0 4px, grid `12px 16px minmax(0,1fr) auto`, gap 6px):
1. **Grip**: 2×3 dots, `--text-4`, visible on row hover. Drag to reorder (changes the fill z-order).
2. **Swatch**: 14×14, `--r-xs`. It shows the kind and the color:
   - an area shape shows a 2×2 checker of base and alt;
   - a curve shows a 2px diagonal line in ink on `--field`;
   - a point shows a 5px ink dot on `--field`.
   Clicking opens the color popover: the 8 palette swatches at 20px in a row, the selected one ringed with the focus ring, plus "Custom…" which opens the native color input.
3. **Name and formula**: one line. The name ("Disc 1") is `--t-body` weight 500 `--text-1`. Then a 6px gap, then the typeset formula at 11.5px in `--text-2`, which fills the remaining width and fades out over the last 16px (mask) instead of scrolling. Complement shapes show "not" before the formula.
4. **Actions**: an eye icon button (20px), shown on hover or focus, and always shown when the shape is hidden. A more button (⋯) opens a menu: Duplicate, Use complement, Bring forward, Send backward, Delete. A Delete × icon also appears on hover.

States:
- Hover: `--hover`.
- Selected: `--selection` background, name `--text-1`, and the inline editor expands below (padding 4px 8px 8px 34px, fields in a `64px 1fr` grid, row gap 4px, 24px fields).
- Hidden: name and formula at 45% opacity, eye-off icon shown.

Hovering a row also highlights that shape on both planes: its stroke widens by 1.5px and a glow appears (§6.4).

Empty state: "No shapes yet. Pick a tool above, type a formula, or load an example.", with an inline ghost button "Examples".

### 5.8 Viewport chrome and overlays

**Header row** (32px, `--area`, padding 0 6px 0 10px, 1px `--line` bottom border):
- Left viewport: the title "*z*-plane". The variable is STIX italic 15/500, and "-plane" is Archivo 14/600. Then a meta text in `--t-small` `--text-3`: "domain" when the whole chain is in view, "input of *f*₂" when a step is in focus. Right side: three 24px icon toggles, Snap, Unit circle and Coordinate net. They moved here from Display because this is the plane they act on.
- Right viewport: the mode segmented control first (compact, icon plus label: Image, Color, Landscape, Sphere, Morph; icon-only when the viewport is narrower than 520px). The title is right-aligned: "*w* = *F*(*z*)" with meta "after 2 steps", or "*w*₁-plane" with "output of *f*₁".

**Overlays on the plane** (all use `--overlay`, blur, a 1px `--line` border, `--shadow-overlay` and `--r-md`; they sit 8px from the edges):

| Overlay | Position | Content |
|---|---|---|
| Readout chip | bottom-left | 24px tall, padding 0 8px, `--t-small` tabular. Left plane: "*z* = 0.4521 + 1.2030*i*". Right plane, Image mode: "*w* = −0.2216 + 0.9752*i*". Color mode adds "\|*w*\| 1.0001   arg *w* 0.571π" plus a 10px swatch of the pixel color. Before the first interaction it shows the hint "Scroll to zoom, drag to pan" in `--text-3`, then never again (remembered per viewer). |
| Zoom group | bottom-right | Joined 24px icon buttons: Zoom out, Zoom in, Fit, Expand. Expand becomes Restore when expanded. 1px `--line` separators between buttons. |
| Mode options | top-left (right viewport only) | Color: style segmented (Phase, Tiles, Modulus, Contours, Pullback), a tile scrubber "*n* 16", and an "Outline" switch. Landscape: height segmented (log \|*F*\|, \|*F*\|), a scale scrubber, view presets (3/4, Top, Front) and Reset camera. Sphere: a segmented control (Color, Regions), a "Plane" switch and Reset. Morph: a homotopy segmented control (Natural, Straight line). |
| Legend | top-right | Color, Landscape and Sphere modes (§6.8). It collapses to a 24px wheel button. |
| Morph transport | bottom-center | §5.9 |
| Note chip | top-center | Context notes such as "Image plane of the previous step. Draw new shapes in the domain." in `--t-small` `--text-2`, with a close icon. |

On phone the overlays shrink: the readout chip shows the value only, and the zoom group drops Zoom in and Zoom out because pinch replaces them.

### 5.9 Morph transport

An overlay at bottom-center, 36px tall, `min(480px, 100% − 16px)` wide, padding 0 6px:
- **Play/Pause**: a 28px round button in `--text-1` on `--control`.
- **Scrubber**: a 4px track with the fill in `--text-1` (not accent: this sits on the canvas side of the boundary), a 12px thumb, and **step ticks** at each integer *t*. Ticks are 1×8px in `--text-3`, labeled *f*₁, *f*₂ … in STIX italic 11px above the track.
- **t readout**: "*t* = 1.42", tabular, min-width 64px.
- **Loop** toggle (Once, Loop, Ping-pong cycle) and **speed** (0.5×, 1×, 2×) as a compact segmented control.

### 5.10 Function chain: step card anatomy

The area header (32px): title "Function chain" (`--t-strong`), the composite "*F* = *f*₂ ∘ *f*₁" (MathJax 13px, `--text-2`), a spacer, a "Whole chain" secondary toggle (pressed when focus = 0), and a ghost "Clear chain". Below it is the track (`--area-2`), padding 10px 12px 12px, scrolling horizontally with edge fades.

**Card**: width 216px, height = track height (default 264 − 32 − 22 = 210px), `--card`, 1px `--line`, `--r-card`, `display: grid; grid-template-rows: 28px minmax(72px,1fr) 28px auto auto 22px;`, overflow hidden.

1. **Header (28px)**: padding 0 4px 0 6px, gap 4px.
   - **Index token** 18×18, `--r-xs`, `--t-micro` tabular: "1" in `--text-2` on `--field`. When the card is focused, `--accent` background and `--on-accent` text. The domain card's token is a STIX italic *z*.
   - **Name**: `--t-strong`, ellipsized.
   - **Actions** (20px icon buttons, visible on card hover or focus-within, always visible on touch): *f*⁻¹ (STIX italic 12px; disabled if no inverse), Bypass (icon, pressed when bypassed), More (⋯). More opens a menu: Move earlier, Move later, Duplicate, Presets ▸ (submenu), Remove.
   - Status: a bypassed card shows a 6px `--text-4` ring before the name, and an errored card a 6px `--error` dot.
   - The whole header is the **drag handle** for reordering (`cursor: grab`). While dragging, a 2px `--accent` insertion line spans the card height between cards, and the other cards slide aside (FLIP, 200ms).
2. **Thumbnail** (fills the remaining height, at least 72px): edge to edge, `--plane`, no border. It shows stage *k* with the same renderer and pattern as the main plane. Axes at 40%, no labels, no minor grid. It is auto-fitted with a 10% margin, and the cut is drawn thin. Top-left is a STIX italic 11px label "*w*₁" with a halo. Bypassed: grayscale at 70% plus a 45° hatch of 1px `--line-strong` lines every 6px, and a "Bypassed" token. The thumbnail **must never be blank**. If the stage has no area shapes, show the stage's curves and points. If it has nothing at all, show the faint axes and "No shapes" in `--text-3`.
3. **Formula (28px)**: padding 0 8px. MathJax 13px "*w*₁ = e^*z*". It overflows to a right fade mask, and hovering reveals the full formula in a tooltip.
4. **Parameters** (auto height): padding 0 8px 6px, `display: grid; grid-template-columns: 1fr 1fr; gap: 4px 8px`.
   - Each parameter is `[symbol 14px][control]`. The symbol is STIX italic 13px `--text-2`: *a*, *b*, *c*, *d*, *n*, *α*, *φ*, *θ*.
   - Controls are 24px: complex field (§5.5), scrubber or compact select.
   - The `expr` and `coeffs` types span both columns, with their label above in `--t-small`.
   - So Möbius takes two rows (*a* *b* / *c* *d*) instead of five. If parameters overflow the card, the area scrolls internally with a fade mask, and the card never grows past the track.
5. **Note** (optional): `--t-small` `--text-3`, at most 2 lines with a clamp, padding 0 8px 4px. Example: "Principal branch, cut at 180°. Drag the seam in the input plane." Errors replace the note with an `--error-soft` strip: 11.5px `--error` text, padding 4px 8px.
6. **Property tokens (22px)**: padding 0 8px, gap 3px. Seven tokens A E R P M Pr I, each 16px tall, padding 0 4px, `--r-xs`, `--t-micro`. When the property holds: `--good-soft` background, `--good` text. When it is not guaranteed: transparent with `--text-4` text. Tooltip example: "Rational: guaranteed".

**Connector** between cards: 28px wide, the full card height. It is a horizontal 1px `--text-4` line with a 5px open arrowhead at vertical center and "*f*ₖ₊₁" (STIX italic 11px, `--text-3`) 4px above the line. On hover, a 18px round **Insert** button (`--control`, 1px `--line-strong`, plus icon) appears over the arrow and inserts a function at that position through the palette.

**Domain card** (*k* = 0): the same anatomy with the token *z* and the name "Domain". The thumbnail shows the *z*-plane. There are no formula or parameter rows. The meta line reads "3 shapes, 1 hidden" in `--t-small` `--text-3`.

**Add card**: 132px wide, full height, transparent, 1px dashed `--line-strong`, `--r-card`. Centered: a plus icon, the label "Add function" (`--t-body` 500 `--text-2`), and a kbd "/". Hover: `--hover`, text `--text-1`, solid border. With no steps yet it reads "Add the first function".

**Focus state**: the focused card gets an inset 1.5px `--accent` ring and the accent index token. Hovering a card highlights its row in the properties matrix (`--selection` at 60%), and hovering a matrix row highlights the card with an inset 1px `--line-strong` ring.

### 5.11 Command palette (add function, and everything else)

Open it with Ctrl/⌘K (everything), "/" (functions only, pre-filtered), the header command field, the Add card, or a connector's Insert.

- Container: top-anchored 14vh from the top, `width: min(600px, 100vw − 24px)`, `--raised`, `--r-lg`, `--shadow-pop`, overflow hidden. On phone it is a bottom sheet (`max-height: 85svh`, top radius 10).
- Input row: 44px. A 16px search icon at 14px from the left, then the input with `--t-heading` and placeholder "Search functions, regions, examples, commands". Esc closes. When the palette is opened for insertion, a context token sits at the right of the row: "Insert after *f*₁".
- Results: max-height 420px, scrollable. Group headers are 24px, `--t-small` weight 600 `--text-3`, sentence case: "Functions", "Region formulas", "Examples", "View", "Actions".
- **Row** (36px, padding 0 10px, `--r-sm` inside a 4px inset): a 40×28 preview thumbnail (`--r-xs`, `--plane`, the image of the unit-square checker under that function, rendered once and cached), then the name in `--t-body` 500 `--text-1`, then the aliases in `--text-3` ("exp, e^z"), then the typeset formula right-aligned (MathJax 13px `--text-2`). The active row is `--selection`. The mouse sets the active row on hover.
- Search: fuzzy matching over label, aliases and the TeX source, ranked prefix > word-start > substring. Aliases include "mobius" for Möbius, "cayley", "sqrt" and "root", "joukowski" and "airfoil", "conj" and "bar", "log" and "ln".
- **Formula as query**: if the query parses as a function of *z* (for example "z^2+1/z"), the first row is "Custom *f*(*z*) = ⟨typeset⟩" with a live preview. Enter adds it as a custom step.
- Keys: ↑↓ move, Enter adds after the focused step, Shift+Enter inserts before it. The footer (28px, `--area-2`, `--t-small` `--text-3`) shows these as kbd tokens with plain words between them: "↑ ↓ to move   Enter to add   Shift Enter to insert before   Esc to close".
- Grid-of-buttons popovers are removed entirely.

### 5.12 Popovers and modals

**Popover and menu**: `--raised`, `--r-lg`, `--shadow-pop`, padding 4px. Menu items are 28px (36px on touch), padding 0 8px, `--r-sm`, a 16px icon in `--text-2`, the label in `--t-body`, and the shortcut right-aligned in `--text-3`. Hover and keyboard-active state: `--hover`. Separators are 1px `--line` with 4px vertical margin. Submenus open on hover after 120ms or on Right arrow. Popovers flip to stay in the viewport.

**Argand picker** (opened from a complex field): 208px wide, padding 8px.
- A 192×192 mini plane (`--plane`, `--r-sm`) with a grid, axes and a unit circle (1px dashed `--axis`) showing [−2, 2]². The value is a draggable 10px `--text-1` dot with a halo.
- Snapping: to the 0.25 grid within 6px. With Shift, to 15° angles and 0.25 radii.
- Below the plane: two rows of scrubbers, "Re" and "Im", then "|*c*|" and "arg" (degrees). Edits apply live with full undo.

**Examples popover**: 440px. A 2-column grid of tiles. Each tile has a 64×44 thumbnail of the example's image (rendered on first open, then cached), the name in `--t-body` 500, and a one-line typeset formula in `--text-3`. Tile hover: `--hover`.

**Modal (Guide)**: `width: min(680px, 100vw − 24px)`, `max-height: calc(100svh − 48px)`, `--raised`, `--r-xl`, `--shadow-modal`, padding 24px 28px. The title "How the workbench works" is in `--t-display` with the 28px keyhole mark at its left. A close icon button sits top-right. Body text is 13/20 `--text-2`, max 65ch. Section headings are `--t-heading` `--text-1` in sentence case.

**kbd**: 18px tall, min-width 18px, padding 0 5px, `--r-xs`, `--control` background, 1px `--line` border with a 2px `--line-strong` bottom border, `--t-micro` `--text-2`.

**Scrim**: `--scrim` with `backdrop-filter: blur(2px)`. Esc or a scrim click closes the modal, and focus is trapped and restored.

**Tooltip**: `--tooltip-bg`, `--tooltip-text`, `--t-small` weight 500, padding 4px 8px, `--r-sm`, max-width 260px. Shortcuts inside appear at 65% opacity. Show after 500ms, and after 0ms when moving between tooltipped controls within 300ms. Fade in 90ms.

**Toast**: bottom-center, 12px above the chain area, 36px tall, `--raised`, `--shadow-pop`, `--r-lg`. Message in `--t-body`, plus one action in `--accent` 600, for example "Chain cleared." with "Undo". It lasts 5s and pauses on hover.

### 5.13 Left-area sections after "Draw"

**Region from a formula**: the formula field and live preview (§5.5). Then **example chips**: 22px tall, `--r-xs`, `--field`, padding 0 6px. They are **typeset** with MathJax at 12px (no raw LaTeX visible). Clicking one fills the field and focuses it.

**Display**:
- **Pattern picker**: a 4×2 grid of 50×36 tiles, gap 4px, `--r-xs`. Each tile is a live render of that pattern on a small disc in shape 1's colors. The selected tile has a 1.5px inset `--accent` ring. Under the grid, one line in `--t-small` `--text-2` gives the selected pattern's name and description (§6.3).
- **Cell**: a scrubber with "×½" and "×2" icon buttons beside it, plus "Auto", which is the default.
- **Opacity**: slider, 0.15 to 1, default 0.85.
- **Coordinate net** switch: overlays graph-paper lines on any pattern.
- **Mesh quality**: a segmented control (Draft, Normal, Fine, Ultra, Max). Below it, in `--t-small` `--text-3`: "Fine and above finish refining after you stop dragging." The separate mesh slider is removed, because the segments carry the same information.

### 5.14 Properties panel

**Composite map**: a formula box (`--card`, 1px `--line`, `--r-card`, padding 10px 12px) showing "*F*(*z*) = …" in MathJax 14.5px `--text-1`. On hover, a 20px copy icon button appears top-right ("Copy LaTeX"; the icon becomes a check for 1.2s). Below it, an ordered list of steps "*w*₁ = …" in MathJax 12.5px `--text-2`, each in its own overflow-scroll line.

If any active step has an error or the map is constant, a **warning strip** goes first: `--warn-soft` (or `--error-soft`), `--r-sm`, padding 6px 8px, a 14px warning triangle in `--warn`, and a `--t-body` `--text-1` message such as "Step 2 has an error and is skipped until fixed."

**Properties**: all eight properties are always listed, in a fixed order, so the panel never jumps: Analytic, Entire, Rational, Polynomial, Möbius, Proper, Homeomorphism onto image, Conformal onto image.

Row (28px, `--r-sm`, padding 0 6px, grid `14px 1fr auto`, gap 8px):
- **Guaranteed**: a 14px filled `--good` circle with a 1.5px check in `--on-accent`. The name is `--t-body` 500 `--text-1`. An optional qualifier token on the right: "deg 2" in `--t-micro` tabular on `--field`.
- **Not guaranteed**: a 14px circle as a 1.25px **dashed** ring (dash 2, gap 1.6) in `--text-4`, meaning "unknown", not "false". The name is in `--text-3`.

Above the list, a one-line key in `--t-small` `--text-3`: "Filled: guaranteed by the chain. Dashed: not guaranteed (it may still hold)."

Clicking a row expands its description below the name (`--t-small` `--text-2`, padding-left 22px). Only one row is open at a time. The same click highlights that property's matrix column.

When a property changes because the chain changed, the row background flashes `--selection` and fades to transparent over 600ms, and the glyph cross-fades in 200ms.

**Natural domain**: a `--card` box with "All *z* for which" and the typeset conditions as a list with 6px bullets in `--text-3`. A footnote in `--t-small` `--text-3`: "*w*ₖ is the value after step *k*, and *w*₀ = *z*."

**Step by step** (matrix):
- Table width 100%.
- Header row (22px): the step column, then A E R P M Pr I in `--t-micro` `--text-3`, centered, each with a tooltip giving the full name.
- Step rows (24px): the index token (18px) and the step name (`--t-small`, ellipsized). Cells are 24px wide. A held property is a 7px `--good` dot; a non-held property is a 6px ring, 1px `--text-4`.
- The total row "*F*" has a 1px `--line-strong` top border, the name in weight 600, and 8px dots.
- Rules between rows are 1px `--line-soft`.
- Hovering a column header or cell highlights the column (`--selection` at 60%) and its property row above. Hovering a step row highlights its card in the chain.

**How these are decided**: a ghost disclosure button with a chevron that rotates 90° in 140ms, `--t-small` `--text-2`. The body text is 12/18 `--text-2`, max 60ch.

### 5.15 Side-panel rails

A collapsed area becomes a **44px rail** (same `--area`, `--r-md`, full height).
- **Left rail**: the 17 tool icons in a single column of 32px cells, which stay usable while collapsed, like a pro-tool toolbar. Then a divider, then a "Regions" icon button that opens the left drawer, and an expand chevron pinned at the bottom.
- **Right rail**: a vertical mini-matrix of the eight property glyphs (14px, using the same filled and dashed styles) with tooltips, so you still see what is guaranteed while collapsed. An expand chevron sits at the bottom.

Shortcuts are "[" and "]" (as now). The width animates over 200ms on `--ease-out`. During the animation the canvases are scaled as bitmaps and re-rendered once on `transitionend`, not every frame.

---

## 6. Canvas and plot rendering

Every plane is drawn by WebGL2: grid, region fills, patterns and the color plot. Strokes, markers and labels are drawn on a 2D overlay canvas stacked on top, or as GL instanced quads; either is fine as long as Appendix A holds. All widths below are CSS px and get multiplied by DPR (capped at 2).

### 6.1 Grid, axes, labels

- Background: `--plane`.
- **Major spacing** targets 96 to 128px on screen, using the 1, 2, 5 × 10ᵏ nice steps. **Minor** = major / 5. Instead of popping in and out, the minor grid cross-fades with `alpha = smoothstep(8px, 16px, minorSpacingPx)`.
- Minor lines are 1 device px in `--grid-minor`. Major lines are 1 CSS px in `--grid-major`. Draw them in the fragment shader with the constant-width line function in §6.3, pattern 3, so they stay crisp at any zoom.
- **Axes**: 1 CSS px `--axis`. Ticks are 4px at each major step, centered on the axis. No arrowheads. At the positive ends, "Re" and "Im" are shown in `--t-micro` `--text-3`, 6px inside the pane edge.
- **Tick labels**: Archivo 10.5/500, tabular, `--axis-label`, with a 3px halo in `--halo` at 90% alpha (stroke then fill, `lineJoin: round`) so they read over fills. X labels go 6px below the axis, y labels 6px to the right of it. Imaginary labels are "2*i*", "−*i*", "*i*" (no "1*i*"), with the *i* in STIX italic. Zero is labeled once, as "0" below-left of the origin.
- When an axis is off-screen, its labels **pin** to the nearest pane edge with an 18px translucent `--overlay` gutter strip behind them (like Desmos). The labels sit inside the strip.
- **Unit circle** (toggle): 1px `--axis` at 60% alpha, dashed 2 on 3.
- **Image of the view window** (optional, off by default, toggle in the right viewport's More menu): the image of the left viewport's rectangle, drawn in the right plane as a 1px dotted line (1 on 3) in `--axis` at 50%. It answers "which part of the *z*-plane am I looking at the image of?"

### 6.2 Extent: what gets meshed (fixes the clipped image)

Today the right plane only shows the part of the region that is visible in the left plane, because meshes are clipped to the left view window (`clipWin`). New rule:

- **Bounded shapes** (disc, rectangle, polygon, lasso, annulus, bounded sector, bounded formula sets) are meshed over **their full bounding box**, independent of any view. Panning or zooming the left plane never re-meshes them and never truncates their image.
- **Unbounded shapes** (half-plane, unbounded sector, line-based or formula sets without a bound, complements) are meshed over a **working window**: the left view expanded 3× around its center, extended to include every bounded shape's box, and capped at |coordinate| ≤ 10⁴. It is re-meshed only when the left view leaves the middle third of the working window, in a worker (Appendix A).
- **Truncation edges are not boundaries.** Where the working window cuts an unbounded shape, the fill feathers out instead of ending in a hard stroked edge: `alpha *= smoothstep(0.0, 0.06 · W, d)`, where *d* is the distance from `vSrc` to the window edge and *W* is the window width, computed in the fragment shader. These edges are never stroked. The real boundary (for example the half-plane's line) is stroked as normal.

### 6.3 Region fill patterns

Patterns are defined in **source (*z*-plane) coordinates** and carried through the map. In the fragment shader `p = vSrc / cell`. Every pattern is **box-filtered** using `fwidth(p)`, so compressed cells (near poles, at the edge of exp images) converge to the average tone instead of aliasing into moiré. This is the single biggest quality jump for the image plane.

**Cell size**: `cell = niceStep(D / 8)`, where *D* is the larger side of the union bounding box of the bounded area shapes (or of the working window if every shape is unbounded). It is recomputed only when shapes change, **never on pan or zoom**. The Display "Cell" control can override it (×½ and ×2 steps).

**Tones**: c₀ = base, c₁ = alt, *k* = ink (§2.3). The fill opacity α defaults to 0.85 and is premultiplied.

Filtered checker (Quílez box filter):
```glsl
float checker(vec2 p){ vec2 w = max(fwidth(p), 1e-4) * 1.2;
  vec2 i = 2.0*(abs(fract((p-0.5*w)*0.5)-0.5) - abs(fract((p+0.5*w)*0.5)-0.5))/w;
  return 0.5 - 0.5*i.x*i.y; }                 // 0 → c0, 1 → c1, converges to 0.5
```
Constant-pixel-width line (used for grid lines and nets):
```glsl
float gridLine(vec2 p, float widthPx){ vec2 fw = max(fwidth(p), 1e-5);
  vec2 d = abs(fract(p - 0.5) - 0.5) / fw;    // distance to the nearest line, in px
  float a = 1.0 - clamp(min(d.x, d.y) - 0.5*widthPx + 0.5, 0.0, 1.0);
  return a * (1.0 - smoothstep(0.15, 0.35, max(fw.x, fw.y))); }  // fades out when lines get closer than ~4px
```

The 8 patterns, in picker order:

| # | Name (picker label) | Exact appearance |
|---|---|---|
| 1 | **Checker** (default) | `mix(c0, c1, checker(p))`. Square cells, axis-aligned in *z*. |
| 2 | **Conformal tiles** | Log-polar checker around the origin: `q = vec2(log(|z|), atan(z.y, z.x)) * n / 2π` with *n* = 16, then `mix(c0, c1, checker(q))`. The radial ratio is e^{2π/16} ≈ 1.48, so the cells are true squares in log-polar coordinates. They stay close to square under any analytic map wherever *F*′ ≠ 0, which makes the angle doubling at critical points stand out. Option: "about the region's centroid". |
| 3 | **Graph paper** | Flat fill `mix(--plane, c0, 0.38)`. Minor lines every cell/5 at 1 device px, *k* at 35%. Major lines every cell at 1.25px, *k* at 85%. The source axes Re *z* = 0 and Im *z* = 0, where they cross the region, at 2px *k* at 100%. This is the classic textbook picture of a deformed coordinate net. |
| 4 | **Polar web** | Flat fill as in Graph paper. Circles \|*z*\| = *j*·cell at 1.25px *k* 80%, and rays every 15° at 1px *k* 45%. The rays at multiples of 90° are 1.75px at 100%. Centered on the origin. |
| 5 | **Strips** | Horizontal bands of height cell, filtered `mix(c0, c1, band(p.y))` with a 1-D version of the checker filter. Option "Vertical" switches to bands in Re *z*. This is the pattern that shows exp turning horizontal lines into rays. |
| 6 | **Orientation tiles** | A low-contrast checker (c₁ lifted halfway to c₀) with an **F glyph** in every cell, drawn as a signed-distance union of three boxes in cell-local *uv* ∈ [0,1]²: stem [0.30, 0.42] × [0.18, 0.82], top bar [0.30, 0.72] × [0.70, 0.82], middle bar [0.30, 0.62] × [0.46, 0.56], filled with *k* and anti-aliased by `fwidth(uv)`. The glyph fades out when a cell is under 10px. It makes local rotation (arg *F*′), scaling (\|*F*′\|) and orientation reversal (*z̄*, which mirrors the F) visible at a glance. |
| 7 | **Source phase** | Ignores the shape color for the fill: `wheel(arg(z − z_c), L)` with *L* alternating 0.70 and 0.80 in bands of cell in \|*z* − *z_c*\| (filtered). *z_c* is the shape's area centroid. You can see where every direction around the center ends up. The boundary still uses the shape ink. |
| 8 | **Solid** | c₀ flat. |

**Coordinate net** (switch): adds pattern 3's major and minor lines on top of any pattern except Graph paper and Polar web.

### 6.4 Boundaries, curves, selection

All strokes have round joins and caps, are drawn after every fill, and sit over a **halo** stroke in `--halo` at 75% alpha.

| Element | Halo | Stroke | Notes |
|---|---|---|---|
| Area boundary (closed set) | 4px | 1.75px solid, shape ink | |
| Area boundary (open set, strict inequality) | 4px | 1.75px **dashed 5 on 3.5**, shape ink | Formula regions built only from `<` or `>` have open boundaries, and a dashed outline is the textbook convention for "boundary not included". Drawn shapes count as closed. |
| Curve (segment, line, ray, circle, arc, freehand) | 4.5px | 2px solid, shape ink | |
| Grid and polar-grid curves | none | 1.25px, ink at 80% | |
| Hovered shape (canvas hover or list hover) | | +0.75px | |
| Selected shape | 6px glow: shape ink at 22% | +1px | Accent is never used. |
| Thumbnails | none | 1px, ink | |
| Draft while drawing | 4px | 1.5px dashed 4 on 3, ink | Polygon vertices are 6px ink squares. A rubber-band segment follows to the cursor. |

**Edit handles** (selected shape, domain plane only):
- Corner and vertex handles: 8×8 squares, fill `--handle`, 1.5px border in the shape ink, `--r` 1. They grow to 10×10 on hover, with cursor `move`.
- Shape-defining interior points (the arc's through-point, the center): 7px circles in the same style.
- A radius handle sits on the boundary at 45°.

### 6.5 Points and labels

- **Point marker**: a 7px disc in shape ink, a 1.5px ring in `--halo`, then a 1px outer ring in shape ink at 50% (r = 5.5). When selected, the outer ring is at 100% and r = 6.5.
- **Label**: STIX Two Text italic 13px `--text-1` with a 3px `--halo` text halo. The default label is "*p*₁" with Unicode subscripts. Placement is greedy: try NE (+8, −6), then NW, SE and SW, and take the first quadrant that does not overlap an existing label box. The same label appears on the image of the point in every plane.
- **Probe crosshair**: a center ring r 6 (1.25px) plus four arms from r 9 to r 15 (1px), in `--text-1`, over a 3px `--halo` halo. The companion probe in the other plane is identical. In Color mode it uses `#0B0D10` with a white 70% halo (§6.7).
- **Morph trails**: during Morph, each point leaves the trajectory *t* ↦ *H*(*t*, *p*) from 0 to the current *t* as a 1.25px polyline in its ink at 55%, with a 4px arrowhead at the current position. This is the homotopy made literal.

### 6.6 Branch cuts, branch points, poles

- **Seam (branch cut)**: a 4px `--halo` underlay, a 2px solid `--cut` line, and **zipper ticks**: 1.25px `--cut` ticks perpendicular to the cut, 4px long, every 8px, alternating sides. If a step declares the side on which its branch is continuous up to the cut, as the principal log does (arg ∈ (−π, π] is attained from above), all ticks go on that side instead. Ticks start 8px from the branch point.
- **Branch point** (the finite end of a cut): a hollow circle r 4, 1.75px `--cut`, filled `--halo`.
- **Cut handle** (editable cuts, input plane): a 12px `--cut` disc with a 2px `--halo` ring at one third of the way to the pane edge along the ray. It grows to 14px on hover, with cursor `grab`.
  - While hovering or dragging, an **angle arc** shows the angle: a 1px `--cut` arc at 50% opacity, r 28px, from the positive real axis to the cut.
  - A **label chip** sits 10px beyond the handle along the ray: 18px tall, `--cut-soft` background, `--cut-ink` text, `--r-xs`, Archivo 11/600 tabular, reading "*θ* = 180°" with *θ* in STIX italic. When idle, the chip shows only the angle.
  - Shift snaps to 15°.
- Thumbnails draw the cut as 1px `--cut` solid, with no ticks and no handle.
- **Pole**: a ring r 5.5 (1.75px) plus an "×" with arms ±3px (1.75px), in `--pole` over a 3px `--halo`. Hovering shows a tooltip: "Pole of *f*₂ at *z* = −*i*" (with the order, if known).
- **Zero** (when a step reports zeros): a 4px filled dot in `--zero` with a 1.5px `--halo` ring.
- Singularities are drawn in ink, not hue, because on this canvas hue always means phase or shape identity. The cut is the single exception, and its zipper shape keeps it from being mistaken for a shape.

### 6.7 Color plot: domain coloring

Rendered per pixel on the GPU (Appendix A). The hue comes from the §2.4 LUT. Let *t* = arg *w* / 2π ∈ [0, 1), *n* = the tile count (8, 12, **16**, 24 or 32), `xp = t·n` and `xm = ln|w| · n / 2π`. With these, phase and modulus advance at the same rate, so tiles are squares.

Box-filtered sawtooth (removes the stair-step aliasing at every contour):
```glsl
float P(float u){ return 0.5*floor(u) + 0.5*fract(u)*fract(u); }
float saw(float x){ float w = max(fwidth(x), 1e-4); return (P(x+0.5*w) - P(x-0.5*w)) / w; }
float detail(float x){ return 1.0 - smoothstep(0.25, 0.6, fwidth(x)); } // fade where tiles < ~2px (near zeros and poles)
```

| Style (segmented label) | Lightness and treatment |
|---|---|
| **Phase** | L = 0.75. Optional isochromatic lines at integer `xp`, 1px `#000000` at 22% (switch "Phase lines"). |
| **Tiles** (default) | L = 0.75 + d·(0.13·(saw(xm) − 0.5) + 0.07·(saw(xp) − 0.5)), with *d* = min(detail(xm), detail(xp)). The result is a field of conformal square tiles, each shaded dark at one corner and light at the opposite, and the shading gently disappears where tiles would alias. |
| **Modulus** | Zeros black, poles white: *u* = (2/π)·atan(\|*w*\|), L = 0.10 + 0.86·*u*, chroma scaled by min(1, 5.2·*u*·(1 − *u*)) (mix toward the neutral of the same L). Plus thin modulus contours at \|*w*\| = 2ᵏ, 1px `#000000` at 18%. |
| **Contours** (best for light theme and printing) | Background `mix(--plane, wheel(t, 0.75), 0.10)`. Modulus level lines at integer `xm`: 1px `--text-2` at 55%. \|*w*\| = 1: 1.75px `--text-1`. Phase level lines at integer `xp`: 1.25px wheel color at L 0.62 (light) or 0.80 (dark). Everything uses the `gridLine` function. |
| **Pullback** | The Image tab's checker pulled back: `checker(w / c_w)` with *c_w* = niceStep(*s*/6), where *s* is the 90th percentile of \|*w*\| over a 32×32 CPU sample of the view, recomputed when the view settles, tones wheel(*t*, 0.80) and wheel(*t*, 0.66). Plus the preimages of the real and imaginary axes (Im *w* = 0 and Re *w* = 0) as 1.5px `#0B0D10` at 60%. |

Non-finite values: NaN pixels are `--text-4` with a 45° 1px hatch every 6px in `--line-strong` ("undefined here"). ±∞ is white.

**Overlays on color plots** are the same in both themes, because the plot is mid-luminance in both:
- Major grid lines: 1px `#0B0D10` at 14%. Axes: 1px `#0B0D10` at 45%.
- Tick labels: `#0B0D10` text with a 3px white halo at 65%.
- Region outlines: a 3.5px white underlay at 85% under a 1.5px `#0B0D10` stroke (dashed for open sets).
- Cuts and poles as in §6.6, but with a white halo.

### 6.8 Legends

- **Color legend** (top-right overlay, 136px wide, padding 8px):
  - A 48px **phase ring** (outer r 24, inner r 13) filled with the wheel (`conic-gradient` from §2.4, masked to the ring). Labels just outside the ring at its four unit points: "1" (right), "*i*" (top), "−1" (left), "−*i*" (bottom), in STIX italic 11.5px `--text-2`. Unit values are more useful labels than angles.
  - A **live needle**: a 1.5px `--text-1` line from the ring's center to its edge, pointing at arg *w* of the probe. It is hidden when there is no probe.
  - Right of the ring, a **modulus strip** 64×8 showing three tiles of the sawtooth. Under it: "×1.48 per tile" (tabular, `--t-small`) or, for Modulus style, a 0 to ∞ gradient strip with ticks at 1. A small marker on the strip shows the probe's \|*w*\|.
  - Collapsed, the legend becomes a 24px phase-ring button.
- **Landscape legend**: "height = log \|*F*\|" (or "\|*F*\|") and "contours at \|*F*\| = 2ᵏ", in `--t-small`.
- **Sphere legend**: a 40px orientation gizmo. Three short axes (Re, Im, and the polar axis toward ∞) drawn as 1.5px lines in `--text-2`, labeled "Re", "Im" and "∞".

### 6.9 3D modulus landscape

Goal: it should read as a real, lit object you could hold.

**Geometry**
- The domain is the left viewport's window (as now). It maps to scene x ∈ [−1, 1] along the longer side, aspect preserved.
- A 256×256 grid (66,049 vertices) in static buffers, rebuilt only when *F*, the domain or the height mode changes. Orbiting never rebuilds.
- **Height with soft compression, so there are no holes**:
  - log mode: *h* = *H*·(2/π)·atan(ln\|*w*\| / 1.25)
  - \|·\| mode: *h* = *H*·(4/π)·atan(\|*w*\| / μ) − *H*, where μ is the median \|*w*\| on the grid.
  - *H* = 0.55 × the height scale (scrubber 0.25 to 2, default 1). Poles rise to a smooth plateau and zeros sink into smooth funnels. Remove the current "drop quads whose height jump > 0.6" rule, which produces the ragged holes. |*F*| is continuous across branch cuts, so only NaN cells are dropped.
- Normals come from central differences of the height grid, with smooth per-vertex normals.
- Per-vertex **ambient occlusion**: ao = 1 − clamp(6·(blur₉(*h*) − *h*), 0, 0.4), where blur₉ is a 9×9 box blur of the height grid. Valleys and zeros darken.

**Surface color**
- Default style in 3D is **Phase** (flat isoluminant wheel) so the lighting carries the form. The user can switch to any §6.7 style.
- Color per fragment from the interpolated *z* when the GLSL chain is available, otherwise from per-vertex *w*.

**Contours on the surface**
- Iso-modulus lines at \|*w*\| = 2ᵏ: 1px `#000000` at 30%.
- \|*w*\| = 1 is the "sea level": 2px `#000000` at 55%.
- Phase lines at arg = *k*π/4: 0.75px `#000000` at 14%.
- All are anti-aliased with `fwidth` on log₂\|*w*\| and on arg.

**Lighting** (computed in linear space, the LUT color converted to linear, output gamma-encoded). Lights are attached to the camera, so the form stays readable from every angle:
- Hemisphere ambient: `mix(--ground, --sky, 0.5 + 0.5·n.z)` × 0.45 (dark) or × 0.55 (light), multiplied by ao.
- Key: 40° left of the view direction, 50° elevation, intensity 0.85, Lambert, multiplied by (0.5 + 0.5·ao).
- Fill: 35° right of view, 20° elevation, intensity 0.20, tinted `--sky`.
- Specular: Blinn-Phong on the key light, *k*_s = 0.10, shininess 42. The result is a satin, ceramic-like finish.
- Rim: (1 − max(n·v, 0))³ × 0.15 × `--sky`.
- Fog: mix toward `--bg3-bottom` by 0 to 18%, from the nearest to the farthest point of the bounding box.

**Stage**
- **Background**: a full-screen vertical gradient from `--bg3-top` to `--bg3-bottom`, multiplied by a vignette (1 − 0.10·r²).
- **Floor** at *z_f* = −*H* − 0.06: `--floor` with grid lines matching the 2D major step (1px `--floor-grid`) and the Re and Im axes (1.25px `--axis`).
  - **Contact shading**: floor × (1 − 0.28·exp(−(*h*(x, y) − *z_f*)/0.12)), so the floor darkens where the surface comes close.
- **Back walls**: the two vertical faces of the bounding box farthest from the camera (re-chosen per yaw quadrant). Fill `--floor` at 70%, 1px `--floor-grid` lines at the contour heights.
- **Frame**: 1px `--frame` along the floor edges and the wall edges.
- **Labels** (2D overlay, projected through the MVP every frame):
  - Floor-edge ticks: Archivo 10.5 tabular in `--axis-label`, on the two edges facing the camera.
  - Axis titles: "Re *z*" and "Im *z*" in STIX italic 12px.
  - The height axis on the left wall edge is labeled with **|F| values** (1/4, 1/2, 1, 2, 4), not logarithms, and titled "\|*F*\|".

**Camera and quality**
- Perspective, 30° vertical FOV. Default yaw −52°, pitch 32°, at a distance that fits the box to 80% of the viewport.
- Pitch is clamped to [6°, 88°]. Orbit has inertia (angular velocity decays with τ = 220ms). Wheel zoom ranges from 0.5× to 2.5× the fit distance. Shift-drag or right-drag pans the target.
- Double-click resets with a 420ms ease-in-out. Presets: 3/4 (default), Top (pitch 88°, yaw −90°), Front (pitch 8°, yaw −90°).
- MSAA ×4: `antialias: true` on the viewport's own context, or a 4-sample renderbuffer plus `blitFramebuffer` if a shared context is kept. DPR up to 2.
- **Probe**: hovering the left plane draws a 1px `--text-1` vertical needle from the floor to the surface at *z*, with a 6px ring where it meets the surface. The readout chip shows "\|*F*\| = 2.31".

### 6.10 Riemann sphere

- Stereographic convention: unit sphere with north pole N = (0, 0, 1) ↔ ∞, south pole ↔ 0, equator ↔ \|*z*\| = 1. A sphere point P maps to *z* = (P_x + *i*P_y)/(1 − P_z).
- Geometry: icosphere at subdivision 5 (≈ 20k triangles).
- Two modes (segmented, in Mode options):
  - **Color**: per fragment, compute *z* from P, then *F*(*z*), then the chosen §6.7 style. This shows *F*'s behavior at ∞, which no flat plot can.
  - **Regions**: the sphere base is `--card`, and the image meshes of the regions are lifted onto the sphere by inverse stereographic projection. They are subdivided until each edge spans < 3° and offset +0.002 in radius. They keep their patterns, and strokes become great or small circles in shape ink.
- Material: the same light rig as §6.9 with *k*_s 0.06, shininess 28, and rim 0.20.
- **Graticule**, drawn in the shader with constant-width lines on (arg *z*, log₂\|*z*\|):
  - meridians every 30°, 1px `--graticule` at 18%;
  - parallels at \|*z*\| ∈ {1/4, 1/2, 2, 4} at 18%;
  - the equator (\|*z*\| = 1) at 1.5px, 45%;
  - the positive real meridian (arg 0) at 1.25px, 40%.
- **Labels** (2D overlay): "0" (south pole), "∞" (north pole), and "1", "*i*", "−1", "−*i*" on the equator. STIX italic 12.5px `--text-1` with a halo. Labels fade with alpha = smoothstep(−0.1, 0.2, n·v) as they turn away.
- **Plane** (switch, off by default): the plane *z* = 0 through the equator, a ±2.2 square in `--plane` at 35% with a unit grid at 25%. With the probe active, a 1px `--text-1` at 45% **projection ray** runs from N through the sphere point to the plane point. This is the textbook figure.
- **Ground shadow**: an elliptical radial gradient at z = −1.35, black at 28% (dark) or 14% (light) in the center, fading to 0.
- Camera: trackball orbit with inertia. Default yaw −60°, pitch 18°, FOV 28°. Double-click resets.

### 6.11 Morph view

- Same plane styling as Image mode.
- **Ghost references**: the region outlines at *t* = 0 (dashed 4 on 4) and at the final *t* (solid 1px), both in shape ink at 22%.
- Point trails as in §6.5.
- Transport as in §5.9.

---

## 7. Motion and micro-interactions

Tokens: `--dur-1: 90ms` (hover color, tooltip fade) · `--dur-2: 140ms` (press, popover in, switch, chevron) · `--dur-3: 200ms` (segmented thumb, rails, card insert, FLIP reorder) · `--dur-4: 280ms` (view fit) · `--dur-5: 420ms` (camera reset). Easing: `--ease-out: cubic-bezier(.16,1,.3,1)`, `--ease-std: cubic-bezier(.2,0,0,1)`, `--ease-inout: cubic-bezier(.65,0,.35,1)`.

Motion answers actions. There is no ambient animation. The one orchestrated moment is the **homotopy on add**: when a step is added (from the palette or by Insert), the image plane animates from the old image to the new one along that step's natural homotopy in 480ms on `--ease-out`, using the existing morph code. Parameter edits update live with no animation.

**Planes**
- Wheel zoom: cursor-anchored, each notch eases to its target scale over 120ms (interpolated in log-scale). A trackpad pinch (ctrlKey wheel) applies immediately.
- Pan inertia: on release, the velocity decays with τ = 160ms and stops below 0.05 px/frame.
- Fit and Reset view: 280ms `--ease-out`, with center interpolated linearly and scale in log-scale.
- Probe follows the pointer with no easing, in both planes.
- When a pattern's cell changes (after a shape edit), the old and new pattern cross-fade over 140ms (two cells blended in the shader).

**Chrome**
- Popover and menu in: opacity 0 → 1, translateY(4px) → 0, scale 0.98 → 1, 140ms `--ease-out`. Out: 90ms opacity only. The palette uses 160ms in. Its result list does not animate.
- Segmented thumb slides in 180ms. Switch knob slides in 140ms.
- Rails and drawers: 200ms width or transform. Canvases scale as bitmaps during the animation and re-render on `transitionend`.
- Cards: insert expands the width from 0 to 216 and the opacity from 0 to 1 over 200ms. Removal is the reverse over 160ms and shows an Undo toast. Reorder uses FLIP over 200ms.
- Property changes: the row background flashes `--selection` and fades over 600ms, and the glyph cross-fades in 200ms. This shows exactly what the last edit changed.
- Copy LaTeX: the icon becomes a check for 1.2s.
- Scrubber drag: the value is tinted `--accent` and the cursor is hidden under pointer lock. Release has no animation.
- Domain-coloring CPU fallback: the low-res pass cross-fades into the full-res pass over 120ms instead of popping.

**Morph playback**: 1.6s per step on `--ease-inout`, with a 280ms hold at each integer *t*. Modes: Once, Loop or Ping-pong.

**Reduced motion** (`prefers-reduced-motion: reduce`): durations become 0, except opacity fades capped at 80ms. There is no inertia and no homotopy-on-add, and morph never autoplays.

---

## 8. The 10 most important changes vs. the current screenshots (by impact)

1. **Show the whole image and stop the lag.** In screenshot 3, the *w*₁-plane cuts the disc's image off at the left view's edge. Bounded shapes are now meshed over their full extent, and unbounded ones over a working window with a feathered (unstroked) truncation edge (§6.2). Pan and zoom become uniform updates with no re-projection or buffer re-upload, meshing moves to a worker, and color plots move to the GPU (Appendix A). This addresses both of the user's concrete complaints.
2. **Docked studio layout on a dark well.** The boxed panels with 10px radius and drop shadows, the 38px pane headers, the 32px pane footers and the 10px gaps are replaced by flush areas on 4px gutters, one 32px viewport header and floating overlays. Per-viewport chrome drops from 70px (header plus footer) to one 32px header. With the azure accent moved off the canvas, the colorful plots are the only saturated thing on screen.
3. **Real domain coloring.** The HSV wheel becomes a near-isoluminant OKLCH wheel. Conformal square tiles are now the default, the sawtooth is box-filtered so contours never alias, and detail fades near zeros and poles. A live legend (phase ring with a needle, modulus strip) and five styles, including Contours for light theme and Pullback, which links back to the Image tab, are added (§6.7, §6.8).
4. **A 3D landscape that looks like an object.** Soft-compressed heights (no ragged holes) and per-fragment color, camera-attached three-point lighting with satin specular, rim and AO, |F| = 2ᵏ contours with a sea-level line, a floor with contact shading, back walls, |F|-valued labels, fog, MSAA and inertial orbit (§6.9). Plus a proper **Riemann sphere** tab (§6.10).
5. **Alias-free pattern system.** Eight patterns, all box-filtered in the shader: Checker, Conformal tiles, Graph paper, Polar web, Strips, Orientation tiles, Source phase, Solid. The cell size stays fixed while you pan or zoom, the Coordinate net overlays any pattern, and a visual picker replaces the text segmented control (§6.3, §5.13).
6. **Canvas annotation craft.** Halos under every stroke and label, dashed boundaries for open sets, zipper-ticked branch-cut seams with a branch point, an angle arc and a θ chip, ink pole markers, collision-aware point labels, constant-pixel grid lines with minor-grid cross-fade, pinned axis labels and morph trails (§6.1, §6.4 to §6.6).
7. **Step cards rebuilt around the picture.** The thumbnail fills the free height and is never blank (the Region and Exponential thumbnails in screenshot 1 are blank). Parameters sit in a 2-column grid of scrubbers and complex fields with an Argand picker, actions reveal on hover as SVG icons, reordering is by drag, and connectors gain an Insert (+) button (§5.10, §5.5).
8. **A command palette replaces the add-function popover.** Ctrl/⌘K or "/" opens fuzzy search with aliases, preview thumbnails and formula-as-query custom steps, plus examples, regions and commands (§5.11). The native Example `<select>` becomes a visual Examples popover.
9. **A calm, stable properties panel.** All eight properties are always listed in fixed order with filled (guaranteed) or dashed (not guaranteed) glyphs, replacing the big green boxes and dashed pills that reflow on every edit. Changed rows flash once, and the matrix cross-highlights with the cards. The collapsed rail keeps a mini status column (§5.14, §5.15).
10. **Type, icons and tokens.** Archivo (tabular, width-axis) for UI and numbers, STIX Two italic only for math symbols, and JetBrains Mono only for formula source. Sentence-case section titles replace tracked uppercase labels. A drawn SVG icon set replaces ●, ×, ⏻, ‹ and ›. Formula chips are typeset instead of showing raw LaTeX. Full light and dark token sets come with an Auto/Light/Dark switch (§2, §3, §5.2).

---

## Appendix A. Rendering contract

The motion and polish above assume 60 fps during interaction. These are the engineering requirements, phrased as rules.

1. **On-screen WebGL2 per viewport.** Each plane has its own WebGL2 canvas, plus a stacked 2D overlay canvas for labels, handles and markers. Drop the render-offscreen-then-`drawImage` blit for the main planes. If a single shared context is kept for thumbnails, render thumbnails into an atlas texture.
2. **The view transform is a uniform.** Vertex positions are uploaded once per (shape, stage) as `STATIC_DRAW` Float32, stored relative to the mesh's own center (a vec2 offset uniform keeps float precision). Panning and zooming change only `uCenter`, `uScale` and `uViewport`. Today `drawMeshes` re-projects every vertex on the CPU and calls `bufferData` every frame. Remove that.
3. **Meshing and mapping in a Web Worker.** Build `buildMesh`, `advance` and `refineStage` off the main thread, and transfer the Float32Arrays. While a parameter or shape is being dragged, use a draft mesh (*N* = 80) at frame rate. Replace it with the full mesh after 150ms of idle. The main thread never does more than 8ms of work per interaction frame, and idle refinement runs in slices of 6ms or less.
4. **Color plot and Landscape on the GPU.** Compile the function chain to GLSL from its definitions and the custom-formula AST. You need a small complex library: `cmul`, `cdiv`, `cexp`, `clog(z, cutAngle, sheet)`, `cpow`, `csqrt`, `csin`, `ccos`, `ctan`, `casin`, `cacos`, `catan`, `csinh`, `ccosh`, `ctanh`, Möbius, Horner polynomials, `conj`. Evaluate per pixel per frame. Fallback when a step can't be compiled: the current CPU path, moved to a worker, with progressive tiles.
5. **Cache by signature, not by view.** Stage meshes are keyed by (shape, chain prefix signature, mesh *N*), never by view. Patterns' `cell` is keyed by the shapes only.
6. **Thumbnails** use the same GL renderer, throttled to at most 10 fps while edits are in progress, and render once on idle.

---

## Appendix B. Copy rules

- Sentence case everywhere, including section titles, buttons and tabs.
- Section titles have no tracked uppercase eyebrows. Meta strings use plain words and commas ("3 shapes, 1 hidden"), not middle dots. No "→" appended to buttons.
- Use verbs that say what happens: "Add function", "Clear chain", "Reset camera", "Use complement".
- Keep a consistent vocabulary. A *step* is a function in the chain. The *domain* is the *z*-plane where shapes are drawn. The *image* is the output. The *seam* is the drawn branch cut, and its tooltip calls it "branch cut".
- Errors say what to fix: "*n* must be an integer of at least 2". Empty states invite the next action: "Draw a region, or pick an example", with both actions as buttons in the empty *z*-plane overlay.
