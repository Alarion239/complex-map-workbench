# Complex Map Workbench: the calibrated bench

A design proposal in the "precision scientific instrument" direction. It is written so an engineer can implement it without guessing. Hex values were checked: every text token meets WCAG AA (4.5:1) on the surfaces it is used on, and the shape palette was built in OKLCH at matched lightness. Measured ratios are listed next to the tokens.

---

## 1. Concept

The Workbench is a calibrated optical bench for complex maps. Two measured plates, domain and image, sit side by side like the input and output stages of an instrument. Graduated rulers, a live coordinate readout, and a derivative gauge turn every hover into a measurement.

The chrome is quiet graphite on cool drafting film, so the only saturated color on screen is data: region patterns and phase hues. Red is reserved for the places where the map breaks, meaning branch cuts and poles.

Every flourish comes from the mathematics itself:

- a Poincaré-disk dial for the brand mark
- conformally square contour grids
- hatched branch cuts that show which side is closed
- a plaster-model landscape in the tradition of Jahnke–Emde and the Schilling models
- a Riemann sphere that brings ∞ into view

---

## 2. Color

### 2.1 Rules that decide every color choice

1. **Data is the only saturated color.** Chrome (panels, buttons, text, rulers) uses graphite neutrals with a slight cyan cast. Saturated hues appear only in region fills, curves, phase portraits and the landscape.
2. **Red means "the map breaks here."** `--cut` (vermilion) and `--pole` (crimson) are used for branch cuts, branch points, poles and evaluation errors, and nowhere else. The shape palette contains no red. Today the second preset is `#e0532f`, so in screenshots 1 and 3 a red circle reads as a cut.
3. **Modes are ink; objects are accent.** A pressed mode is drawn as an ink-inverted "lit key". Pressed modes include the active tool, the selected tab and the selected segment. A selected object gets a petrol `--accent` outline. Selected objects include the selected shape, the focused step card and the focused input. These two treatments are never swapped.
4. **Graph paper is non-photo blue.** Plane grids use the cyan drafting blue that never reproduced on blueprints. Axes are graphite ink.
5. **Semantic green is only "guaranteed".** `--good` marks properties that are proved for the chain. It is never decoration.

### 2.2 Token sets (copy verbatim)

All canvas-facing tokens are 6-digit hex so `GLR.hexRGB()` and `readTheme()` can parse them. Opacity for canvas use is carried in separate unitless tokens.

```css
:root {
  /* surfaces */
  --bg:            #E3E8EA;  /* app background behind panels */
  --panel:         #F1F4F5;  /* sidebars, pane heads, rulers, pipeline strip */
  --surface:       #FFFFFF;  /* cards, rows, inputs on focus, popovers */
  --surface-2:     #F7F9FA;  /* hover on rows/keys inside --panel */
  --well:          #E9EEF0;  /* recessed: input rest bg, segmented track, formula wells */
  --inverse:       #121A20;  /* lit keys, tooltips */
  --inverse-ink:   #FFFFFF;

  /* text */
  --ink:           #121A20;  /* 15.9:1 on panel */
  --ink-2:         #3E4C56;  /* 8.0:1  secondary text, ruler ticks, icons at rest */
  --muted:         #56646E;  /* 5.5:1  captions, descriptions, field labels */
  --faint:         #8A969E;  /* 2.7:1  disabled text, unlit indicators. Never body copy */

  /* lines */
  --line:          #D2DADE;  /* default 1px borders, separators */
  --line-strong:   #B3BEC4;  /* control borders, plane frames, floating chrome */

  /* accent: petrol, oklch(0.49 0.09 226) */
  --accent:        #0A6A87;  /* 5.6:1 on panel; white text on it 6.1:1 */
  --accent-hover:  #075A73;
  --accent-soft:   #DDEFF4;  /* accent text on it 5.2:1 */
  --accent-ink:    #FFFFFF;

  /* semantic */
  --good:          #1B7A47;  --good-soft:  #DFF1E6;  /* good on soft 4.6:1 */
  --warn:          #8F5408;  --warn-soft:  #FAEDD7;  /* 5.3:1 */
  --error:         #B4231A;  --error-soft: #FBE5E2;  /* 5.9:1 on panel */

  /* plane (graph paper) */
  --plane:         #FCFDFD;
  --grid-minor:    #E2EEF2;  /* 1.16:1 fine rulings */
  --grid-medium:   #D3E6ED;  /* 1.26:1 every 5th */
  --grid-major:    #B5D4E0;  /* 1.53:1 every 10th */
  --axis:          #2E3D47;  /* 11.0:1 graphite axes */
  --axis-label:    #4A606C;  /* 6.5:1 tick labels */
  --ruler-tick:    #3E4C56;
  --cut:           #CC3311;  /* 5.1:1 vermilion, oklch(0.56 0.19 33) */
  --pole:          #A0153E;  /* 7.7:1 crimson,   oklch(0.46 0.17 12) */
  --zero:          #121A20;
  --probe:         #121A20;
  --halo:          #FCFDFD;  /* casing behind strokes and canvas text */
  --fov:           #2E3D47;  /* image of the left viewport outline */

  /* phase-portrait overlays (portrait colors are theme-independent) */
  --dc-line:       #FFFFFF;
  --dc-casing:     #0B1114;

  /* landscape and sphere */
  --land-top:      #F5F8F9;  /* background sweep, top */
  --land-bottom:   #DCE4E7;  /* background sweep, bottom */
  --land-floor:    #FAFCFC;
  --land-box:      #B3BEC4;
  --land-mod-line: #18232A;  /* modulus contour lines */
  --land-arg-line: #FFFFFF;  /* phase contour lines */
  --plaster:       #ECEEEC;
  --land-shadow:   #2E3D47;

  /* canvas opacities (unitless) */
  --halo-a: 0.85; --fov-a: 0.55; --cursor-a: 0.35; --dc-line-a: 0.22; --dc-axis-a: 0.70; --land-shadow-a: 0.30;

  /* shape palette (theme-independent; see 2.3) */
  --c1: #3B6FD4; --c2: #CD821A; --c3: #12938F; --c4: #BC4E98;
  --c5: #31983D; --c6: #7F56C4; --c7: #888D22; --c8: #607183;

  /* elevation */
  --shadow-1: 0 1px 2px rgba(18, 26, 32, 0.10);
  --shadow-3: 0 10px 28px rgba(18, 26, 32, 0.16), 0 2px 6px rgba(18, 26, 32, 0.08);
  --scrim:    rgba(18, 26, 32, 0.36);

  /* type */
  --f-ui:   "Archivo", "Helvetica Neue", Arial, system-ui, sans-serif;
  --f-mono: "B612 Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --f-math: "STIX Two Text", "STIX Two Math", "Cambria Math", "Times New Roman", serif;

  color-scheme: light;
}

@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #12191E; --panel: #172026; --surface: #1D282F; --surface-2: #23303A; --well: #121A1F;
    --inverse: #E3EAEE; --inverse-ink: #12191E;
    --ink: #E3EAEE; --ink-2: #B4C1C9; --muted: #91A1AB; --faint: #5E6E78;
    --line: #26333B; --line-strong: #36474F;
    --accent: #52B7D3; --accent-hover: #78C9E0; --accent-soft: #12313B; --accent-ink: #061216;
    --good: #4BC28A; --good-soft: #112A1F; --warn: #E3A23E; --warn-soft: #2D2211; --error: #FF7262; --error-soft: #35181A;
    --plane: #0D1317; --grid-minor: #14212A; --grid-medium: #1A2D38; --grid-major: #21404F;
    --axis: #94A8B3; --axis-label: #8197A3; --ruler-tick: #B4C1C9;
    --cut: #FF6B3D; --pole: #FF5A85; --zero: #E3EAEE; --probe: #E3EAEE; --halo: #0D1317; --fov: #94A8B3;
    --dc-line: #FFFFFF; --dc-casing: #05090B;
    --land-top: #1A252C; --land-bottom: #0A1013; --land-floor: #10181D; --land-box: #36474F;
    --land-mod-line: #05090B; --land-arg-line: #FFFFFF; --plaster: #C9CFD2; --land-shadow: #000000;
    --halo-a: 0.85; --fov-a: 0.60; --cursor-a: 0.40; --dc-line-a: 0.22; --dc-axis-a: 0.70; --land-shadow-a: 0.55;
    --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.40);
    --shadow-3: 0 12px 32px rgba(0, 0, 0, 0.50), 0 2px 6px rgba(0, 0, 0, 0.35);
    --scrim: rgba(0, 0, 0, 0.55);
    color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #12191E; --panel: #172026; --surface: #1D282F; --surface-2: #23303A; --well: #121A1F;
  --inverse: #E3EAEE; --inverse-ink: #12191E;
  --ink: #E3EAEE; --ink-2: #B4C1C9; --muted: #91A1AB; --faint: #5E6E78;
  --line: #26333B; --line-strong: #36474F;
  --accent: #52B7D3; --accent-hover: #78C9E0; --accent-soft: #12313B; --accent-ink: #061216;
  --good: #4BC28A; --good-soft: #112A1F; --warn: #E3A23E; --warn-soft: #2D2211; --error: #FF7262; --error-soft: #35181A;
  --plane: #0D1317; --grid-minor: #14212A; --grid-medium: #1A2D38; --grid-major: #21404F;
  --axis: #94A8B3; --axis-label: #8197A3; --ruler-tick: #B4C1C9;
  --cut: #FF6B3D; --pole: #FF5A85; --zero: #E3EAEE; --probe: #E3EAEE; --halo: #0D1317; --fov: #94A8B3;
  --dc-line: #FFFFFF; --dc-casing: #05090B;
  --land-top: #1A252C; --land-bottom: #0A1013; --land-floor: #10181D; --land-box: #36474F;
  --land-mod-line: #05090B; --land-arg-line: #FFFFFF; --plaster: #C9CFD2; --land-shadow: #000000;
  --halo-a: 0.85; --fov-a: 0.60; --cursor-a: 0.40; --dc-line-a: 0.22; --dc-axis-a: 0.70; --land-shadow-a: 0.55;
  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.40);
  --shadow-3: 0 12px 32px rgba(0, 0, 0, 0.50), 0 2px 6px rgba(0, 0, 0, 0.35);
  --scrim: rgba(0, 0, 0, 0.55);
  color-scheme: dark;
}
body { background: var(--bg); color: var(--ink); }
```

Dark-theme contrast, measured: ink on panel 13.6:1, muted on panel 6.2:1, accent on panel 7.1:1, good 7.4:1, warn 7.5:1, error 6.2:1. On the plane: grid-major 1.70:1, axis 7.6:1, cut 6.6:1 and pole 6.3:1.

The dark theme is deliberately blue-slate (hue about 205°), not near-black. The plane is the darkest surface so that fills pop. The chrome steps up from it: plane, then well, then bg, then panel, then surface.

A theme switch in the header sets `data-theme` on `<html>` and cycles system → light → dark. After any theme change, call `readTheme()` and mark all panes dirty.

### 2.3 Shape palette: 8 colors at matched lightness

The base colors sit at OKLCH L 0.54–0.67 with the highest chroma in gamut. Each one therefore has contrast of at least 3:1 against both planes, or is carried by a boundary stroke that has it. Successive presets alternate cool and warm so that neighboring shapes never look alike. Every shape uses four derived shades, computed in OKLCH and also used for custom colors:

- **stroke on light plane** = (L − 0.17, C, h)
- **stroke on dark plane** = (L + 0.17, 0.8·C, h)
- **checker alt on light plane** = (L + 0.18, 0.55·C, h)
- **checker alt on dark plane** = (L − 0.15, 0.8·C, h)

Chroma is clamped to 97% of the sRGB gamut limit.

| # | Name | Base | vs light plane | vs dark plane | Stroke light | Stroke dark | Alt light | Alt dark |
|---|---|---|---|---|---|---|---|---|
| 1 | Cobalt | `#3B6FD4` | 4.7 | 3.9 | `#093B9B` | `#79A7FA` | `#8CABE5` | `#1F4591` |
| 2 | Amber | `#CD821A` | 3.0 | 6.0 | `#8A560B` | `#FBBD78` | `#F0C598` | `#925B0A` |
| 3 | Teal | `#12938F` | 3.7 | 4.9 | `#0A5C5A` | `#74C5C1` | `#8EC3C0` | `#096260` |
| 4 | Orchid | `#BC4E98` | 4.4 | 4.1 | `#831466` | `#EA8EC9` | `#DD9DC5` | `#802E67` |
| 5 | Leaf | `#31983D` | 3.6 | 5.0 | `#086119` | `#7ECA80` | `#94C795` | `#166721` |
| 6 | Violet | `#7F56C4` | 5.1 | 3.5 | `#50218C` | `#AF91EC` | `#AE9CDA` | `#523284` |
| 7 | Olive | `#888D22` | 3.5 | 5.2 | `#575A08` | `#BCC174` | `#BEC390` | `#5D600A` |
| 8 | Slate | `#607183` | 4.9 | 3.7 | `#324152` | `#95A3B3` | `#9CA6B1` | `#3A4654` |

The base and its alt shade differ by about 2:1 in every case, so the checker reads clearly without becoming loud. Strokes measure at least 5:1 on their plane, which is why boundaries stay legible over any pattern. Strokes are also always drawn on a `--halo` casing; see 6.2.

### 2.4 Phase wheel (domain coloring hue)

The phase wheel uses a perceptually uniform OKLCH wheel, not HSV. HSV draws false yellow and cyan ridges and dark blue troughs that are not in the function.

- Hue mapping: `h = 29° + deg(arg w)` (mod 360). Positive reals get the conventional red, and arg increases counterclockwise through yellow, green, cyan, blue and magenta.
- The sRGB gamut allows at most C = 0.125 at L 0.74 for every hue. Use C = 0.12 for "Phase only". Shaded modes use a LUT whose chroma is clamped per hue.
- **LUT:** a 512 × 64 RGBA8 texture is built once in JS. x = arg/2π. y = L, linear from 0.30 to 0.90. Each texel is `oklch(L, min(0.13, 0.97·maxC(L,h)), h)` converted to sRGB. Shaders sample it; they never convert color per pixel.
- Reference wheel at L 0.74, C 0.12, every 30° of arg starting at arg = 0: `#ED8C7F #E39759 #C9A747 #A3B559 #71C080 #3BC3AC #29BFD3 #5AB5EE #8CA7F7 #B599EC #D58FD0 #E88AA9`.

---

## 3. Typography

Three families from Google Fonts. Each has exactly one job.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..700&family=B612+Mono:wght@400;700&family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap">
```

| Family | Role | Why this one |
|---|---|---|
| **Archivo** (variable: width 75–125, weight 400–700) | All UI words: labels, buttons, headings, descriptions. The wordmark uses it at semi-expanded width. | A grotesque with a real width axis. Dense instrument labels (matrix headers, property strip, slider ticks) use the semi-condensed cut at `font-stretch: 87.5%` instead of a smaller size, the way engraved instrument panels do. It is not one of the default "safe" faces. |
| **B612 Mono** (400, 700) | Numbers that are measured: readout chips, numeric and complex inputs, ruler tick labels, the t and angle readouts. | Designed by Intactile for Airbus cockpit displays. Its glyphs are built for at-a-glance numeric reading, with unambiguous 0/O and 1/l. Mono is used only where digits must align or be compared. Word labels never use it. |
| **STIX Two Text** (italic 400–600, upright 500) | Mathematical variables in chrome and on canvas: plane titles (*z*-plane, *w*₁-plane), point labels (*p*₁), parameter names (*a*, *b*, *c*, *d*, *α*, *φ*), sphere labels (0, ∞, 1, *i*). | It matches the Times-like TeX glyphs that MathJax renders. A variable therefore looks the same in a label and inside a formula. |

**Type scale (px).** The ratio is about 1.1 at the small end and opens to 1.25 for titles. Everything sits on a 4px rhythm.

| Token | Size / line | Family, weight, width | Tracking | Use |
|---|---|---|---|---|
| `--t-micro` | 10 / 12 | B612 Mono 400 | 0 | ruler and canvas tick labels, 3D tick labels |
| `--t-caption` | 11 / 14 | Archivo 600, 87.5% | +0.01em | property strip, matrix column heads, slider tick labels, kbd hints |
| `--t-label` | 12 / 16 | Archivo 500, 100% | 0 | field labels, small buttons, segmented controls, tool-key labels (tool keys use 87.5% width) |
| `--t-body` | 13 / 18 | Archivo 400, 100% | 0 | default UI text, menu items, descriptions |
| `--t-heading` | 13 / 18 | Archivo 600, 100% | 0 | section headings, card names, pane-head words |
| `--t-readout` | 11.5 / 16 | B612 Mono 400 | 0 | readout chips, numeric and complex inputs, formula input |
| `--t-math-s` | 13 / 18 | STIX Two Text italic 500 | 0 | parameter names, point labels on canvas |
| `--t-math` | 15 / 20 | STIX Two Text italic 500 | 0 | pane titles (*z*-plane), connector variables |
| `--t-wordmark` | 14.5 / 20 | Archivo 640, 112.5% | +0.01em | header wordmark only |
| `--t-title` | 19 / 24 | Archivo 600, 100% | −0.005em | modal titles |

**Rules**

- **Sentence case everywhere.** There are no ALL-CAPS tracked eyebrows; they are removed from every `h2` and `h3` and from the rails. Section headings are `--t-heading` in `--ink`.
- **Numerals.** Apply `font-variant-numeric: tabular-nums` to every element that shows a changing number: `.num`, inputs, matrix, sliders, readouts. Add `font-feature-settings: "zero"` on Archivo numerals where available.
- **Real minus sign.** Formatted numbers use U+2212 "−", never a hyphen. Complex numbers are written as `0.4210 + 1.2034i` and `0.4210 − 1.2034i`, with a normal space around the operator. Angles use the ∠ sign and degrees, as in `1.82 ∠ 12.4°`.
- **Precision.** Readouts show 4 decimals when 10⁻³ ≤ |x| < 10⁴. Outside that range they show 3 significant digits as `1.23×10⁴`, with a superscript exponent. Ruler labels show the minimal number of decimals the step needs. Imaginary-axis labels read `2i`, `i`, `−i`, `−0.5i`.
- **MathJax sizing.** Scale MathJax to 15px in formula wells, 13.5px in cards and lists, and 14px in the chain header. Until MathJax loads, show the fallback in STIX Two Text italic at the same size. Reserve a `min-height` of one line so nothing jumps when it loads.
- **Line length.** Body copy stays under 68 characters (guide modal, property definitions).

---

## 4. Layout, spacing, radii, borders, elevation

### 4.1 Spacing scale (4px base)

`--s-1: 2px; --s-2: 4px; --s-3: 6px; --s-4: 8px; --s-5: 12px; --s-6: 16px; --s-7: 20px; --s-8: 24px; --s-9: 32px`

- Control heights are 24 (compact), 28 (default) and 32 (header and search).
- Panel sections use 12px padding on all sides. Gaps are 8px between related controls and 12px between groups.
- Content aligns to a 4px grid. Icons are centered optically in 28px squares.

### 4.2 Desktop frame (1440 × 900 budget)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐ 44
│ [mark] Complex Map Workbench │ Examples ▾  ↶ ↷                               ◧  ◨  ◐  ?        │
├──────────┬─────────────────────────────────────────────────────────────────────┬─────────────┤
│ Draw     │ ┌ z-plane  domain ────────────●┐ ┌ [Image|Phase|Landscape|Sphere|Morph] w = F(z) ●┐ │
│ [keys]   │ │z 0.42+1.20i  |z| 1.27 …     ⊕│ │w …   F′ 1.82∠12.4°       [legend]          │ │
│ 4 × 5    │ │                               │ │                                          │ │
│          │ ┃   graph paper plate            │ ┃   graph paper plate                      │ │ Properties
│ Region   │ ┃                                │ ┃                                          │ │ lamps ×8
│ from a   │ ┃                           [+]  │ ┃                                     [+]  │ │
│ formula  │ ┃                           [−]  │ ┃ [mode options]                      [−]  │ │ Natural
│          │ ┃                           [⊡]  │ ┃                                     [⊡]  │ │ domain
│ Shapes   │ └━━━━━━━━━━━━ ruler ━━━━━━━━━━━━━┘ └━━━━━━━━━━━━━━ ruler ━━━━━━━━━━━━━━━━━━━┘ │
│ rows     │ Function chain   F = f₂ ∘ f₁                     [Cards|Compact] Whole chain Clear │ Step-by-step
│          │ ┌Region┐ →w₀→ ┌f₁ Exponential┐ →w₁→ ┌f₂ Möbius┐   ┌ + Add function ┐              │ matrix
│ Display  │ └──────┘      └──────────────┘      └─────────┘   └────────────────┘              │
└──────────┴─────────────────────────────────────────────────────────────────────┴─────────────┘
  252                              fluid (≈ 868)                                     288
```

- Outer padding is 8px, plus `env(safe-area-inset-*)`. Column gap is 8px. Columns are `252px minmax(0,1fr) 288px`.
- Vertical budget at 900px: header 44 + planes 572 + gap 8 + chain 268 + bottom 8. Each plane gets 32 of head plus about 522 of plot plus an 18px ruler.
- The pane foot bars are deleted. Their content moves into overlays (5.8), which returns 32px of plot height to every plane.

### 4.3 Breakpoints

| Width | Layout |
|---|---|
| ≥ 1280 | Three columns as above. |
| 1024–1279 | The right panel starts as a 36px rail. Opening it shows a 288px overlay drawer over the stage (elevation 3). The left panel stays docked at 240px. |
| 768–1023 | Both side panels are rails. Each opens as an overlay drawer, and only one is open at a time. The planes stay side by side. |
| < 768 (phone) | Single column, 16px side gutters, no horizontal page scroll. See below. |

**Phone (< 768).**

- **Header.** 44px tall: mark, the wordmark "Complex Map Workbench" at 13px (ellipsis if needed), then Undo, Redo and a ⋯ menu. The menu holds Examples, Theme, Guide and Panels.
- **View switch.** A 36px segmented control, "Domain | Image", plus a mode select chip (Image, Phase, Landscape, Sphere, Morph). Only one plane shows at a time, at `height: min(68vh, calc(100vw - 32px + 48px))`.
- **Plane details.** Rulers shrink to 14px. Overlay buttons are 32px with 44px hit areas made by transparent padding.
- **Chain.** The function chain follows the plane, as a horizontally scrolling row with `scroll-snap-type: x mandatory`. The row has `overflow-x: auto` and `min-width: 0`, so it scrolls inside its own box and never widens the page.
- **Draw.** A "Draw" button (pencil-and-square icon) sits at the bottom-left of the plane. It opens a bottom sheet at up to 80vh, with tool keys in 5 columns, the formula input and the shapes list.
- **Properties.** These sit below the chain in a disclosure. Its summary row shows the 8 lamps in a line.
- **Touch.** Pinch to zoom and two-finger drag to pan. Long-press shows the probe and readout. Drawing tools use one finger.

### 4.4 Radii

| Token | Value | Applies to |
|---|---|---|
| `--r-1` | 2px | tags, swatches, slider thumbs, kbd keys, matrix cells, lamps |
| `--r-2` | 3px | buttons, inputs, segmented controls, tool keys, readout chips, overlay controls |
| `--r-3` | 4px | panels, planes, step cards, shape rows |
| `--r-4` | 6px | popovers, command palette, menus, modal, drawers |

Circles are allowed only for the status LED, point markers, radio dots and the brand mark. There are no pill shapes; the 999px chips are removed.

### 4.5 Borders and elevation (what gets a border, what gets a shadow)

| Level | What | Treatment |
|---|---|---|
| 0 | App background | `--bg`, nothing else |
| 1 | Side panels, pipeline strip, step cards, shape rows | 1px `--line` border, no shadow |
| 1-plate | The two planes | 1px `--line-strong` border, no shadow. The plate is set apart by its ruler frame, not by a shadow. |
| 2 | Anything floating over a canvas: readout chip, legends, zoom stack, mode strip, morph transport | `color-mix(in srgb, var(--surface) 92%, transparent)` background, 1px `--line-strong`, `--shadow-1` |
| 3 | Popovers, menus, command palette, drawers, complex pad | `--surface`, 1px `--line-strong`, `--shadow-3`, `--r-4` |
| Modal | Guide | Level 3 plus a `--scrim` backdrop |

**Rules**

- Never use `backdrop-filter`. Blur over a WebGL canvas forces a recomposite every frame, which feeds the lag.
- Never animate shadows.
- Never give a card both a colored side rail and a shadow.
- A dashed 1px border has exactly two meanings: an "add" affordance, or a truncation or field-of-view line on canvas.
- A 1.5px `--ink` rule appears only above the composite row of the matrix.

---

## 5. Components

### 5.1 Header and brand mark

The header is 44px tall on `--bg`, with no border. It contains, in order:

1. The mark, 22px.
2. An 8px gap, then the wordmark "Complex Map Workbench" in `--t-wordmark` and `--ink`.
3. A 16px gap, then a vertical 1×20 divider in `--line-strong`.
4. A 12px gap, then the "Examples" menu button: ghost style, 28px tall, text plus a 12px chevron.
5. Undo and Redo as icon buttons with tooltips "Undo (⌘Z)" and "Redo (⇧⌘Z)".
6. A flex spacer.
7. Icon toggles for the left panel (◧) and the right panel (◨). Pressed means "shown", drawn as a `--well` background with an `--ink` icon. They have tooltips with the keys [ and ].
8. A theme cycle button: a half-filled circle icon with tooltip "Theme: system".
9. Guide: a question mark in a 16px circle.

The static signature *w = fₙ ∘ ⋯ ∘ f₁(z)* is removed from the header. The live composite lives in the chain header.

**Mark.** It is a graduated dial around a Poincaré disk. A unit circle carries four calibration ticks, and inside it sits an ideal hyperbolic triangle: three arcs orthogonal to the boundary with cusps at 90°, 210° and 330°. It reads as "instrument" at 22px and as "conformal geometry" to anyone who knows the disk model. The geometry is exact: each geodesic is an arc of radius 9√3 centered 18 units from the disk center.

```svg
<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" class="mark">
  <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.5"/>
  <path d="M12 3A15.588 15.588 0 0 1 4.206 16.5A15.588 15.588 0 0 1 19.794 16.5A15.588 15.588 0 0 1 12 3Z"
        fill="var(--accent)" fill-opacity=".16" stroke="currentColor" stroke-width="1.25" stroke-linejoin="miter"/>
  <path d="M22 12h1.75M12 2V.25M2 12H.25M12 22v1.75" stroke="currentColor" stroke-width="1.25" stroke-linecap="butt"/>
</svg>
```

Set `color: var(--ink)`. The same mark at 16px with `fill-opacity: .24` serves as the favicon.

### 5.2 Tool palette and icon rules

**Keys.** The grid has 4 columns of 54 × 48 keys with 4px gaps. Each key has a 20px icon 7px from the top and a label in `--t-label` at 87.5% width, 6px from the bottom. The row order is semantic:

| Row | Keys |
|---|---|
| 1 | Select (V), Point (P), Segment (S), Line (L) |
| 2 | Ray (R), Circle (C), Arc (A), Freehand (F) |
| 3 | Disc (D), Rectangle (B), Polygon (G), Lasso (O) |
| 4 | Half-plane (H), Annulus, Sector, Formula. The Formula key focuses the formula input. |
| 5 | Grid, Polar grid |

**Key states**

- Rest: transparent background, `--ink-2` icon and label.
- Hover: `--surface` background with a 1px `--line` border.
- Active tool: a lit key, `--inverse` background with `--inverse-ink` icon and label.
- Focus-visible: 2px `--accent` outline, 1px offset.

**Hint line.** It sits under the grid in `--t-body` and `--muted`, one short line naming the action and the modifier. Example: "Circle: drag from the center outward. Shift snaps the radius." The current 3-line paragraph goes.

**Icon rules** apply to tools, header and overlay icons alike.

- Drawing grid and stroke:
  - Draw on a 20 × 20 grid with a 2px safe margin, using `currentColor`.
  - Stroke is 1.5px with butt caps and miter joins (miter limit 4).
  - Thin structure lines inside grids are 1px.
- Fills:
  - Area tools fill with `currentColor` at 0.16 opacity.
  - There are no other fills, gradients or shadows.
- Construction grips:
  - Construction points are drawn as 3 × 3 filled squares, like CAD grips: segment ends, arc ends and midpoint, polygon vertices, rectangle corners.
  - Centers are drawn as a small "+" with 2.5px arms at 1px.
  - The point tool is the one exception: a 5px filled dot, matching the on-canvas point marker.
- Arrowheads are open 4px chevrons.
- Half-plane: a horizontal boundary with an arrow along it, plus three 45° hatch strokes on the region side. The hatch is the same language as the branch-cut hatch.
- Annulus is two concentric circles with the ring filled at 0.16. Sector is a wedge with a vertex grip. Polar grid is two circles plus four rays at 1px.
- Select is an outline arrow cursor at 1.5px, not filled.
- No emoji glyphs anywhere. The current ●/◌/×/⏻/‹ › text glyphs become SVG icons: eye, eye-off, close, bypass toggle, more (three dots).

### 5.3 Segmented controls

- The track is 28px tall on `--well`, with a 1px `--line` border, `--r-2` and 2px inner padding.
- Segments are 22px tall with 0 10px padding, in `--t-label` and `--muted`.
- The selected segment has a `--surface` background, a 1px `--line-strong` border and `--ink` text. It has no shadow. In dark mode it uses `--surface-2`.
- Hover on an unselected segment changes the text to `--ink`.
- Use `role="radiogroup"` and arrow-key navigation.
- A compact variant inside overlays is 24px tall with 20px segments.

### 5.4 Buttons

| Variant | Spec |
|---|---|
| Default | 28px tall, padding 0 10px, `--surface` background, 1px `--line-strong`, `--r-2`, `--t-label` in `--ink`. Hover changes the border to `--ink-2`; active uses a `--well` background. |
| Primary | `--accent` background and border, `--accent-ink` text, weight 600. Hover uses `--accent-hover`. Use at most one per region: "Add" next to the formula input, "Add function" in empty states. |
| Ghost | Transparent with no border and `--muted` text. Hover uses a `--well` background and `--ink` text. |
| Icon | 28 × 28 (24 × 24 compact) with a 16px icon in `--ink-2`, ghost behavior. A pressed toggle uses a `--well` background and `--ink` icon. |
| Danger (menu items, editor delete) | Ghost style; hover uses `--error-soft` background with `--error` text. |
| Disabled | 40% opacity, `cursor: default`, no hover change. |

Focus-visible on any control is `outline: 2px solid var(--accent); outline-offset: 1px`. Labels never end in "→".

### 5.5 Inputs, including complex-number inputs

**Text input**

- 28px tall (24px in cards), padding 0 8px, on `--well`, with a 1px `--line` border and `--r-2`.
- Text is `--t-readout` (B612 Mono) for anything mathematical. Plain text such as search uses Archivo 13.
- Hover changes the border to `--line-strong`.
- Focus switches the background to `--surface`, the border to `--accent`, and adds `box-shadow: 0 0 0 1px var(--accent)`.
- Invalid shows a 1px `--error` border with an 11.5px `--error` message underneath. The message says what is wrong and how to fix it, for example "Expected a number like 1+2i or e^{iπ/4}". No icon, no apology.

**Formula input** for regions: a full-width text input with an "Add" primary button joined to its right edge (shared border, radii only on the outer corners). The live TeX preview below it sits in a `--well` strip, 28px minimum height, with MathJax at 13.5px. Suggestion tags sit below that: `--r-1` squares, 22px tall, 1px `--line`, B612 Mono 11px, `--ink-2`. They are tags, not pills.

**Complex-number input.** It is the same field with two additions:

- **Argand glyph.** A 16 × 16 SVG sits inside the right edge of the input. It holds a circle of r = 6 in 1px `--line-strong`, axes in 1px `--line`, and a 3px `--accent` dot at `6·c/max(|c|,1)` relative to center. When |c| > 1 the dot rides the circle and becomes a 4px hollow square, meaning "outside the unit disk". Clicking the glyph opens the complex pad.
- **Focus readout.** While the field is focused, a 16px line under it shows the polar form in `--muted` B612 Mono 10.5px: `|c| 2.2361  ∠ 63.43°`.
- **Scrubbing.** The parameter label (STIX italic, such as *a*) has `cursor: ew-resize`. Dragging it horizontally changes Re(c). Holding Shift changes Im(c), and Alt moves at one tenth the rate. The step is `niceStep(|c| or 1)/100` per pixel. A tooltip shows the live value. On release, one undo step is committed.

**Complex pad (popover, level 3).** A 176 × 176 graph-paper plane using the plane tokens. It shows the unit circle as a 1px dashed `--axis`, and a draggable 8px point in `--accent` with a 2px `--surface` ring. The point snaps to the 0.05 grid; Shift snaps to the unit circle and Ctrl to multiples of 15°. The readout below shows `c = 0.7071 + 0.7071i`. The pad closes on Esc or an outside click.

**Number inputs** for integers and angles have no native spinners (hide them). Arrow keys step by 1, Shift+Arrow by 10, and angles by 15° with Shift. They use the same scrubbable label.

### 5.6 Checkboxes and sliders

**Checkbox:** a 14 × 14 box with `--r-1` and a 1px `--line-strong` border on `--surface`. Checked uses an `--inverse` fill with a 1.75px `--inverse-ink` check, drawn as an SVG polyline. The label is `--t-body` at 8px distance, and the whole row is clickable.

**Slider** (a fader, the instrument version):

- **Track.** The hit area is 20px tall. The visible track is 2px of `--line-strong`; the filled portion from min to the thumb is 2px of `--accent`.
- **Thumb.** A 10 × 16 vertical rectangle with `--r-1`, `--surface` fill, a 1px `--ink-2` border and a 1px horizontal center notch in `--ink-2`. Hover changes the border to `--ink`. While dragging, the border becomes `--accent`.
- **Ticks.** Named stops get 4px ticks under the track in `--line-strong`, labeled in `--t-caption` and `--muted`. Clicking a tick label jumps to it. For mesh this replaces the separate "Draft/Normal/Fine/Ultra/Max" segmented control: the labels sit under their positions, 80, 140, 260, 420 and 800.
- **Value.** It sits at the right in `--t-readout`, right-aligned in a fixed 72px box: `140 cells`, `0.85`.
- **Implementation.** Use a native `input[type=range]` with `appearance: none` and both thumb and track styled in the `::-webkit-` and `::-moz-` pseudo-elements.

### 5.7 Shape list rows

Each row is a box with 1px `--line`, `--r-3` and a `--surface` background. There is a 4px gap between rows. The row line is 34px tall, laid out in grid columns `16px 1fr 24px 24px` with an 8px gap and padding 0 4px 0 8px.

- **Swatch.** 14 × 14, `--r-1`, showing the shape's current pattern in miniature. For the checker this is `background: repeating-conic-gradient(var(--c) 0 25%, var(--c-alt) 0 50%) 0 0 / 7px 7px; box-shadow: inset 0 0 0 1px var(--c-stroke)`. Curves show a 2px diagonal line in their color. Clicking the swatch opens a level-3 popover with the 8 presets as 20px swatches and a "Custom color" item that opens a native color input.
- **Name and description.** The name line ("Disc 1") is Archivo 12.5/500 in `--ink`. The description is the TeX of the set at 12px in `--muted`, on one line. It is clipped with a 16px right fade (`mask-image: linear-gradient(90deg,#000 calc(100% - 16px),transparent)`) and shown in full in a tooltip.
- **Eye toggle.** Eye and eye-off icons in `--ink-2`. When hidden, the name is `--faint` and the swatch becomes hollow (border only).
- **More menu (⋯).** Use complement, Duplicate, Bring forward, Send backward, and Delete (danger).
- **Hover.** The border changes to `--line-strong`, and the shape is emphasized on both planes. Its stroke grows by 0.5px and the other shapes' fills drop to 50%.
- **Selected.** 1px `--accent` border plus `box-shadow: inset 0 0 0 1px var(--accent)`. The editor expands below a 1px `--line` divider.
- **Editor.** Two-column grid with 8px padding and a 6px gap. Labels are math names in STIX italic 13 ("center *c*", "radius *r*", *r*₁, *r*₂, *θ*₁, *θ*₂), and fields are complex or number inputs at 24px. At the bottom is an "Use complement" checkbox.
- **Empty state.** A single line in `--muted`: "No shapes yet. Pick a drawing tool or type a set above."

### 5.8 Pane chrome (the plates)

**Structure**

```
┌ head 32px ─────────────────────────────────────────────────────────┐
│ z-plane  domain                                         ●(LED)     │
├──┬─────────────────────────────────────────────────────────────────┤
│  │ [readout chip]                                    [legend chip] │
│Im│                                                                 │
│  │                    plot (WebGL + 2D overlay)                [+] │
│  │                                                             [−] │
│  │ [mode options strip]                                        [⊡] │
│  │                                                             [⤢] │
├──┼─────────────────────────────────────────────────────────────────┤
│ z│                             Re ruler                            │
└──┴─────────────────────────────────────────────────────────────────┘
```

**Head.** 32px on `--panel` with a 1px `--line` bottom border and padding 0 6px 0 10px.

- **Left pane title.** The plane name in `--t-math` (*z*-plane, *w*₁-plane) followed by a role in `--t-body` and `--muted`: "domain", or "input of *f*₂" when a step is focused.
- **Right pane.** The mode tabs come first, as a segmented control: Image, Phase, Landscape, Sphere, Morph. The current "Color plot" and "3D" are renamed to the field's own terms. The title follows, right-aligned: "*w* = *F*(*z*)" or "*w*₂-plane, output of *f*₂". It hides below 520px of pane width.
- The overlay note that covered the left plane is removed; that information now lives in the head.

**Status LED.** A 6px circle at the far right of the head, with a tooltip.

- `--good` when the view is current.
- `--warn` when refining or computing, pulsing opacity 1 → 0.35 over 1.2s ease-in-out. It is steady under reduced motion.
- `--error` when evaluation failed. The tooltip names the step: "f₂ is undefined on part of this view".

**Rulers**

- Size and frame: 18px wide (left) and 18px tall (bottom) on `--panel`, with a 1px `--line` edge against the plot. A corner square bottom-left shows the plane variable in STIX italic 12 and `--axis-label`.
- Ticks:
  - Minor ticks are 3px, medium 5px and major 7px, in `--ruler-tick`, 1 device pixel wide.
  - Ticks follow the grid tiers in 6.1.
  - Ticks spaced closer than 6px are dropped.
- Labels:
  - Labels use `--t-micro` in `--axis-label`.
  - Bottom labels are centered under major ticks with the baseline at 14px.
  - Left labels are rotated −90° and read bottom to top.
  - Labels within 12px of either end are dropped.
- **Cursor marker.** While hovering either plane, a 5 × 4 `--accent` triangle points into the plot at the cursor's x on the bottom ruler and y on the left ruler. The linked pane shows its own markers at the probe's image.

**Readout chip** (top-left, 8px inset, level 2)

- **Size and style.** 24px tall, padding 0 8px, `--r-2`. Text is `--t-readout`, with field names in `--muted` and values in `--ink`. The variable name is set in STIX italic 13.
- **Hover (left pane).** `z  0.4210 + 1.2034i   |z| 1.2749   arg 72.08°`
- **Hover (right pane).** `w  −0.3127 + 0.8810i   F′ 1.8203 ∠ 12.40°`
- **Idle.** It shows the plate's scale like an oscilloscope's V/div readout, `0.5 / div`, which is the major grid step.
- **Copy.** Clicking the chip copies `0.4210+1.2034i` to the clipboard, and the chip text reads "Copied" for 900ms.
- **Layout.** Values are fixed-width, so the chip never jitters while the cursor moves.

**Legend chip** (top-right, 8px inset, level 2, mode-dependent)

- **Image.** Pattern key: the swatch plus "cell 0.5 × 0.5 in *z*", where the cell size comes from 6.2.
- **Phase.** The wheel legend from 6.5.
- **Landscape.** An axis gizmo and the height key from 6.6.
- **Sphere, Morph.** None.
- Every legend collapses to a 20px icon when clicked, and the state persists in localStorage.

**View stack** (bottom-right, 8px inset). Two joined groups, each level 2 with `--r-2`:

1. Zoom in (+) and zoom out (−) in a 28 × 56 group with a 1px `--line` separator.
2. After a 4px gap, Fit (four corner brackets around a dot) and Expand or collapse (diagonal arrows).

Tooltips give the shortcuts: "Fit view (Z)", "Expand plane". The "Fit" text buttons in the heads are removed.

**Mode options strip** (bottom-left, 8px inset, right pane only). Level 2, 32px tall, padding 4px, compact 24px controls:

- **Image:** a "View outline" checkbox (field-of-view outline, 6.2).
- **Phase:** segmented [Perceptual | Vivid | Phase only | Modulus], then a "Contours" checkbox, then "Region outline".
- **Landscape:** segmented [log |F| | |F|], segmented [Phase | Plaster], a "Unit level" checkbox, and a reset-view icon.
- **Sphere:** segmented [Region image | Phase of F], a "Plane" checkbox, and a reset icon.
- **Morph:** the transport replaces the strip (6.8).

On phone the strip collapses into a single sliders icon that opens a popover.

**Empty states inside plates**

- **Left, no shapes.** Centered text in `--muted` 13px: "Draw a region with the tools, or type a set such as |z − 1| < 2." Under it sit three formula tags as buttons.
- **Right, no steps.** The identity image renders, with a top-center level-2 chip: "Add a function to map the region" and a primary "Add function" button.

### 5.9 Function chain and step cards

**Chain head.** 36px, padding 0 12px, with a 1px `--line` bottom border. It holds:

1. "Function chain" in `--t-heading`.
2. A 12px gap, then the live composite in MathJax at 14px: `F = f₂ ∘ f₁`, or `F = id`.
3. A spacer.
4. Segmented [Cards | Compact].
5. "Whole chain", a default small button, enabled only when a step is focused.
6. "Clear chain" as a ghost button.

**Strip.** `display:flex`, padding 8px 12px 12px, `overflow-x:auto`, and `scroll-snap-type: x proximity` on desktop. The scrollbar is thin: 8px, thumb in `--line-strong`, transparent track.

**Step card anatomy.** Fixed 240 × 216, `--surface`, 1px `--line`, `--r-3`, `overflow:hidden`.

```
┌──────────────────────────────────────────┐
│ [f₁] Exponential              f⁻¹  ⊘  ⋯  │ head 28
├──────────────────────────────────────────┤
│ w₁                                       │
│        thumbnail: image after step 1     │ thumb 88
├──────────────────────────────────────────┤
│ w₁ = e^{z}                    [sheet 0/2]│ formula 28
│ a [1+i        ◎]   b [0          ◎]      │ params 2 × 26
│ c [ …         ◎]   d [ …         ◎]      │
├────┬────┬────┬────┬────┬────┬────────────┤
│ A  │ E  │ R  │ P  │ M  │ Pr │ I          │ property strip 20
└────┴────┴────┴────┴────┴────┴────────────┘
```

- **Head (28px).** Padding 0 4px 0 6px, with a 1px `--line` bottom border.
  - Index tag: 22 × 18 on `--well`, `--r-1`, showing *f*₁ in STIX italic 13 and `--ink`.
  - Name: 6px from the tag, `--t-heading` 12.5px, ellipsized.
  - Action icons at 24 × 24, in order:
    - **f⁻¹**, set as STIX text at 12px and disabled when there is no inverse. Tooltip: "Replace with the inverse".
    - **Bypass**: a 16 × 10 switch glyph. When on, the step is active; when off, the step is bypassed.
    - **⋯ menu**: Move left, Move right, Duplicate, Presets (submenu, if the step has presets), Remove (danger).
  - The move arrows and close button are removed from the head. Drag the head to reorder: on drag the card lifts to level 3 and a 2px `--accent` insertion bar shows the drop slot.
- **Thumbnail (88px).**
  - Background and grid: the graph paper uses plane tokens, drawn without rulers or labels.
  - Content: the image of the region at this stage, with thin boundaries (6.9).
  - Label: the stage variable (*w*₁) sits top-left in STIX italic 12 and `--axis-label`, with a halo.
  - Bottom border: 1px `--line`.
- **Formula row (28px).** Padding 0 8px. MathJax at 13.5px: `w₁ = e^{z}`. Overflow scrolls horizontally on hover, with a right fade mask. Branch information sits right-aligned as a tag: B612 Mono 10.5, `--well` background, `--r-1`, `--muted`, for example `sheet 0/2` or `cut 180°`.
- **Parameters (52px = 2 rows × 26).**
  - Layout: two columns with a 6px gap. Each cell is a label (STIX italic 13, 16px wide) followed by a 24px complex or number input.
  - Wide parameters span both columns: the custom expression, coefficient lists, and the rational numerator and denominator.
  - **Möbius** draws its four coefficients as a 2 × 2 matrix. The 2 × 2 input block is framed by bracket glyphs: 1px `--ink-2` borders on the left and right with 3px top and bottom stubs. This makes the PGL(2, ℂ) structure visible.
  - **Disk automorphism** shows *a* and *φ*. **n-th root** shows *n*, cut and sheet, and the third parameter wraps to row 2.
  - If there are more than four parameters, the area scrolls vertically inside the card. This never happens with the current definitions.
  - **Errors** replace the second parameter row with an 11.5px `--error` message, and the card border changes to `--error`.
- **Property strip (20px).** A 1px `--line` top border and 7 equal cells divided by 1px `--line`. Text is `--t-caption`.
  - On: `--good` text on a `--good-soft` background.
  - Off: `--faint` text with no background.
  - Each cell has a tooltip with the full name and state, for example "Proper: guaranteed" or "Entire: not implied".
- **States**
  - Hover: border `--line-strong`. The step's cuts and poles are emphasized on the left plane.
  - Focused: border `--accent` with `box-shadow: inset 0 0 0 1px var(--accent)`.
  - Bypassed: the index tag shows *f*₁ struck through. Everything below the head drops to 45% opacity, and the connectors on both sides become dashed.
  - Error: border `--error`, and the property strip is hidden.

**Region card (stage 0).**

- Size: 200 × 216.
- Head: tag *z* and "Region".
- Thumbnail: the *z*-plane.
- Body (padding 8px): "3 shapes" in `--t-body`, then a row of 12px pattern swatches with a 4px gap. With no shapes, it says "Draw or type a region" in `--muted`.

**Connectors between cards.** A 40px column holds a 1px `--ink-2` line with an open 6px chevron arrowhead. The line is vertically aligned with the thumbnail center, 72px from the card top. Above the line sits the plane variable flowing through it, in STIX italic 13 and `--ink-2`: *z*, *w*₁, *w*₂. The chain reads *z* → *f*₁ → *w*₁ → *f*₂ → *w*₂. Hover tints the line `--accent`.

**Add card.** 128 × 216, 1px dashed `--line-strong`, `--r-3`, transparent. Centered inside it:

- a 28px square with a 1.5px plus icon,
- "Add function" in `--t-label` and `--ink-2`,
- the kbd hint `+`.

Hover changes the border and text to `--accent` on `color-mix(in srgb, var(--accent-soft) 50%, transparent)`.

**Compact mode.** Cards are 200 × 56: only the head and the formula row. The chain is 36 + 76 = 112px tall, and the planes gain 156px. Clicking a compact card focuses it and opens its parameters in a level-3 popover anchored above the card.

### 5.10 Add-function command palette

**Container.** Level 3, 560px wide, max-height 480px. It is anchored above the add card, or centered over the chain when there is no room. On phone it is a full-width bottom sheet at up to 85vh. It opens with `+`, `=`, a click on the add card, or "Add function" anywhere.

- **Search row (44px).** A 16px magnifier, then an Archivo 14 input with placeholder "Search functions, or type a formula such as z^3 − 1", then an `Esc` kbd. It autofocuses.
- **Results.** A scrolling list.
  - A "Recently used" group comes first, up to 4 items.
  - Then the seven groups in their current order.
  - Group headings are `--t-heading` 12px in `--muted`, sentence case, with 10px of space above.
- **Item row (40px).** Grid columns `132px 1fr auto`, with a 12px gap and 0 12px padding.
  - TeX preview at 15px, left-aligned.
  - Name in Archivo 13/500 `--ink`, over a one-line description in 11.5px `--muted`. Examples: "Conformal on ℂ; injective on strips of height 2π", "Circles to circles; ad − bc ≠ 0".
  - On the right, the 7 property letters in `--t-caption`. Lit letters are `--good`; unlit are `--faint`.
- **Active row** (hover or keyboard): `--accent-soft` background and the name in `--accent`. There is no side rail.
- **Formula fallback.** If the query parses as an expression in *z*, the first result is "Custom formula *f*(*z*) = ⟨live TeX⟩". Enter adds it.
- **Footer (28px, `--well`).** The kbd groups ↑ ↓ "move", Enter "add" and Esc "close", separated by 16px gaps.
- **Keys and search.** ↑/↓ move, Enter adds, Esc closes, and Tab cycles groups. Fuzzy-match on name, id and aliases. For example, "cayley" finds the Möbius preset and "sqrt" finds n-th root.

### 5.11 Properties panel

**Order.** Composite map, then Guarantees, then Natural domain, then Step by step. Sections are separated by 1px `--line` with 12px padding.

1. **Composite map.**
   - **Heading row.** `--t-heading` "Composite map", plus a collapse icon.
   - **Formula well.** `--well`, `--r-2`, padding 10px 12px.
     - First line: `F(z) = …` in MathJax at 15px.
     - Below a 1px `--line` divider: the chain lines `w₁ = …` at 13.5px, each prefixed by its index tag.
     - Bypassed steps read "*f*₂ bypassed" in `--muted`.
2. **Guarantees: an indicator panel.** Eight rows always appear in a fixed order: Analytic, Entire, Rational, Polynomial, Möbius, Proper, Homeomorphism onto image, Conformal onto image. Positions never reshuffle; this replaces the green boxes and the "Not guaranteed" pills.
   - **Row layout.** 30px tall: a 10 × 10 lamp (`--r-1`), then the name, then a qualifier, then a 12px chevron in `--faint`. Rows are separated by 1px `--line`.
   - **Lit lamp.** `--good` fill. The name is `--ink` 13/500.
   - **Unlit lamp.** A 1px `--line-strong` outline. The name is `--muted` 13/400.
   - **Qualifier.** Right-aligned B612 Mono 11 in `--muted`: `deg 2`, `deg ≤ 4`.
   - **Expanding a row** reveals the definition at 12.5/18 in `--ink-2`, indented 18px to align with the name. Today's descriptions keep their wording.
   - **Warnings** sit above the rows as a banner: `--warn-soft` background, a 1px border of `color-mix(in srgb, var(--warn) 40%, transparent)`, `--r-2`, a 14px triangle icon and text. Examples: "A step has an error. Steps with errors are skipped until fixed." and "A step is constant, so F is constant on D." An error lamp state is `--warn` filled.
   - **Footnote** in 11.5px `--muted`: "Unlit means the steps do not imply it. It may still hold."
   - **Lamp change.** When a lamp changes state, its row background flashes `--accent-soft`, fading out over 600ms.
3. **Natural domain D.** A formula well with "All z for which:" followed by the MathJax conditions as a list. The note "wₖ is the value after step k" is 11.5px `--muted`.
4. **Step by step: an indicator matrix.**
   - **Table.** Full width, with rows 26px tall.
   - **Header row.** "step", then the 7 abbreviations A, E, R, P, M, Pr and I in 24px columns, set in `--t-caption` and `--muted`. Each has a tooltip with the full name.
   - **Body rows.** The index tag and the name (ellipsized). Each cell holds a centered 8 × 8 `--r-1` square: `--good` fill when on, a 1px `--line-strong` outline when off. Check marks and dots are not used.
   - **Composite row "F".** It sits above a 1.5px `--ink` rule. Its name is weight 600 and its squares are 10 × 10.
   - **Linked hover.** Hovering a column fills it with `--well` and lights the matching Guarantees row. Hovering a row gives the matching step card an `--accent` border.
   - **Disclosure.** "How these are decided" follows, with the current text at 12.5/18 and at most 68ch.

### 5.12 Menus, popovers, tooltips, modal

**Menu.**

- Container: level 3, minimum width 200px, padding 4px.
- Items: 28px tall with 0 8px padding, `--r-2`.
  - Optional 16px icon on the left.
  - Label in `--t-body`.
  - Shortcut right-aligned in B612 Mono 11 `--faint`.
- Hover and keyboard: `--well` background.
- Separators: 1px `--line` with a 4px vertical margin.
- Submenus open to the right on hover with a 120ms delay.

**Examples menu.** Items are 52px tall:

- a 48 × 32 static thumbnail (pre-rendered at build time, `--r-1`, 1px `--line`),
- the title in 13/500,
- a one-line description in 11.5px `--muted`, for example "Circle through −1, offset ↦ wing profile".

**Tooltip.** `--inverse` background with `--inverse-ink` text, Archivo 12, padding 4px 8px, `--r-2`, maximum width 260px. The shortcut follows at 8px in B612 Mono 11 at 70% opacity. It appears after 450ms (0ms when moving between adjacent controls) and has no arrow. It is placed 6px from the anchor, preferring the top.

**Popover.** Level 3. Anchored popovers are offset 6px and flip on collision. Close on Esc, an outside pointerdown, or anchor re-click. Focus moves into the popover and returns to the anchor on close.

**Guide modal.**

- Size and style: 640px maximum width, padding 24px, `--r-4`, level 3 on `--scrim`.
- Title: "Using the Workbench" in `--t-title`.
- Sections: `--t-heading` headings, body at 13.5/21 and at most 68ch.
- Keys: kbd glyphs with a 1px `--line-strong` border and a 2px bottom border (keycap), B612 Mono 11, `--r-1`.
- Shortcuts are listed in a two-column table.

### 5.13 Side-panel rails and drawers

**Collapsed rail.** 36px wide on `--panel`, with a 1px `--line` border and `--r-3`. Top to bottom:

1. A 28px expand-chevron icon button.
2. **Left rail:** the active tool as a lit 28px key, then the shape count in B612 Mono 11.
3. **Right rail:** the 8 guarantee lamps as a vertical column of 10 × 10 squares with a 6px gap. Each has a tooltip with its name and state. A collapsed properties panel still reports, like indicator lamps on an instrument.
4. The rotated label "Region tools" or "Properties" in `--t-label` and `--ink-2`, sentence case, reading bottom to top.

The whole rail is a button that expands the panel.

**Overlay drawer** (widths below 1280 and 1024). Absolutely positioned over the stage, at 288px wide (right) or 252px (left), full height. Level 3, sliding in 160ms. It closes on Esc or an outside click.

On phone, rails become 36px horizontal bars with the same lamp row.

### 5.14 Loading, error and empty conventions

- **Never show a blank canvas.** If a stage is not computed yet, draw the graph paper and the source outlines. The LED is amber. A 2px `--accent` progress hairline runs along the top edge of the plot, as an indeterminate 900ms shuttle, only if the work takes more than 300ms.
- **Error copy** names the step and the fix. For example: "f₂ (Custom formula): unknown symbol \sinc. Try \sin or \sinh."
- MathJax fallbacks are described in section 3.

---

## 6. Canvas and plot rendering

All colors come from the tokens. All strokes are specified in CSS px unless marked "device px". Every line is antialiased: in shaders use `fwidth` coverage, and in 2D canvas use half-pixel alignment for 1-device-px lines.

### 6.1 Graph paper, axes, rulers

- **Grid tiers, with no popping during zoom.**
  - Let `s` be px per unit. Let `d = 10^ceil(log10(6/s))`, the smallest power of ten whose spacing is at least 6px.
  - Draw lines at multiples of `d`, `5d`, `10d`, `50d` and `100d`. Each line belongs to its coarsest tier.
  - Line color is set by that tier's on-screen spacing `p` in px: `mix(--grid-minor, --grid-major, smoothstep(40, 220, p))`, with `--grid-medium` as the midpoint stop.
  - Line alpha is `smoothstep(6, 16, p)`.
  - Color and alpha depend only on spacing, which changes continuously with zoom, so tiers fade in and darken smoothly. Today's `niceStep` grid pops at every 1-2-5 change.
  - All grid lines are 1 device px.
  - Implement this in the plane's fragment shader on a full-screen quad, not as Canvas2D paths.
- **Axes.** Re and Im axes are 1.25px in `--axis`. Ticks crossing the axes at label positions are ±2.5px, 1px, `--axis`. There are no arrowheads. The origin has no in-plot label; the rulers carry the numbers.
- **Unit circle** (toggle, default on): a 1px `--axis` stroke at 55% alpha with a 2–3 dash. Small 3px ticks mark where it crosses the axes.
- **Labels** live only in the rulers (5.8). The label step is the 1-2-5 `niceStep` with at least 72px spacing on the bottom ruler and 48px on the left ruler. Labels never sit under fills, which fixes the colliding "2i" and "−2i" labels in screenshot 1.
- **Field of view.** See 6.2.

### 6.2 Regions: fills, patterns, boundaries

**Whole-image rule.** This fixes the user's complaint that "only the part rendered on the left is visible".

- The image pane shows F(R) for the entire region R, independent of the left viewport.
- The mesh domain for a bounded region is the region itself.
- For an unbounded region (half-plane, strip, sector, complement, formula sets), the mesh domain is R ∩ D_work, where D_work is a disc. Its radius is `max(4 × half-diagonal of the left view, 12 × cell, 10)`, and it grows automatically when the left view zooms out. The grown mesh is computed in the worker; the draft mesh is shown until it is ready.
- Edges created by this truncation are drawn as **truncation edges**: 1px dotted (1,2) in the shape stroke color at 60%, with no casing. The fill alpha ramps to 0 over the last 6% of the radius, so the region visibly continues and does not end in a fake boundary.
- In the left pane the left viewport no longer clips anything.
- In Image mode the right pane draws the **field-of-view outline**: the image of the left viewport rectangle. It is a 1px dashed (5,4) `--fov` line at `--fov-a`, with 4px hollow squares at the images of the four corners. It shows where the visible part of the domain went. Toggle it with "View outline".

**Fill.** Fill opacity defaults to 0.85; the slider range is 0.20–1.00. The current 0.62 washes colors out. Fills are premultiplied. Pattern coordinates are the source point *s* in the plane where the shape was drawn, carried through the map per vertex. The cell size is `u` = the major label step of the left (source) pane. Each checker square is therefore exactly one labeled graph-paper square of the domain, and the legend says so. `u` updates only when the left pane crosses a 1-2-5 label step, not continuously.

**The eight patterns** are offered in a segmented control with a 20 × 20 swatch preview per option, inside the Display section. Lines are antialiased with `cov = 1 − smoothstep(w/2 − 0.5, w/2 + 0.5, d_px)`, where `d_px = abs(fract(g − 0.5) − 0.5) / fwidth(g)`.

| # | Name | Exact appearance | Why offer it |
|---|---|---|---|
| 1 | **Checker** (default) | Cells `u × u` aligned to the source grid. Parity `mod(floor(x/u) + floor(y/u), 2)` picks base or alt shade (2.3). | Shows area distortion and local rotation. Squares stay square under conformal maps. |
| 2 | **Log-polar checker** | Cells in (ln r, θ) with 16 angular sectors and a radial step of 2π/16 in ln r. The cells are conformally square, so they stay square under zⁿ, exp and log. Centered at the source origin. Base and alt shades. | The natural pattern for powers, roots, exp and log. Turns into a Cartesian checker under log. |
| 3 | **Mesh** | Fill is the alt shade. Lines where Re s = k·u are 1.25px in the stroke shade; lines where Im s = k·u are 1px in the base color. The two families stay visually distinct. | Shows orthogonality being preserved, which is conformality made visible. |
| 4 | **Polar mesh** | Fill is the alt shade. Circles at \|s\| = k·u are 1px in the base color. Rays every 15° are 1.25px in the stroke shade. | Shows how circles and rays transform, for example under Möbius maps or roots. |
| 5 | **Stripes** | Horizontal bands of height u/2, alternating base and alt, so they are level sets of Im s. | The simplest family. Shows exp turning lines into rays and log the reverse. |
| 6 | **Phase of z** | Ignores the shape color. Color is the phase wheel (2.4) of `arg s` with L = 0.62 + 0.14·fract(ln\|s\|/(π/6)), so the portrait of the identity is carried by the map. | Shows where each image point came from: every hue is an argument in the domain. |
| 7 | **F glyph lattice** | Fill is the alt shade. In each `u × u` cell sits an upright "F" in the base color, built from three rectangles in cell coordinates *q* ∈ [0,1)² with y up: stem [0.30,0.42] × [0.20,0.80], top bar [0.30,0.70] × [0.68,0.80], middle bar [0.30,0.60] × [0.46,0.56]. Antialiased with a box SDF over `fwidth`. | Shows orientation, local rotation (arg F′) and scale (\|F′\|). Conjugation visibly mirrors the F. |
| 8 | **Solid** | Flat base color at fill opacity. Boundary only. | For clean figures and screenshots. |

The "Source grid lines" overlay (today's "Coordinate grid on regions") is a toggle that works with any pattern. It draws source lines at spacing `u`, 1 device px, in `--ink` at 30% (light) or `#FFFFFF` at 30% (dark).

**Boundaries.** Casing comes first, then color. This is what keeps boundaries legible over patterns and grids.

- **Area boundary:** a 3.5px casing in `--halo` at `--halo-a`, then a 1.5px stroke in the stroke shade (light stroke on the light plane, dark stroke on the dark plane).
- **Curve shapes** (segment, line, ray, circle, arc, freehand): a 4px casing, then 2px in the base color.
- **Grid shapes:** a 2.5px casing, then 1px in the base color.
- **Selected:** +0.75px on the colored stroke. Handles are 7 × 7 squares with `--surface` fill and a 1.5px stroke in the shape color. A hovered handle fills with the shape color.
- **Hovered shape** (select tool or list hover): +0.5px, and the cursor becomes `move`.
- Joins and caps are round on canvas curves, to avoid spikes on tight bends. Icons use miter joins.
- **Draft** (shape being drawn): a 1.5px dashed (4,3) stroke in the shape color, fill at 35%, 6 × 6 filled vertex grips, and a dashed rubber band to the cursor.

### 6.3 Points, labels, probe, derivative gauge, drawing feedback

**Point marker.** A filled circle of r = 4 in the base color with a 2px `--halo` ring. A selected point adds a 1px ring at r = 8 in the base color.

**Label.** STIX Two Text italic 13 in `--ink`, drawn with a halo (`strokeText` at 3px in `--halo`, round join, then `fillText`). It sits at offset (+7, −7) and flips to the other quadrant within 24px of a pane edge.

- In the source plane: *p*₁.
- In the image plane: *p*₁′, a single prime regardless of chain length; the readout gives the exact value.
- User labels, such as "trailing edge", use Archivo 12/500 `--ink` with a halo, not serif italic. Words are not variables.

**Probe** (hover over either plane, linked).

- **Source crosshair.** Four 7px arms with a 4px center gap, 1.25px `--probe`.
- **Derivative gauge**, around the crosshair:
  - A 10px-radius circle, 1px `--probe` at 60%.
  - A 6px orientation tick from the circle at angle 0 (the +Re direction), 1.5px `--accent`.
- **Image side.** The other plane draws the crosshair at F(z). Around it go the image of that 10px circle (48 samples through F, 1px `--probe` at 60%) and the image of the tick in `--accent`. The ellipse-like curve shows |F′| and arg F′ directly: a conformal map gives a circle rotated by arg F′.
- **Clamping.** The drawn radius is clamped to 3–120px. When clamped, the readout adds `×` and the factor.
- **Readout.** The chip shows `F′ 1.8203 ∠ 12.40°`. At critical points (F′ = 0), the gauge collapses and the readout says "critical point".

**Drawing feedback.** These are dimension readouts, the way CAD software shows them.

- **Live dimension chip.** While drawing, a level-2 chip follows the cursor at (+14, +14). It shows:
  - circle or disc: `r = 1.2500`
  - rectangle: `2.0000 × 1.5000`
  - segment: `2.2361 ∠ 26.57°`
  - sector: `θ 0° → 60°`
  - annulus: `r₁ 0.5  r₂ 1.0`
- **Crosshair.** With a drawing tool active, full-span hairlines of 1px `--accent` at `--cursor-a` cross the left plot.
- **Snapping.** A snap shows as a 5 × 5 hollow `--accent` square at the snapped node, and the ruler markers jump with it.

### 6.4 Branch cuts, branch points, poles, zeros

- **Branch cut.** A 1.75px solid `--cut` line with a 3.5px `--halo` casing. Hatches sit on the closed side, the side whose values the cut takes (for the principal branch, the side approached counterclockwise). Hatches are 5px long at 45°, every 7px, 1.25px `--cut`. They borrow the "fixed support" hatch from engineering drawing and carry real information. They replace today's red dashes.
- **Branch point.** An open circle of r = 3.5 with `--halo` fill and a 1.5px `--cut` stroke.
- **Cut handle** (editable cuts).
  - Handle: a 12px ring (2px `--cut`, `--halo` fill) on the cut, at 0.33 of the view's smaller side.
  - Label: next to it, a level-2 chip with a 1px `--cut` border, B612 Mono 11 in `--cut`: `θ 180.0°`. The "(drag)" text is removed; the cursor shows `grab`.
  - While dragging, a protractor arc appears around the branch point, from 0° to θ, at 40px radius. It is 1px `--cut` at 50% with degree ticks every 15° (major ticks every 45° with labels in `--t-micro`).
  - Snap is 15° with Shift, and 1° otherwise.
- **Image of the cut edges** (right plane): 1px dashed (4,3) `--cut` at 70%. This shows where the seam lands.
- **Pole** (planes): a 9px "×" in 1.75px `--pole` over a 4px `--halo` casing. If the order is known and greater than 1, a `--t-micro` label "2" sits at the lower right.
- **Zero** (Phase, Landscape and Sphere modes, when detected): an open circle of r = 3.5, 1.5px `--zero`, over a `--halo` casing.
- **On the phase portrait**, data colors sit underneath. Poles and zeros there use white (`--dc-line`) strokes with a 1px `--dc-casing`. Cuts keep `--cut` with a 3.5px white casing at 90%.
- When a step card is hovered, its cuts and poles go to full strength and other steps' singularities drop to 35%.

### 6.5 Phase portrait (domain coloring)

**Rendering.** Render entirely in a fragment shader: the step chain is compiled to GLSL complex arithmetic, so every pixel is exact and panning runs at 60fps. The JS row-by-row `ImageData` loop and its low-res pass are removed. If GLSL compilation fails for a custom formula, fall back to a worker computing 1/2-resolution tiles. The LED stays amber until that finishes.

**Styles** (strip segmented control):

1. **Perceptual** (default). Hue comes from the LUT (2.4).
   - Lightness is `L = 0.60 + 0.15·b_m + 0.05·b_a`, where `b_m = fract(ln|w| / (π/6))` and `b_a = fract(arg w / (π/6))`.
   - **Contours** (toggle, default on):
     - Modulus lines where ln|w| = kπ/6 darken L by 0.22 over 1 device px.
     - Phase lines where arg w = kπ/6 lighten L by 0.10 over 0.8 device px.
   - **Why π/6:** spacing modulus contours at the ratio e^{π/6} ≈ 1.688, with 12 phase rays, makes the contour cells conformally square wherever F′ ≠ 0. The portrait becomes a curvilinear square grid, which is the defining feature of a conformal map. The current doubling bands (ratio 2) give rectangles.
   - **The |w| = 1 contour** is drawn 1.5 device px in `#0B1114` at 60%.
2. **Vivid.** The classic HSV of Wegert's enhanced portraits: hue = arg/2π, S 0.85, and V = 0.62 + 0.30·b_m with the same contours. Offered because many textbooks use it.
3. **Phase only.** The LUT at L 0.74, C 0.12, with no modulus information. Phase rays stay optional.
4. **Modulus.** Black at 0 to white at ∞: `L = 0.06 + 0.88·(2/π)·atan|w|`, `C = 0.13·sin(πL)`, with hue from the wheel. This is today's "Classic" with a perceptual hue.

**Overlays on the portrait**

- Major grid lines in `--dc-line` at `--dc-line-a`.
- Axes in `--dc-line` at `--dc-axis-a`, over a 1px `--dc-casing` at 40%.
- **Region outlines** (toggle): a 3px `#FFFFFF` stroke at 95%, then 1.3px `#0B1114` at 90%.
- Detected zeros and poles (6.4).
- The probe crosshair in `#FFFFFF` with a dark casing.
- NaN pixels are `#7F7F7F`, infinities `#F5F5F5`.

**Legend chip** (top-right, 76 × 96).

- **Wheel.** A 56px annulus (outer r 26, inner r 16) rendered from the same LUT at L 0.74, with 1px `--line-strong` rings.
- **Ticks.** Outer 3px ticks at 0, π/2, π and −π/2, labeled in STIX 10: `0`, `π/2`, `π`, `−π/2`. The center reads "arg" in STIX italic 11 and `--muted`.
- **Modulus note.** Below the wheel, a 64 × 8 strip shows three modulus bands with contour lines, labeled in `--t-caption`: "|w| steps ×e^{π/6}".
- **Click** collapses the chip to a 20px wheel.

### 6.6 Landscape (3D modulus surface)

The goal is a convincing physical object: a lit relief with a draped conformal grid, standing on graph paper, in the tradition of Jahnke–Emde's 1909 relief of Γ and the plaster models in mathematics departments.

**Geometry**

- **Domain.** The left view box, normalized so the longer side spans [−1, 1].
- **Height.** Use soft clipping, never a hard clip, so poles become smooth spires and zeros become funnels; today's hard clip makes flat plateaus.
  - log mode (default): `h = 0.6·tanh(ln|F| / 2.5)`.
  - |F| mode: `h = 1.2·tanh(|F| / M) − 0.05`, where M = 2 × the median |F| over the grid.
- **Grid.** 320² by default, 512² at "Fine". Compute heights once per chain or view change, on the GPU (render to a float texture with the compiled chain) or in a worker. Orbiting never recomputes them.
- **Normals** from central differences on the height texture.
- **Discontinuities.** Drop quads where max |Δh| > 0.35, or where arg F jumps by more than π/2 across a cut. Draw the exposed edges along a branch cut as a 2px `--cut` line on the surface.

**Material and lighting.** Do all lighting in linear light: convert albedo from sRGB to linear, light it, then encode back to sRGB. Lighting in sRGB space is the main reason the current surface looks flat.

- **Albedo**
  - **Phase** (default): the LUT at L 0.72, C 0.12 for arg F.
  - **Plaster:** `--plaster`.
- **Key light.** Azimuth 135°, elevation 52°, intensity 0.80, white, Lambert.
- **Fill light.** Azimuth −45°, elevation 20°, intensity 0.18.
- **Hemisphere ambient.** Sky (up) 0.32, ground 0.12.
- **Specular** (Blinn-Phong): exponent 56 and strength 0.22 for Phase; exponent 12 and strength 0.06 for Plaster. This gives satin ceramic versus matte plaster.
- **Rim.** `0.10·(1 − max(0, n·v))³`.
- **Back faces.** Seen at low pitch, they are lit with the flipped normal at 0.6 strength.
- **Depth cue.** Mix toward the background color by `0.12·smoothstep(near, far, viewDepth)`.

**Contour lines on the surface** (fragment shader, antialiased with fwidth)

- **Modulus lines**, where ln|F| = kπ/6. These are also the level lines of the height.
  - Phase material: 1.0 device px in `--land-mod-line` at 45%.
  - Plaster material: 1.0 device px at 70%.
- **Phase lines**, where arg F = kπ/6.
  - Phase material: 0.8px in `--land-arg-line` at 35%.
  - Plaster material: 0.8px in `--land-mod-line` at 30%.
- **Unit level** |F| = 1: 1.75px in `--accent`.

Together these form the same conformal square grid as the portrait, draped over the relief.

**Floor**

- **Plane.** A plane at `z = −0.66`, extending 15% beyond the domain, in `--land-floor` with the graph-paper tiers from 6.1, computed in the shader.
- **Edge fade.** Grid alpha fades to 0 over the outer 15%.
- **Region outlines.** The source region boundaries (in *z*) are projected onto the floor in their stroke colors at 1.5px.
- **Soft shadow.** From the key light, using a 1024² shadow map with a 5-tap PCF, at `--land-shadow` and `--land-shadow-a`. A cheaper acceptable version renders the surface footprint from above into a 256² texture, blurs it twice, and samples it on the floor offset by `light.xy·(h − floor)`.
- **Unit-level plane** (toggle, default on): the plane z = 0 (|F| = 1 in log mode) as a 5% `--accent` fill with a 1px edge at 35%. Its intersection with the surface is the accent contour.

**Axes box.**

- **Lines.** The floor rectangle and one vertical edge (the back corner farthest from the camera, chosen per frame) are drawn in 1px `--land-box`.
- **Ticks.** They are drawn on the two front floor edges, chosen per frame. They are labeled in `--t-micro` and `--axis-label` on a 2D overlay canvas, using projected positions.
- **Axis names.** "Re *z*", "Im *z*" and "|*F*|" in STIX italic 12.
- **Height ticks.** The vertical edge carries ticks at |F| = 0.1, 1 and 10, placed through the tanh mapping.

**Background.** A vertical gradient from `--land-top` to `--land-bottom`, plus a 6% radial vignette at the corners.

**Camera**

- **Projection.** Perspective with a 28° vertical FOV. A telephoto lens reduces distortion and reads as a product photograph. Today's FOV is 43°.
- **Default pose.** Yaw −38°, pitch 30°. Distance is auto-fit to the bounding sphere: `r / sin(fov/2) × 1.05`.
- **Orbit.** Left-drag at 0.4°/px, with pitch clamped to [8°, 85°].
- **Zoom and pan.** The wheel zooms ×1.1 per notch, clamped to [0.4, 4] × the fit distance. Shift-drag or right-drag pans in the screen plane.
- **Inertia.** On release, velocity decays by ×0.90 per frame.
- **Reset.** Double-click resets with a 400ms ease.
- **Top view.** A strip button gives pitch 89° for comparing with the phase portrait.
- **Antialiasing.** Render to the pane's own WebGL2 context with `antialias: true` (MSAA) at up to 2× DPR.

**Probe.** Hovering the left plane draws a 6px ring on the surface at (z, h(z)) and a 1px dashed (3,3) drop line in `--probe` at 60% down to the floor.

**Legend chip.**

- An axis gizmo, 44 × 44: three 14px axes in `--axis` labeled Re, Im and |F|, rotating with the camera.
- The text "height log|F|, soft-clipped" in `--t-caption`.

### 6.7 Riemann sphere

- **Mesh.** A unit sphere as an icosphere at subdivision 6. Coloring is evaluated per pixel: the interpolated position is normalized and stereographic coordinates are computed in the fragment shader, `w = (x + iy)/(1 − z)`, with the north pole at ∞.
- **Paint**
  - **Region image** (default): the image regions are drawn on the *w*-sphere. Transform image-mesh vertices by inverse stereographic projection and draw them with polygon offset over the base sphere, using the same patterns and boundaries as the plane. Unbounded images now close up at ∞, and Möbius maps visibly send circles to circles.
  - **Phase of F:** the *z*-sphere colored by the phase portrait of F (6.5, Perceptual).
- **Base material.** `--plane` albedo; the unpainted sphere is graph paper. Specular strength 0.18 with exponent 40, Fresnel rim `0.12·(1 − n·v)³`, and the same key, fill and ambient lights as the landscape.
- **Graticule.**
  - Meridians every 30° (arg w = kπ/6).
  - Parallels at |w| = 1/4, 1/2, 2 and 4, at latitude `asin((|w|² − 1)/(|w|² + 1))`. These are 1 device px in `--grid-major`.
  - The equator (|w| = 1) is 1.5px in `--axis`. The real-axis great circle is 1.25px in `--axis` at 70%.
- **Labels.** "0" at the south pole and "∞" at the north pole; "1", "*i*", "−1" and "−*i*" on the equator. They use STIX Two Text italic 13 in `--axis-label` with a `--halo` casing, and fade with `smoothstep(0.05, 0.3, n·v)`, so only the front hemisphere is labeled.
- **Silhouette.** 1.25px `--axis` at 50% (back-face extrusion or screen-space edge).
- **Contact shadow.** A soft elliptical radial gradient below the sphere at 18% `--land-shadow`, which makes it read as an object in space.
- **Plane** (toggle, default off): the equatorial disc of radius 2.5 at 14% opacity with graph-paper tiers.
- **Probe** (with Plane on): a 1px `--accent` line from N through the sphere point to the plane point. This is the projection drawn literally.
- **Background and camera.** Same as the landscape. Trackball rotation has inertia. Reset puts ∞ at the top with the view 20° above the equator.

### 6.8 Morph (homotopy)

- **Transport bar.** Replaces the mode strip. It spans the bottom of the plot from 8px on the left to 48px from the right, clearing the view stack. Level 2, 36px tall. Contents:
  1. A play/pause icon button, 28px.
  2. The scrubber, flex-width.
  3. A `t` readout: B612 Mono 11.5, `t = 1.37 / 2`.
  4. A homotopy select, compact ghost style: "Natural path" or "Straight line".
- **Scrubber.**
  - Track: 2px `--line-strong`, filled in `--accent` up to t.
  - Step boundaries: integer ticks 8px tall, 1px `--ink-2`.
  - Labels: step labels *f*₁, *f*₂ in STIX italic 11, centered in their segments, below the track.
  - Thumb: a fader cap.
  - Magnetic snap to integers within 0.03.
- **Ghost outlines.** The start outline at t = 0 is a 1px dashed (4,3) `--faint` line. The end outline at t = m is a 1px dotted (1,2) `--faint` line. Viewers always see where the shape came from and where it is going.
- **Playback.**
  - 1.6s per step with ease-in-out-sine inside each step, and a 0.5s hold at each integer t.
  - At the end: a 1.0s hold, then loop. A Loop toggle sits in the select menu.
  - Under reduced motion there is no autoplay loop and Play runs once.
- **Mesh.** The morph renders at the interactive mesh and refines on pause.

### 6.9 Thumbnails

Thumbnails are blank in all three screenshots. They must never be blank.

- **Rendering.** The same renderer draws them into a shared offscreen target at 240 × 88 CSS px and DPR ≤ 2. The result is cached as an `ImageBitmap` per stage and chain signature. It is regenerated only on chain or shape changes, never while panning.
- **Fit.** A robust bounding box of the stage image with a 10% margin.
- **Contents.** Graph-paper tiers without labels, patterns at the current setting, 1px boundaries without casing, and cuts at 1.25px without hatches.
- **Label.** The stage variable is drawn top-left.
- **Before the stage is ready,** show the graph paper and the source outline mapped at a draft mesh of 40.

### 6.10 Rendering budget: design decisions that keep it fast

The "laggy, slow" verdict is a design problem as much as an engineering one. These rules come with the visual spec:

- **Frame targets.**
  - Pan and zoom in any mode: 60fps, frame time ≤ 16ms on integrated GPUs.
  - Parameter scrubbing: ≥ 30fps using the interactive mesh (120).
  - Full refinement within 300ms of the last input.
- **One canvas per plane.** Each plane is its own WebGL2 canvas rendering directly. Today the code renders into one shared offscreen WebGL canvas and `drawImage`s it into a 2D canvas every frame, which forces a GPU readback.
  - Text, handles and markers go on a sibling 2D overlay canvas.
  - The overlay redraws only when the view, the probe or the selection changes.
- **View transform in the vertex shader.** World positions are uploaded once per mesh change, relative to a per-mesh origin for float32 precision. The view is a uniform, so panning uploads nothing; today every frame rebuilds clip-space arrays in JS.
- **Grid and portrait on the GPU.** Grids are drawn in shaders. Phase portrait, landscape heights and sphere coloring are evaluated on the GPU from the compiled chain.
- **Mesh work in a Web Worker.** Building, mapping and refining meshes happens in a worker, which transfers `Float32Array`s. The UI thread never blocks for more than 4ms.
- **DOM over canvases.** No `backdrop-filter`, no animated shadows, and `contain: strict` on pane bodies. Pointermove handlers are coalesced to one per rAF and only update text nodes.
- **Visible progress.** The LED and the 2px progress hairline make refinement visible, so a 200ms refine reads as "measuring", not as lag.

---

## 7. Motion and micro-interactions

**Tokens.**

- Durations: `--t-fast: 80ms`, `--t-med: 160ms`, `--t-slow: 240ms`, `--t-view: 220ms`.
- Easing: `--ease-out: cubic-bezier(0.2, 0, 0, 1)` and `--ease-std: cubic-bezier(0.3, 0, 0.2, 1)`.

The instrument is calm. There are no entrance animations, staggered reveals or animated hover lifts. Motion appears only in answer to an action, and only to show what changed.

| Interaction | Motion |
|---|---|
| Hover on any control | Color, background and border transition at `--t-fast`. Nothing moves. |
| Fit, Reset view, example load | The view tweens over `--t-view` with `--ease-out`, interpolating the center linearly and the scale in log space, so zooms feel even. |
| Theme change | Instant. Canvases re-render on the next frame. No crossfade. |
| Popover, menu, palette open | Opacity 0→1 plus a 4px translate from the anchor side, `--t-med` `--ease-out`. Close at `--t-fast`. |
| Drawer open | Slides in from its edge over `--t-med`. The rail chevron rotates 180° in sync. |
| Step card reorder | The dragged card lifts to level 3 with a 2° max tilt. Other cards slide into place over `--t-med`. A 2px `--accent` insertion bar marks the slot. |
| Add step | The new card appears in place at full size, the chain scrolls it into view (smooth), and its border runs `--accent` for 600ms before settling to focused. |
| Guarantee lamp changes | Its row flashes `--accent-soft` for 600ms. The lamp switches instantly, the way an indicator does. |
| Status LED while computing | Opacity pulse 1→0.35 over 1.2s, infinite, only while refining. |
| Scrubbing a parameter | Live draft render. On release, a 1px `--accent` progress hairline runs until refinement lands. |
| Cut drag | The protractor fades in over 80ms. The angle chip updates live. A snap gives a 1px tick highlight at the snapped degree. |
| Readout copy | Chip text swaps to "Copied" for 900ms. |
| Landscape and sphere orbit | Inertia decays ×0.90 per frame. Reset is a 400ms `--ease-std` tween. |
| Morph | See 6.8. |

**Linked highlighting**, which ties the instrument together:

- Hovering a shape row emphasizes that shape on both planes.
- Hovering a step card emphasizes its singularities.
- Hovering a matrix column lights the matching guarantee row.
- Hovering a matrix row outlines its card.
- Hovering either plane shows the probe in both.

**Keyboard.**

- Tool letters from 5.2.
- `+` adds a function; `1`–`5` switch the right-pane modes; `Z` fits both planes.
- `[` and `]` toggle the panels; `?` opens the guide.
- `Esc` cancels a draft or closes a popover; `Delete` removes the selected shape or focused step.
- ⌘Z and ⇧⌘Z undo and redo; Enter closes a polygon.

**Reduced motion** (`prefers-reduced-motion: reduce`):

- View tweens jump.
- The LED is steady.
- Morph does not autoplay or loop.
- Drawers appear without sliding.
- Inertia is off.

**Cursors.**

- `crosshair` with drawing tools.
- `grab` and `grabbing` for pan and orbit.
- `move` over shapes.
- `ew-resize` on scrubbable labels.
- `pointer` on the cut handle, which switches to `grabbing` during a drag.

---

## 8. The ten changes that matter most, by impact

1. **The image shows the whole image.**
   - Before: the right plane showed only the part of F(R) whose preimage was inside the left viewport, which was the user's explicit complaint.
   - After: meshes are built on the region, not the viewport. Unbounded regions are truncated at an adaptive radius with honest dotted, fading truncation edges. A field-of-view outline shows where the left view lands. (6.2)
2. **Speed is part of the design.** Each plane gets its own WebGL canvas with the transform in the shader and no per-frame readback. The phase portrait and landscape are computed on the GPU, mesh work moves to a worker, and there is no backdrop blur. A status LED and progress hairline make refinement read as measurement, not lag. (6.10)
3. **Planes become calibrated plates.**
   - Grid: non-photo-blue graph paper with three tiers that fade continuously with zoom, 1-device-px rulings and graphite axes.
   - Readout: an oscilloscope-style "0.5 / div" scale.
   - Rulers: 18px graduated rulers carry the labels, so labels never collide with fills, and cursor markers appear on both rulers.
   - Typography: real minus signs and tabular numerals.
   - This replaces the faint, label-cluttered grid in all three screenshots. (5.8, 6.1)
4. **The 3D view becomes a physical landscape.**
   - Shape: soft-clipped log|F| relief.
   - Color and lines: phase albedo with draped conformal contour lines, plus an accent |F| = 1 contour and translucent unit-level plane.
   - Lighting: in linear space, with key, fill, hemisphere, rim and satin specular.
   - Setting: a graph-paper floor with soft shadows, a labeled axis box, a 28° telephoto camera with inertia, MSAA, and a Plaster material in the Jahnke–Emde tradition.
   - Today the surface is a flat-lit, hard-clipped mesh with holes, floating in a void. (6.6)
5. **Better patterns.**
   - Eight carried patterns: checker aligned to the domain's labeled grid, conformal log-polar checker, Cartesian and polar meshes, stripes, phase of z, an F-glyph lattice that reveals rotation, scale and orientation, and solid.
   - Fill opacity rises to 0.85.
   - Boundaries are cased: a halo plus a stroke shade with ≥ 5:1 contrast, so they read over any pattern.
   - The shape palette is a matched-lightness OKLCH set with no red. (2.3, 6.2)
6. **A conformally honest phase portrait.**
   - A perceptual OKLCH wheel replaces HSV ridges.
   - Contours are spaced at e^{π/6} with 12 phase rays, so the portrait forms a square grid wherever F′ ≠ 0, with a highlighted |w| = 1 contour.
   - Zero and pole markers, plus a wheel legend.
   - Exact GPU rendering at 60fps replaces the blurry progressive JS raster. (6.5)
7. **Red means singular, and singularities are drawn like engineering.** Branch cuts are hatched on their closed side, branch points are drawn as rings, and the draggable cut handle carries a protractor and an angle chip (no "(drag)" label). The images of cut edges are dashed in the image plane. Poles are drawn as cased crosses. No region shape is ever red. (2.1, 6.4)
8. **Step cards become a precise, fixed anatomy.**
   - Layout: a 240 × 216 card with a thumbnail that always renders.
   - Inputs: complex inputs with an Argand glyph, a pad and scrubbable labels. The Möbius coefficients appear as a 2 × 2 matrix.
   - Actions and properties: the actions are consolidated into ⋯ and the property strip is an indicator row.
   - Chain: connectors are labeled with the plane variables *z* → *w*₁ → *w*₂, and a compact mode returns 156px to the planes.
   - Palette: the add-function command palette gains search and formula entry. (5.9, 5.10)
9. **Properties become an instrument panel.** Eight lamps sit in fixed order instead of green boxes and reshuffling "not guaranteed" pills. The matrix uses filled and hollow squares instead of ✓/·, with linked column and row hover. Collapsed, the panel still shows its lamps on the rail. (5.11, 5.13)
10. **The chrome is rebuilt from tokens.**
    - Type: Archivo with its width axis, B612 Mono for measured numbers, STIX for variables.
    - Headings: sentence case, with no tracked ALL-CAPS labels.
    - Shape: 2–6px radii by hierarchy, borders instead of shadows, and shadows only on floating elements.
    - Selection and icons: ink "lit keys" for modes, petrol outlines for selected objects, and one CAD-grip icon set with no glyph icons.
    - Header: a Poincaré-disk dial mark.
    - Planes: pane footers are removed in favor of overlay readouts, legends and view stacks.
    - Phone: a single-plane layout with bottom sheets and no horizontal page scroll. (3, 4, 5)
