# Complex Map Workbench: final design spec ("Calibrated bench")

The build spec for the redesign. Every value here is final. If a value is missing, use the nearest token; do not invent new colors. Hex values and contrast ratios were checked with a script (WCAG 2.x; OKLCH→sRGB with gamut clamping).

## 0. Decision

| Direction | Fit to complex analysis | Premium feel | Clarity for heavy use | Feasibility (CSS + WebGL) | Avoids generic AI looks | Mean |
|---|---|---|---|---|---|---|
| **Calibrated bench** (instrument) | 9 | 8 | 9 | 8 | 9 | **8.6** |
| Living plates | 9 | 8 | 7 | 8 | 6 | 7.6 |
| Studio | 8 | 7 | 9 | 7 | 6 | 7.4 |

**Base: Calibrated bench.** It is the most specific to the subject: plates with graduated rulers, a derivative gauge that draws the image of a small circle, hatched branch cuts, and indicator lamps. It also handles speed as a design rule (no backdrop blur, GPU everywhere), and its palette (graphite on cool drafting film, petrol accent, red reserved for singularities) avoids every look on the banned list.
- **Plates** loses points for clarity: auto-captions cost 40px per plane, serif headings slow scanning, and the zoom controls only appear on hover. Its serif-on-paper look also drifts toward the editorial cliché.
- **Studio** loses points for originality and speed: dark graphite with a blue accent and blurred overlays is a familiar pro-tool look, and blur over WebGL costs frames.

**Grafted from Plates:** the z² brand mark (a square grid carried by a conformal map, which is what the app does), orientation chevrons, the landscape as a solid block with skirt walls and a printed floor, the palette's live preview column, and the anti-moiré fade.
**Grafted from Studio:** dashed boundaries for open sets, morph point trails, the live legend needle, draggable gutters, Insert (+) on connectors, a ⌘K palette for everything, a tool rail that stays usable when collapsed, ambient occlusion and contact shading in 3D, pointer-lock scrubbers, and the angle-dial input.

---

## 1. Concept and rules

The Workbench is a calibrated optical bench for complex maps. Two measured plates, domain and image, sit side by side like the input and output stages of an instrument. Hovering either plate takes a measurement.

1. **Only data is saturated.** Chrome is graphite with a slight cyan cast. Saturated hue appears only in region fills, curves, phase portraits and the landscape.
2. **Red means the map breaks here.** `--cut` (vermilion) and `--pole` (crimson) are used only for branch cuts, branch points, poles and evaluation errors. No shape color is red.
3. **Modes are ink; objects are accent.** A pressed mode (active tool, selected tab or segment) is a lit key: `--inverse` background. A selected object (shape, focused card, focused input) gets a petrol `--accent` outline. The two treatments are never swapped.
4. **Graph paper is non-photo blue.** Grids use drafting blue in three tiers. Axes are graphite ink.
5. **Green means only "guaranteed".** `--good` marks properties that are proved for the chain, nothing else.
6. **Every ornament has a mathematical referent:** contour, seam, pole, tile or meridian. If it can't be named in complex-analysis terms, it is cut.

---

## 2. Tokens (paste verbatim)

The canvas reads every color with `getComputedStyle` in `readTheme()`. All canvas colors are 6-digit hex; their opacities are separate unitless tokens. Theme switch: the header button cycles Auto → Light → Dark. It sets `data-theme="light"` or `"dark"` on `<html>` (Auto removes the attribute), then calls `readTheme()` and marks every pane dirty.

```css
:root {
  color-scheme: light;
  /* surfaces */
  --bg: #E3E8EA; --panel: #F1F4F5; --surface: #FFFFFF; --surface-2: #F7F9FA; --well: #E9EEF0;
  --overlay: #FFFFFFEB; --inverse: #121A20; --inverse-ink: #FFFFFF;
  /* text: ink 15.9:1, ink-2 8.0:1, muted 5.5:1 on panel; faint 2.7:1 is disabled/decorative only */
  --ink: #121A20; --ink-2: #3E4C56; --muted: #56646E; --faint: #8A969E;
  --line: #D2DADE; --line-strong: #B3BEC4;
  /* accent: petrol, 5.6:1 on panel; white on it 6.1:1 */
  --accent: #0A6A87; --accent-hover: #075A73; --accent-soft: #DDEFF4; --accent-ink: #FFFFFF;
  --good: #1B7A47; --good-soft: #DFF1E6; --warn: #8F5408; --warn-soft: #FAEDD7; --error: #B4231A; --error-soft: #FBE5E2;
  /* plane */
  --plane: #FCFDFD; --grid-minor: #E2EEF2; --grid-medium: #D3E6ED; --grid-major: #B5D4E0;
  --axis: #2E3D47; --axis-label: #4A606C; --ruler-tick: #3E4C56;
  --cut: #CC3311; --pole: #A0153E; --zero: #121A20; --probe: #121A20; --halo: #FCFDFD; --fov: #2E3D47;
  --dc-line: #FFFFFF; --dc-casing: #0B1114;
  /* landscape and sphere */
  --land-top: #F5F8F9; --land-bottom: #DCE4E7; --land-floor: #FAFCFC; --land-box: #B3BEC4;
  --land-mod-line: #18232A; --land-arg-line: #FFFFFF; --plaster: #ECEEEC; --land-shadow: #2E3D47;
  --hemi-sky: #E6EEF4; --hemi-ground: #8C9296;
  /* shape inks (theme-independent base) and theme-dependent edge/alt shades */
  --c1: #3B6FD4; --c2: #CD821A; --c3: #12938F; --c4: #BC4E98; --c5: #31983D; --c6: #7F56C4; --c7: #888D22; --c8: #607183;
  --c1-edge: #093B9B; --c2-edge: #8A560B; --c3-edge: #0A5C5A; --c4-edge: #831466;
  --c5-edge: #086119; --c6-edge: #50218C; --c7-edge: #575A08; --c8-edge: #324152;
  --c1-alt: #8CABE5; --c2-alt: #F0C598; --c3-alt: #8EC3C0; --c4-alt: #DD9DC5;
  --c5-alt: #94C795; --c6-alt: #AE9CDA; --c7-alt: #BEC390; --c8-alt: #9CA6B1;
  --stretch-shrink: #2E69B2; --stretch-grow: #D79628; --stretch-mid: #E9F0F2;
  /* canvas opacities (unitless) */
  --halo-a: 0.85; --fov-a: 0.55; --cursor-a: 0.35; --dc-line-a: 0.22; --dc-axis-a: 0.70; --land-shadow-a: 0.30;
  /* elevation */
  --shadow-1: 0 1px 2px #121A201A;
  --shadow-3: 0 10px 28px #121A2029, 0 2px 6px #121A2014;
  --scrim: #121A205C;
  /* type */
  --f-ui: "Archivo", "Helvetica Neue", Arial, system-ui, sans-serif;
  --f-mono: "B612 Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  --f-math: "STIX Two Text", "STIX Two Math", "Cambria Math", "Times New Roman", serif;
  --t-micro: 400 10px/12px var(--f-mono);
  --t-caption: semi-condensed 600 11px/14px var(--f-ui);
  --t-label: 500 12px/16px var(--f-ui);
  --t-body: 400 13px/18px var(--f-ui);
  --t-heading: 600 13px/18px var(--f-ui);
  --t-readout: 400 11.5px/16px var(--f-mono);
  --t-math-s: italic 500 13px/18px var(--f-math);
  --t-math: italic 500 15px/20px var(--f-math);
  --t-wordmark: semi-expanded 640 14.5px/20px var(--f-ui);
  --t-title: 600 19px/24px var(--f-ui);
  /* spacing, radii, control heights */
  --s-1: 2px; --s-2: 4px; --s-3: 6px; --s-4: 8px; --s-5: 12px; --s-6: 16px; --s-7: 20px; --s-8: 24px; --s-9: 32px;
  --r-1: 2px; --r-2: 3px; --r-3: 4px; --r-4: 6px;
  --h-xs: 20px; --h-sm: 24px; --h-md: 28px; --h-lg: 32px; --h-xl: 44px;
  /* motion */
  --t-fast: 80ms; --t-med: 160ms; --t-slow: 240ms; --t-view: 220ms; --t-hom: 480ms;
  --ease-out: cubic-bezier(0.2, 0, 0, 1); --ease-std: cubic-bezier(0.3, 0, 0.2, 1); --ease-inout: cubic-bezier(0.65, 0, 0.35, 1);
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    color-scheme: dark;
    --bg: #12191E; --panel: #172026; --surface: #1D282F; --surface-2: #23303A; --well: #121A1F;
    --overlay: #1D282FEB; --inverse: #E3EAEE; --inverse-ink: #12191E;
    --ink: #E3EAEE; --ink-2: #B4C1C9; --muted: #91A1AB; --faint: #5E6E78; --line: #26333B; --line-strong: #36474F;
    --accent: #52B7D3; --accent-hover: #78C9E0; --accent-soft: #12313B; --accent-ink: #061216;
    --good: #4BC28A; --good-soft: #112A1F; --warn: #E3A23E; --warn-soft: #2D2211; --error: #FF7262; --error-soft: #35181A;
    --plane: #0D1317; --grid-minor: #14212A; --grid-medium: #1A2D38; --grid-major: #21404F;
    --axis: #94A8B3; --axis-label: #8197A3; --ruler-tick: #B4C1C9;
    --cut: #FF6B3D; --pole: #FF5A85; --zero: #E3EAEE; --probe: #E3EAEE; --halo: #0D1317; --fov: #94A8B3;
    --dc-line: #FFFFFF; --dc-casing: #05090B;
    --land-top: #1A252C; --land-bottom: #0A1013; --land-floor: #10181D; --land-box: #36474F;
    --land-mod-line: #05090B; --land-arg-line: #FFFFFF; --plaster: #C9CFD2; --land-shadow: #000000;
    --hemi-sky: #9FB2C0; --hemi-ground: #3A3F44;
    --c1-edge: #79A7FA; --c2-edge: #FBBD78; --c3-edge: #74C5C1; --c4-edge: #EA8EC9;
    --c5-edge: #7ECA80; --c6-edge: #AF91EC; --c7-edge: #BCC174; --c8-edge: #95A3B3;
    --c1-alt: #1F4591; --c2-alt: #925B0A; --c3-alt: #096260; --c4-alt: #802E67;
    --c5-alt: #166721; --c6-alt: #523284; --c7-alt: #5D600A; --c8-alt: #3A4654;
    --stretch-mid: #2D3436;
    --halo-a: 0.85; --fov-a: 0.60; --cursor-a: 0.40; --dc-line-a: 0.22; --dc-axis-a: 0.70; --land-shadow-a: 0.55;
    --shadow-1: 0 1px 2px #00000066; --shadow-3: 0 12px 32px #00000080, 0 2px 6px #00000059; --scrim: #0000008C;
  }
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #12191E; --panel: #172026; --surface: #1D282F; --surface-2: #23303A; --well: #121A1F;
  --overlay: #1D282FEB; --inverse: #E3EAEE; --inverse-ink: #12191E;
  --ink: #E3EAEE; --ink-2: #B4C1C9; --muted: #91A1AB; --faint: #5E6E78; --line: #26333B; --line-strong: #36474F;
  --accent: #52B7D3; --accent-hover: #78C9E0; --accent-soft: #12313B; --accent-ink: #061216;
  --good: #4BC28A; --good-soft: #112A1F; --warn: #E3A23E; --warn-soft: #2D2211; --error: #FF7262; --error-soft: #35181A;
  --plane: #0D1317; --grid-minor: #14212A; --grid-medium: #1A2D38; --grid-major: #21404F;
  --axis: #94A8B3; --axis-label: #8197A3; --ruler-tick: #B4C1C9;
  --cut: #FF6B3D; --pole: #FF5A85; --zero: #E3EAEE; --probe: #E3EAEE; --halo: #0D1317; --fov: #94A8B3;
  --dc-line: #FFFFFF; --dc-casing: #05090B;
  --land-top: #1A252C; --land-bottom: #0A1013; --land-floor: #10181D; --land-box: #36474F;
  --land-mod-line: #05090B; --land-arg-line: #FFFFFF; --plaster: #C9CFD2; --land-shadow: #000000;
  --hemi-sky: #9FB2C0; --hemi-ground: #3A3F44;
  --c1-edge: #79A7FA; --c2-edge: #FBBD78; --c3-edge: #74C5C1; --c4-edge: #EA8EC9;
  --c5-edge: #7ECA80; --c6-edge: #AF91EC; --c7-edge: #BCC174; --c8-edge: #95A3B3;
  --c1-alt: #1F4591; --c2-alt: #925B0A; --c3-alt: #096260; --c4-alt: #802E67;
  --c5-alt: #166721; --c6-alt: #523284; --c7-alt: #5D600A; --c8-alt: #3A4654;
  --stretch-mid: #2D3436;
  --halo-a: 0.85; --fov-a: 0.60; --cursor-a: 0.40; --dc-line-a: 0.22; --dc-axis-a: 0.70; --land-shadow-a: 0.55;
  --shadow-1: 0 1px 2px #00000066; --shadow-3: 0 12px 32px #00000080, 0 2px 6px #00000059; --scrim: #0000008C;
}
html, body { height: 100%; }
body { margin: 0; background: var(--bg); color: var(--ink); font: var(--t-body); font-variant-numeric: tabular-nums lining-nums; }
:root[data-theme="dark"] body { -webkit-font-smoothing: antialiased; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) body { -webkit-font-smoothing: antialiased; } }
* { box-sizing: border-box; scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
```

**Measured contrast.** Light, on panel: ink 15.9, muted 5.5, accent 5.6, good 4.8, error 5.9; on plane: axis-label 6.5, cut 5.1, pole 7.7. Dark, on panel: ink 13.6, muted 6.2, accent 7.1, good 7.4, error 6.2; on plane: axis-label 6.1, cut 6.6, pole 6.3. The dark theme is blue-slate (hue about 205°), not near-black, and the plane is its darkest surface so fills glow out of it.

**`readTheme()` changes.** Read `--axis-label` (not `--label`) and `--error` (not `--err`). Drop `--axis-solid`, since `--axis` is now opaque. Read `--c1…8`, `--cN-edge` and `--cN-alt` and delete the hard-coded `PALETTE`. Read alpha tokens with `parseFloat`.

**Shape palette.**
- Shapes store a palette index `ci` (0–7) or a custom hex. Presets are assigned in order c1…c8, alternating cool and warm.
- Base colors sit at OKLCH L 0.54–0.67 and are ≥ 3:1 against both planes. Edge colors are 6–11:1 on their plane. Base against alt is about 2:1 in both themes.
- Custom colors derive their shades in OKLCH, with chroma clamped to 97% of the sRGB gamut:

| Shade | Light theme | Dark theme |
|---|---|---|
| edge | (L − 0.17, C) | (L + 0.17, 0.8C) |
| alt | (L + 0.18, 0.55C) | (L − 0.15, 0.8C) |

---

## 3. Typography

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..125,400..700&family=B612+Mono:wght@400;700&family=STIX+Two+Text:ital,wght@0,400..700;1,400..700&display=swap">
```

| Family | Single job |
|---|---|
| **Archivo** (variable width 75–125, weight 400–700) | All UI words. Dense labels use `semi-condensed` (87.5% width) instead of a smaller size, like an engraved panel. The wordmark uses `semi-expanded`. |
| **B612 Mono** (400/700; designed for Airbus cockpit displays) | Measured numbers only: readouts, numeric and complex inputs, ruler labels, *t* and θ chips, matrix qualifiers. It is also used for typed LaTeX source in formula fields. Word labels never use it. |
| **STIX Two Text** (italic 500) | Math variables in chrome and on canvas: *z*-plane, *w*₁, *p*′, *a b c d α φ n θ*, sphere labels. It matches the glyphs MathJax typesets. |

| Token | Spec | Use |
|---|---|---|
| `--t-micro` | B612 Mono 10/12 | Ruler and 3D tick labels |
| `--t-caption` | Archivo 600 11/14 semi-condensed | Property strip, matrix heads, slider ticks, kbd |
| `--t-label` | Archivo 500 12/16 | Field labels, buttons, segments, tool keys (semi-condensed) |
| `--t-body` | Archivo 400 13/18 | Default text, menu items, descriptions |
| `--t-heading` | Archivo 600 13/18 | Section headings, card names |
| `--t-readout` | B612 Mono 11.5/16 | Readout chips, inputs, formula source |
| `--t-math-s` / `--t-math` | STIX italic 500, 13 / 15 | Parameter names, point labels / plane titles, connector variables |
| `--t-wordmark` | Archivo 640 14.5 semi-expanded | Header only |
| `--t-title` | Archivo 600 19/24 | Modal title |

**Rules**
- **Case and casing.** Sentence case everywhere. Delete every `text-transform: uppercase` and every letter-spacing of 0.08–0.09em in the current CSS.
- **Numerals.** Use `tabular-nums` wherever a number changes.
- **Minus and spacing.** Minus is U+2212. Complex numbers are written `0.4210 − 1.2034i`, with a normal space around the operator and the *i* in STIX italic (a separate span in HTML, a separate `fillText` on canvas). Angles are written `1.82 ∠ 12.4°`.
- **Precision.** Show 4 decimals when 10⁻³ ≤ |x| < 10⁴. Outside that range show `1.23×10⁴`, with a superscript exponent, never `e`. Ruler labels use the minimum decimals the step needs. Imaginary labels read `2i`, `i`, `−i`, `−0.5i`.
- **MathJax sizes.** 15px in formula wells, 14px in the chain header, 13.5px in cards and lists, 12px in shape rows. Until MathJax loads, the fallback is STIX italic at the same size with a one-line `min-height`, so nothing jumps. Body copy is at most 68ch.

---

## 4. Layout, spacing, radii, elevation

**1440 × 900 frame.**

```
┌ header 44: [mark] Complex Map Workbench │ Examples ▾  ↶ ↷        [⌕ Add function or command ⌘K]  ◧ ◨ ◐ ? ┐
├ left 252 ┬────────────── stage (fluid ≈ 868) ───────────────────┬ right 288 ┤
│ Draw     │ ┌ z-plane  domain        ⌗ ◌ ●┐┊┌[Image|Phase|Landscape|Sphere|Morph]  w = F(z) ●┐ │ Composite │
│ keys 4×5 │ │[readout]          [legend] ││ │[readout]                      [legend]       │ │ Guarantees│
│ Formula  │ │    plot ≈ 410 × 516         ││ │         plot                                  │ │  8 lamps  │
│ Shapes   │ │[options]          [+ − ⊡ ⤢]││ │[mode options]                 [+ − ⊡ ⤢]      │ │ Domain D  │
│ Display  │ └▔▔▔▔ ruler 18 ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔┘┊└▔▔▔▔▔▔▔▔▔▔▔▔ ruler ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔┘ │ Step by   │
│          │ ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ row-resize gutter ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄ │ step      │
│          │ Function chain  F = f₂∘f₁                    [Cards|Compact] Whole chain Clear  │ matrix    │
│          │ [z Region]─z→[f₁ Exponential]─w₁→[f₂ Möbius]─w₂→[+ Add function]               │           │
└──────────┴─────────────────────────────────────────────────────────────────────────────────┴───────────┘
```

**Frame**
- `#app`: `grid-template-rows: 44px minmax(0,1fr)`. Padding is `0 max(8px, env(safe-area-inset-right)) max(8px, env(safe-area-inset-bottom)) max(8px, env(safe-area-inset-left))`.
- `.layout`: columns `252px minmax(0,1fr) 288px`, gap 8, `overflow-x: clip`. Every grid child gets `min-width: 0; min-height: 0`.
- **Stage.** Rows `minmax(0,1fr) 8px var(--chain-h, 272px)`. The 8px row is a row-resize gutter: `cursor: row-resize`, a 2px `--line-strong` center line on hover, clamped from 112px (compact) to 50% of the stage, snapping to 112 and 272 within 12px, stored per viewer in `localStorage` (inside try/catch).
- **Planes.** Columns `1fr 8px 1fr`; the middle is a col-resize gutter styled the same, and double-click resets it to 50/50. Each plane is a 32px head, the plot, and 18px rulers on the bottom and left: about 410 × 516 of plot at 1440 × 900 with both panels docked.
- **Chain** (272px): a 36px head, then the strip (padding 8 12 12) holding the 216px cards.

**Breakpoints**

| Width | Layout |
|---|---|
| ≥ 1280 | As above. |
| 1024–1279 | The right panel starts as a 36px rail. Opening it shows a 288px overlay drawer (level 3) over the stage; it closes on Esc or an outside click. The left panel stays docked at 240px. |
| 768–1023 | Both panels are rails, and only one drawer opens at a time. The left rail keeps the tool keys usable (5.13). The planes stay side by side. |
| < 768 (phone) | See below. |

**Phone (< 768): single column, 16px side gutters, no horizontal page scroll.**
- **Header** (44px): mark, "Map Workbench", Undo, Redo, and a ⋯ menu holding Examples, Theme, Guide and Panels.
- **Planes.** Stacked, each `height: min(calc(100vw - 32px), 46svh)`, so both are visible on a 390 × 844 phone. The right plane's mode control scrolls horizontally inside its own head. Rulers are 14px; overlay buttons are 32px with 44px hit areas.
- **Below the planes:** the chain as its own `overflow-x: auto` strip (`scroll-snap-type: x mandatory`, cards `min(240px, 78vw)`), then disclosures for Formula, Shapes and Display, then Guarantees, whose summary row shows the 8 lamps.
- **Bottom toolbar.** A sticky 52px bar plus `env(safe-area-inset-bottom)`, holding Select, Point, Circle, Disc, Rectangle, Polygon and More. More opens a bottom sheet (max 80svh) with all keys in 5 columns.
- **Touch.** Pinch zooms. One finger pans or draws, depending on the tool. Long-press probes.
- **Overflow.** Every wide strip (chain, segmented rows, matrix, formula wells) scrolls inside its own box. Popovers use `width: min(<design>, 100vw - 24px)`.

**Grid rhythm.** Panel sections have 12px padding and a 1px `--line` separator. Gaps are 8px inside a group and 12px between groups. Content aligns to a 4px grid.

**Radii.**

| Token | Value | Use |
|---|---|---|
| `--r-1` | 2px | tags, swatches, lamps, kbd, matrix cells |
| `--r-2` | 3px | buttons, inputs, segmented controls, keys, overlay chips |
| `--r-3` | 4px | panels, planes, cards, shape rows |
| `--r-4` | 6px | popovers, palette, menus, modal, drawers |

Circles are used only for the LED, point markers and radio dots. There are no pills.

**Elevation.**

| Level | What | Treatment |
|---|---|---|
| 0 | App background | `--bg` |
| 1 | Panels, chain, cards, shape rows | 1px `--line` border, no shadow |
| 1-plate | Planes | 1px `--line-strong` border, no shadow. The ruler frame sets the plate apart. |
| 2 | Anything floating over a canvas | `--overlay`, 1px `--line-strong`, `--shadow-1`, `--r-2` |
| 3 | Popovers, menus, palette, drawers, toasts | `--surface`, 1px `--line-strong`, `--shadow-3`, `--r-4` |
| Modal | Guide | Level 3 over `--scrim` |

**Never:** `backdrop-filter` (it forces a recomposite over WebGL every frame), animated shadows, a colored side rail on a card, or a gradient on chrome. A dashed 1px border means one of exactly two things: an "add" affordance, or an on-canvas truncation or field-of-view line.

Z-index: overlays 10, drawers 20, popovers 30, palette 40, modal 50, toast 60, tooltip 70.

---

## 5. Components

### 5.1 Header and mark
**Header row.** 44px on `--bg`, no border, gap 8. Left to right: the mark (22px); the wordmark "Complex Map Workbench" in `--t-wordmark` (hidden below 900px); a 1×20 `--line-strong` divider; **Examples**, a ghost menu button labeled with the current example's name; Undo and Redo as 28px icon buttons; a spacer; the **command field**, a 240×28 button styled as a field (`--well`, `--r-2`, 1px `--line`) holding a 14px search icon, "Add function or command" in `--muted` and a kbd "⌘K" (or "Ctrl K"); the panel toggles ◧ ◨ (pressed = `--well` with an `--ink` icon); the theme cycle button ("Theme: Auto"); and Guide (a question mark in a circle).
Remove the static signature "w = fₙ ∘ ⋯ ∘ f₁(z)", the native example `<select>`, and the text buttons.

**Mark: the image of the unit grid under w = z².** It shows two families of confocal parabolas crossing at right angles, which is conformality in one picture. The Bézier segments are exact parabola arcs at 7.5px/unit.

```html
<svg viewBox="0 0 28 28" width="22" height="22" aria-hidden="true" class="mark">
  <defs><clipPath id="mk"><rect x="2.25" y="2.25" width="23.5" height="23.5" rx="1.25"/></clipPath></defs>
  <rect x="1.5" y="1.5" width="25" height="25" rx="2" fill="var(--plane)" stroke="var(--ink)" stroke-width="1.25"/>
  <g clip-path="url(#mk)" fill="none" stroke-width="1.15" stroke-linecap="round">
    <g stroke="var(--ink)"><path d="M6.51 25.62Q27.83 14 6.51 2.38"/><path d="M15.78 25.62Q25.76 14 15.78 2.38"/><path d="M21.67 25.62Q27.93 14 21.67 2.38"/></g>
    <g stroke="var(--accent)"><path d="M21.49 25.62Q0.17 14 21.49 2.38"/><path d="M12.22 25.62Q2.24 14 12.22 2.38"/><path d="M6.33 25.62Q0.07 14 6.33 2.38"/></g>
  </g>
  <circle cx="14" cy="14" r="1.4" fill="var(--ink)"/>
</svg>
```
The ink family is the images of vertical lines; the accent family is the images of horizontal lines. The favicon (16px) drops the outer curve of each family. The artifact's icon word is "chart".

### 5.2 Tool keys
**Grid.** 4 columns of 54×44 keys with a 4px gap. Each key has a 20px icon 6px from the top and a label in `--t-label` semi-condensed, 5px from the bottom. Rows are semantic:

| Row | Keys (shortcut) |
|---|---|
| 1 | Select (V), Point (P), Segment (S), Line (L) |
| 2 | Ray (R), Circle (C), Arc (A), Freehand (F) |
| 3 | Disc (D), Rectangle (B), Polygon (G), Lasso (O) |
| 4 | Half-plane (H), Annulus (N), Sector (K), Formula (T); Formula focuses the formula input |
| 5 | Grid, Polar grid |

**States.** Rest: transparent, `--ink-2`. Hover: `--surface` with a 1px `--line` border. Active: a lit key, `--inverse` with `--inverse-ink` icon and label. Focus: the focus ring. Tooltip: name plus kbd ("Disc  D").

**Hint line.** One line under the grid in `--t-body` `--muted`, with a reserved height of 36px. The tool name is in `--ink` 600, followed by the instruction, for example: "**Circle** Drag from the center outward. Shift snaps the radius." Delete today's 3-line paragraph.

### 5.3 Segmented controls
- **Track** 28px (24 in overlays and cards), `--well`, 1px `--line`, `--r-2`, 2px padding. **Segments** `--t-label` `--muted`, padding 0 10px; hover `--ink`. `role="radiogroup"` with arrow-key roving.
- **Selected:** `--surface` (`--surface-2` in dark), 1px `--line-strong`, `--ink`. The thumb is one absolutely positioned element that slides (transform and width over `--t-med`, `--ease-out`).
- **Right-plane modes.** Image · Phase · Landscape · Sphere · Morph. Each segment has a 14px icon (Appendix A) plus its label. Below 520px of pane width they become icon-only.

### 5.4 Buttons
| Variant | Spec |
|---|---|
| Default | 28px (24 compact), padding 0 10px, `--surface`, 1px `--line-strong`, `--r-2`, `--t-label` `--ink`. Hover: border `--ink-2`. Active: `--well`. |
| Primary | `--accent` background and border, `--accent-ink` text, weight 600. Hover: `--accent-hover`. At most one per region ("Add", "Add function"). |
| Ghost | Transparent, `--muted`. Hover: `--well` background, `--ink` text. |
| Icon | 28 (24 / 20) square, 16px icon in `--ink-2`, ghost behavior. A pressed toggle uses `--well` with an `--ink` icon. Always has `aria-label` and a tooltip. |
| Danger | Ghost style. Hover: `--error-soft` background, `--error` text. Used in menus and editors only. |
| Disabled | Opacity 0.4, `cursor: default`, no hover change. |

Labels are verbs in sentence case ("Add function", "Clear chain", "Reset camera"). Never append "→".

### 5.5 Inputs
- **Text field.** 28px (24 in cards), padding 0 8px, `--well`, 1px `--line`, `--r-2`; math text in `--t-readout`, plain text in `--t-body`. Hover: border `--line-strong`. Focus: `--surface`, border `--accent`, `box-shadow: 0 0 0 1px var(--accent)`. Invalid: border `--error` and an 11.5px `--error` message saying what to fix ("Expected a number like 1+2i or e^{iπ/4}"); in cards it is a tooltip-style bubble so the card never grows.
- **Formula field** (region formula, custom *f*, coefficients). The field with a primary "Add" joined to its right edge. Below it a **preview strip** (`--well`, min-height 28, MathJax 13.5); on a parse error it shows the message and the offending token gets a wavy `--error` underline. Below that, **example tags**: 22px, `--r-1`, 1px `--line`, typeset at 12px (never raw LaTeX), six plus "More examples".
- **Complex field** (`cx` parameters: Möbius *a b c d*, affine, *c*, *α*). Accepts any constant expression ("1+i", "e^{iπ/3}"). Unfocused it shows the formatted value; focused, the raw text, with a right-aligned `= 0.5 + 0.866i` in `--muted` when the text is an expression.
  - **Argand glyph** (16×16, inside the right edge): unit circle r 6 in 1px `--line-strong`, axes 1px `--line`, a 3px `--accent` dot at `6·c/max(|c|,1)`; for |c| > 1 the dot rides the rim as a 4px hollow square. Click opens the **Argand pad**.
  - **Focus readout:** a 16px line under the field, `|c| 2.2361  ∠ 63.43°` in B612 Mono 10.5 `--muted`.
  - **Scrub** the STIX label (`cursor: ew-resize`, `requestPointerLock()`): drag changes Re, Shift Im, Alt ×0.1; step `niceStep(max(|c|,1))/100` per px; the value turns `--accent`; release commits one undo step.
- **Argand pad** (level 3, 208px). A 192×192 mini plane in plane tokens over [−2, 2]² (or 1.5|c|), unit circle 1px dashed `--axis`, an 8px `--accent` point with a 2px `--surface` ring. Snaps to the 0.05 grid; Shift snaps to the unit circle and 15° angles. Below: scrubbers for Re, Im, |c|, arg°, applied live. Esc or outside click closes.
- **Number and angle inputs.** No native spinners; ↑/↓ ±1, Shift ×10, Alt ×0.1. Labels scrub (integers 1 per 8px, reals `10^(floor(log10(max(|v|,0.1)))−2)` per px). **Angle variant:** the label is a 14px dial glyph (circle with a 1.5px tick at the angle, counterclockwise from +Re), 1° per 2px, Shift snaps 15°. The branch-cut angle uses it.

### 5.6 Checkbox and fader
**Checkbox.** 14×14, `--r-1`, 1px `--line-strong`, on `--surface`. Checked: `--inverse` fill with a 1.75px `--inverse-ink` check polyline. The label is `--t-body`, 8px away, and the whole row is clickable.

**Fader** (native `input[type=range]`, `appearance: none`, styled in `::-webkit-` and `::-moz-` pseudo-elements). Hit area 20px; track 2px `--line-strong`, filled part 2px `--accent`. Thumb 10×16, `--r-1`, `--surface`, 1px `--ink-2` with a 1px center notch; hover `--ink`, dragging `--accent`. Named stops get 4px `--line-strong` ticks with clickable `--t-caption` `--muted` labels. Value at the right in `--t-readout`, in a 72px right-aligned box.
- **Mesh quality** is one fader with stops Draft 160 · Normal 240 · Fine 480 · Ultra 800 · Max 1280. It replaces the slider plus segmented pair. The note "Fine and above finish refining after you stop dragging." sits in `--muted`.
- **Opacity** ranges 0.20–1.00 (default **0.85**), with ticks at 0.5 and 1.

### 5.7 Shape rows
- **Row.** 34px, `--surface`, 1px `--line`, `--r-3`, 4px between rows. Grid columns `16px 1fr 24px 24px`, gap 8, padding 0 4 0 8.
- **Swatch** (14×14, `--r-1`): a miniature of the current pattern; for Checker, `repeating-conic-gradient(var(--cN) 0 25%, var(--cN-alt) 0 50%) 0 0/7px 7px` with `box-shadow: inset 0 0 0 1px var(--cN-edge)`. Curves show a 2px diagonal, points a 5px dot. Click opens the 8 presets as 20px squares plus "Custom color…".
- **Text.** The name ("Disc 1") is Archivo 12.5/500 `--ink`. It is followed on the same line by the typeset set at 12px `--muted`, with complements prefixed "not". The line is clipped by `mask-image: linear-gradient(90deg,#000 calc(100% - 16px),transparent)`, and the full text is in a tooltip.
- **Actions.** Eye / eye-off (hidden rows show the name in `--faint` and a hollow swatch), and ⋯ (Use complement, Duplicate, Bring forward, Send backward, Delete).
- **Hover.** Border `--line-strong`. That shape is emphasized on both planes: stroke +0.5px, other fills at 50%.
- **Selected.** 1px `--accent` plus `inset 0 0 0 1px var(--accent)`. The editor expands below a 1px `--line` divider in two columns (gap 6), with STIX italic labels ("center *c*", "radius *r*", *r*₁, *θ*₁) and 24px fields. Unbounded shapes note "Unbounded: drawn out to |z − c| = R".
- **Empty state.** "No shapes yet. Pick a tool or type a set such as |z − 1| < 2.", with ghost buttons "Unit disc", "Upper half-plane" and "Examples".

### 5.8 Plane chrome
```
┌ head 32 ───────────────────────────────────────────────┐
│ z-plane  domain                          [⌗][◌]  ●LED  │
├──┬─────────────────────────────────────────────────────┤
│Im│ [readout chip]                       [legend chip]  │
│ru│                plot: WebGL + 2D overlay         [+] │
│le│ [mode options strip]                       [−][⊡][⤢]│
├──┼─────────────────────────────────────────────────────┤
│ z│                  Re ruler                           │
└──┴─────────────────────────────────────────────────────┘
```
- **Head.** 32px, `--panel`, 1px `--line` bottom border, padding 0 6 0 10. Left plane: the title in `--t-math` (*z*-plane, *w*₁-plane), then the role in `--t-body` `--muted` ("domain", or "input of *f*₂" when a step is focused), and on the right two icon toggles moved from Display, Snap (magnet) and Unit circle. Right plane: the mode control first, then the right-aligned title "*w* = *F*(*z*) after 2 steps" or "*w*₂-plane, output of *f*₂" (hidden below 520px). Delete the floating `.overlay-note`; the role text replaces it.
- **LED** (6px circle at the far right, with a tooltip): `--good` current; `--warn` computing or refining, pulsing opacity 1 → 0.35 over 1.2s (steady under reduced motion); `--error` evaluation failed, with the step named ("f₂ is undefined on part of this view").
- **Rulers** (18px, `--panel`, 1px `--line` edge against the plot; two small 2D canvases redrawn only on view or probe change). Ticks: minor 3px, medium 5px, major 7px, `--ruler-tick`, 1 device px, following the 6.1 tiers, dropped when closer than 6px. Labels: `--t-micro` `--axis-label` at the 1-2-5 step with ≥ 72px (bottom) or ≥ 48px (left, rotated −90°) spacing, dropped within 12px of an end. The bottom-left corner shows the plane variable in STIX italic 12. **Cursor markers:** a 5×4 `--accent` triangle points into the plot at the probe on both rulers; the linked plane marks the probe's image.
- **Readout chip** (top-left, 8px inset, level 2, 24px tall, `--t-readout`; field names in `--muted`, values in `--ink`).

| Situation | Contents |
|---|---|
| Left plane | `z  0.4210 + 1.2034i   \|z\| 1.2749   arg 72.08°` |
| Image | `w  −0.3127 + 0.8810i   F′ 1.8203 ∠ 12.40°` |
| Phase | `w …   \|w\| …   arg 0.571π`, plus a 10px swatch of the pixel color |
| Landscape | `\|F\| 2.3100   arg 0.571π` |
| Idle | The scale, like an oscilloscope: `0.5 / div` |

  Clicking the chip copies `0.4210+1.2034i` and shows "Copied" for 900ms. Values are fixed-width, so the chip never jitters.
- **Legend chip** (top-right, level 2; content per mode in 6.4, 6.8, 6.9; click collapses it to a 20px glyph, remembered per viewer). Image mode: "cell 0.5 in *z*", plus "× pole" and "cut" samples when present.
- **View stack** (bottom-right, 8px inset). Zoom in and zoom out in a joined 28×56 group, then 4px, then Fit and Expand/Restore in a joined group. Tooltips: "Zoom in", "Fit view  Z", "Expand plane". Delete the "Fit" text buttons from the heads.
- **Mode options strip** (bottom-left, right plane only; level 2, 32px tall, 24px controls inside). On phone it collapses into a sliders icon that opens a popover.

| Mode | Controls |
|---|---|
| Image | "View outline" checkbox |
| Phase | Style segmented [Tiles · Phase · Modulus · Contours · Grid], a sectors *n* scrubber (8/12/16/24, default 12), a Grid step scrubber (only in Grid style), and a "Region outline" checkbox |
| Landscape | Height segmented [log \|F\| · \|F\| · Re F · Im F], Material segmented [Phase · Tiles · Plaster], a Scale scrubber (0.25–2), a "Unit level" checkbox, views [3/4 · Top · Front], and Reset camera |
| Sphere | Segmented [Regions · Phase], a "Plane" checkbox, and Reset |
| Morph | Replaced by the transport (6.11) |

- **Empty plates.** Left with no shapes: centered `--muted` "Draw a region with the tools, or type a set such as |z − 1| < 2" plus three formula tags as buttons. Right with no steps: the identity image, with a top-center level-2 chip "Add a function to map the region" and a primary "Add function".

### 5.9 Function chain and step cards
**Chain head.** 36px, padding 0 12px, 1px `--line` bottom border: "Function chain" in `--t-heading`; the live composite in MathJax 14 (`F = f₂ ∘ f₁` or `F = id`); a spacer; segmented [Cards | Compact] (sets `--chain-h` to 272 or 112); "Whole chain" (small default button, pressed when focus = 0); "Clear chain" (ghost, with an Undo toast).

**Strip.** `display: flex`, `overflow-x: auto`, `scroll-snap-type: x proximity`, an 8px scrollbar, and a 16px edge-fade mask.

**Card.** Fixed 240×216, `--surface`, 1px `--line`, `--r-3`, `overflow: hidden`, `content-visibility: auto`.
```
┌ [f₁] Exponential                f⁻¹  ⏚  ⋯ ┐ head 28
│ w₁                                         │ thumbnail 88 (never blank)
│ w₁ = e^{z}                      [cut 180°] │ formula 28
│ a [1+i       ◎]   b [0          ◎]         │ params 2 × 26 (2-col grid)
│ c [ …        ◎]   d [ …         ◎]         │
├ A │ E │ R │ P │ M │ Pr │ I ───────────────┤ property strip 20
```
- **Head** (28px; padding 0 4 0 6; 1px `--line` below). **Index tag** 22×18, `--well`, `--r-1`, *f*₁ in STIX italic 13 (on the focused card: `--accent` with `--accent-ink`). **Name** `--t-heading` 12.5 with ellipsis. **Actions** (24px icons, shown on hover or focus-within, always on touch): *f*⁻¹ in STIX 12 (disabled without an inverse); Bypass (jumper icon, pressed when bypassed); ⋯ (Move left, Move right, Duplicate, Presets ▸, Remove). **Reorder** by dragging the head: the card lifts to level 3, a 2px `--accent` insertion bar marks the slot, the others slide over `--t-med` (FLIP).
- **Thumbnail** (88px): graph paper without labels, the stage image (6.12), the stage variable top-left in STIX italic 12 with a halo.
- **Formula row** (28px): MathJax 13.5 with a right fade on overflow, and a right-aligned branch tag in B612 Mono 10.5 on `--well` (`sheet 0/2`, `cut 180°`).
- **Parameters:** a 2-column grid (gap 4/8); each cell is the symbol (STIX italic 13, 16px wide) plus a 24px control. **Möbius** shows a **2×2 matrix**: 1px `--ink-2` bracket rules left and right of the block with 3px stubs (PGL(2, ℂ) made visible). `expr` and `coeffs` span both columns. Overflow scrolls inside the card with a fade.
- **Note** (optional): `--t-label` `--muted`, 2 lines max ("Principal branch. Drag the seam in the input plane."). **Errors:** an `--error-soft` strip with 11.5px `--error` text replaces the note, the border turns `--error`, and the property strip hides.
- **Property strip** (20px): 7 equal cells divided by 1px `--line`, `--t-caption`. On: `--good` on `--good-soft`. Off: `--faint`. Tooltip: "Proper: guaranteed".
- **States.** Hover: border `--line-strong`; this step's cuts and poles go to full strength, other steps' drop to 35%. Focused: border `--accent` plus `inset 0 0 0 1px var(--accent)`. Bypassed: *f*₁ struck through, body at 45%, a 45° hatch of 1px `--line-strong` every 6px over the thumbnail, both connectors dashed.
- **Region card.** 200×216, tag *z*, "Region", body "3 shapes, 1 hidden" with 12px swatches.
- **Connector** (40px column): a 1px `--ink-2` line with an open 6px chevron at the thumbnail center (72px down), the plane variable above it in STIX italic 13 (*z*, *w*₁, *w*₂). Hover turns it `--accent` and shows an 18px round **Insert** button (`--surface`, 1px `--line-strong`, plus icon) that opens the palette at that position.
- **Add card.** 128×216, 1px dashed `--line-strong`, `--r-3`. It holds a plus icon, "Add function" in `--t-label` `--ink-2`, and kbd `+`. Hover: `--accent` border and text. With no steps it reads "Add the first function".
- **Compact mode.** Cards are 200×56 (head plus formula). Clicking one opens its parameters in a level-3 popover anchored above the card.

### 5.10 Command palette (⌘K; `+` opens it filtered to functions)
**Container.** Level 3, `width: min(720px, 100vw - 24px)`, anchored 14vh from the top, max-height `min(520px, 100svh - 96px)`. On phone it is a bottom sheet at 85svh. Focus is trapped while open and returns to the opener on close.

- **Search row** (44px): a 16px magnifier; the input in Archivo 15, placeholder "Search functions, regions, examples, commands"; a context tag "Insert after *f*₁" when opened from a connector; an `Esc` kbd.
- **Body:** columns `1fr 184px` above 640px, one column below. **Results** scroll, with sticky group heads in `--t-heading` 12 `--muted`: Recently used (≤ 4), Functions by family (current order), Region formulas, Examples, View, Actions.
- **Row** (40px; columns `120px 1fr auto`, gap 12, padding 0 12): TeX at 15px; name in Archivo 13/500 over a one-line description in 11.5 `--muted` ("Conformal on ℂ; injective on strips of height 2π", "Circles to circles; ad − bc ≠ 0"); the 7 property letters in `--t-caption`, lit `--good`, unlit `--faint`. Active row: `--accent-soft` background, name `--accent`, no side rail.
- **Preview column:** a 184×184 mini plate of the current region pushed through the chain with the candidate inserted, at mesh 80, debounced 60ms, captioned "Image after adding *f*₃" in `--t-label` `--muted`.
- **Search:** fuzzy over name, id, aliases and TeX, ranked prefix > word start > substring. Aliases: sqrt, root → n-th root; cayley, mobius → Möbius; joukowsky, airfoil; ln → log; inversion, reciprocal; blaschke; conj, bar; rotation, scale, translate. **Formula as query:** if the query parses as an expression in *z*, the first row is "Custom formula *f*(*z*) = ⟨typeset⟩", with the preview.
- **Keys.** ↑/↓ move, Enter adds after the focused step, Shift+Enter inserts before it, Tab cycles groups, Esc closes. The footer (28px, `--well`, `--t-label` `--muted`) reads: "↑ ↓ to move   Enter to add   Shift Enter to insert before   Esc to close".
- The old grid-of-buttons popover is deleted.

### 5.11 Properties panel ("Guarantees")
The order is: composite map, then guarantees, then natural domain, then step by step. Sections have 12px padding and a 1px `--line` between them.

1. **Composite map.** The heading plus a copy-LaTeX icon (a check for 1.2s after copying). A formula well (`--well`, `--r-2`, padding 10 12): "*F*(*z*) = …" in MathJax 15, a 1px `--line`, then "*w*₁ = …" lines at 13.5 with index tags; bypassed steps read "*f*₂ bypassed" in `--muted`.
2. **Warnings** come before the lamps: `--warn-soft`, a 1px border of `color-mix(in srgb, var(--warn) 40%, transparent)`, `--r-2`, a 14px triangle and `--t-body` text ("Step 2 has an error and is skipped until fixed.", "A step is constant, so F is constant on D.").
3. **Guarantees: 8 lamps in a fixed order** that never reshuffles: Analytic, Entire, Rational, Polynomial, Möbius, Proper, Homeomorphism onto image, Conformal onto image. This replaces the green boxes and "Not guaranteed" pills.
   - **Row** 30px, 1px `--line` between rows: a 10×10 `--r-1` lamp, the name, a qualifier (B612 Mono 11 `--muted`, right-aligned: `deg 2`, `deg ≤ 4`), and a 12px `--faint` chevron. **Lit:** `--good` fill, name `--ink` 13/500. **Unlit:** 1px `--line-strong` outline, name `--muted` 13/400.
   - **Click** expands the definition (12.5/18 `--ink-2`, indented 18px), one row at a time, and highlights the matrix column. **On change** the row flashes `--accent-soft` and fades over 600ms; the lamp switches instantly.
   - **Key** in 11.5 `--muted`: "Lit: guaranteed by the chain. Unlit: not implied by the steps (it may still hold)."
4. **Natural domain *D*.** A well with "All *z* for which:" and a MathJax list; footnote in 11.5 `--muted`: "*w*ₖ is the value after step *k*; *w*₀ = *z*."
5. **Step by step: an indicator matrix.** 26px rows. Header: "step" then A E R P M Pr I in 24px columns, `--t-caption` `--muted`, with full-name tooltips. Body rows: index tag and ellipsized name. Cells: a centered 8×8 `--r-1` square, `--good` fill when on, 1px `--line-strong` outline when off (no ✓ or ·). The total row "*F*" sits under a 1.5px `--ink` rule, weight 600, 10×10 squares. **Linked hover:** a column fills with `--well` and lights its lamp; a row outlines its card in `--accent`; a hovered card washes its row in `--well`. "How these are decided" is a disclosure (12.5/18, ≤ 68ch, chevron rotating 90° over `--t-med`).

### 5.12 Menus, popovers, tooltips, modal, toasts
- **Menu.** Level 3, min-width 200, padding 4. Items 28px (36px on `pointer: coarse`), padding 0 8, `--r-2`: optional 16px icon, `--t-body` label, right-aligned shortcut in B612 Mono 11 `--faint`. Hover and keyboard: `--well`. Separators 1px `--line` with 4px margin. Submenus open after 120ms or on →.
- **Examples menu.** 52px items: a 48×32 thumbnail (rendered on first open, cached, 1px `--line`), the title in 13/500, one description line in 11.5 `--muted` ("Circle through −1, offset ↦ wing profile").
- **Tooltip.** `--inverse` with `--inverse-ink`, Archivo 12, padding 4 8, `--r-2`, max-width 260; the shortcut follows at 8px in B612 Mono 11 at 70%. Shows after 450ms (0ms between adjacent controls), no arrow, 6px from the anchor, preferring the top.
- **Popover.** Level 3, offset 6px, flips on collision; closes on Esc, outside pointerdown or anchor re-click; focus moves in and returns to the anchor.
- **Guide modal.** `width: min(640px, 100vw - 24px)`, padding 24, `--r-4`, over `--scrim`. Title "Using the Workbench" in `--t-title` with the mark at 28px; body 13.5/21, ≤ 68ch; kbd keycaps (1px `--line-strong` with a 2px bottom border, B612 Mono 11, `--r-1`); shortcuts in a 2-column table.
- **Toast.** Bottom-center, 12px above the chain, level 3, 36px tall: `--t-body` message plus one `--accent` 600 action ("Chain cleared. Undo"). Lasts 5s, pauses on hover. Every destructive action (clear chain, clear shapes, delete) uses a toast instead of a confirmation dialog.

### 5.13 Rails and drawers
- **Rail.** 36px wide, `--panel`, 1px `--line`, `--r-3`, full height, a 28px expand chevron at the top, and a rotated sentence-case label ("Region tools", "Guarantees") in `--t-label` `--ink-2`. **Left rail:** all 18 tools as 28px icon-only keys in a column, lit key shown, fully usable; then the shape count in B612 Mono 11. **Right rail:** the 8 lamps as a column of 10×10 squares (6px gap) with tooltips, so a collapsed panel still reports. On phone, rails become 36px horizontal bars with the lamp row.
- **Drawer.** Absolute over the stage, 288 (right) or 252 (left), level 3. It slides in over `--t-med`. During the slide the canvases scale as bitmaps and re-render once on `transitionend`. Shortcuts are `[` and `]`.

### 5.14 Loading, errors, empty states
- **Never show a blank canvas.** Before a stage is computed, draw the graph paper and source outlines and turn the LED amber. If work takes longer than 300ms, a 2px `--accent` indeterminate hairline (a 30% segment sweeping in 900ms) runs along the top of the plot.
- **Error copy** names the step and the fix: "f₂ (Custom formula): unknown symbol \sinc. Try \sin or \sinh." No apologies, no icons beyond the warning triangle.
- **Copy rules.** A *step* is a function in the chain; the *domain* is the *z*-plane; the *image* is the output. Meta strings use commas, not middle dots ("3 shapes, 1 hidden").

---

## 6. Canvas and plot rendering

Widths are CSS px × DPR (capped at 2) unless marked "device px". Shaders anti-alias with `fwidth` coverage. 2D strokes of 1 device px are half-pixel aligned. Every color comes from a token.

**Layer order.** GL: (1) plane, (2) grid tiers, (3) axes and unit circle, (4) region fills, (5) boundaries, (6) curves. 2D overlay canvas: (7) branch cuts and images of their banks, (8) poles, zeros and branch points, (9) field-of-view outline, (10) points and labels, (11) handles and draft, (12) probe and gauge. Then (13) HTML overlays.

### 6.1 Graph paper, axes, unit circle
Draw the graph paper in the plane's fragment shader on a full-screen quad, not as Canvas2D paths (this replaces `Axes.draw` line drawing).
```glsl
// s = CSS px per unit, dpr; world position p; minor/medium/major = grid tokens (sRGB)
float d0 = pow(10.0, ceil(log(8.0 / s) / log(10.0)));       // finest power of ten spaced >= 8 px
const float M[5] = float[](1.0, 5.0, 10.0, 50.0, 100.0);
vec3 col = plane;
for (int i = 0; i < 5; i++) {                                 // coarse tiers later, so they win
  float st = d0 * M[i], px = st * s;
  vec2 dpx = abs(fract(p / st + 0.5) - 0.5) * st * s * dpr;   // distance to line, device px
  float cov = 1.0 - smoothstep(0.0, 1.0, min(dpx.x, dpx.y));  // 1 device px line
  float t = smoothstep(log(12.0), log(240.0), log(px));
  vec3 c = t < 0.5 ? mix(minor, medium, 2.0 * t) : mix(medium, major, 2.0 * t - 1.0);
  col = mix(col, c, cov * smoothstep(8.0, 20.0, px));          // fades in from 0 at 8 px: no popping
}
```
- **Axes.** 1.25px `--axis`, pixel-snapped. At each ruler-labeled step there is a ±2.5px, 1px tick across the axis. No arrowheads and no in-plot labels; the rulers carry the numbers.
- **Unit circle** (toggle in the head, default on). 1px `--axis` at 55%, dashed 2/3, with 3px ticks where it crosses the axes.
- **Field of view** (Image mode, "View outline", default on). The image of the left viewport rectangle, sampled 64 points per side through *F*. Drawn as 1px dashed 5/4 in `--fov` at `--fov-a`, with 4px hollow squares at the images of the four corners.

### 6.2 What gets meshed: the whole image (fixes "the right image only shows what the left shows")
- **Bounded shapes** (disc, rectangle, polygon, lasso, annulus, bounded sector, bounded formula sets) are meshed over **their own bounding box**, independent of any view. Panning the left plane never re-meshes them.
- **Unbounded shapes** (half-plane, unbounded sector, complements, unbounded formula sets; lines and rays as curves) are meshed inside a **working disc** |*z* − *c*| ≤ *R*. *c* is the left view center when the shape was created; *R* = max(10, 4 × the left view's half-diagonal, 1.5 × the half-diagonal of the bounded shapes' union). When the left view's half-diagonal exceeds *R*/2, *R* doubles; the new mesh is built in the background (8.3) and swapped in when ready.
- **Truncation is never a fake boundary.** Fill alpha is multiplied by `smoothstep(0.0, 0.08 * R, R − |vSrc − c|)` in the fragment shader, and the cut edge is not stroked. When the disc edge is inside the left view, the left plane shows a dotted 1/3 circle in `--muted` at 60%, labeled "|z − c| = R" in `--t-micro`. The Image legend adds "unbounded parts drawn to |z| ≤ R".
- Remove `clipWin` from `shapeGPU`, `sourceCurves` and `Region.sampleCurve`. Bounded curves are complete; lines and rays are sampled to the working disc and fade the same way.
- **Pattern cell** = `niceStep(D / 10) × 2^scale`, where *D* is the larger side of the bounded area shapes' union box (or, with none, the left view width when shapes last changed). It is recomputed only when shapes change, never on pan or zoom. The Display "Cell" scrubber offers ×½ and ×2 (`patternScale`); the legend shows "cell 0.5 in *z*".

### 6.3 Fill
Opacity defaults to 0.85; fills are premultiplied and drawn in list order with "over". Shades: *c₀* = `--cN`, *c₁* = `--cN-alt`, edge *k* = `--cN-edge`. Pattern coordinates are always the **source point** `vSrc` (*z*), carried through the map, which is why every pattern deforms with *F*. Anti-aliasing helpers shared by every pattern:
```glsl
float checker(vec2 p, vec2 w){ w = max(w, vec2(1e-7));                    // box-filtered (Quílez)
  vec2 i = 2.0*(abs(fract((p-0.5*w)*0.5)-0.5) - abs(fract((p+0.5*w)*0.5)-0.5))/w; return 0.5-0.5*i.x*i.y; }
float iso(float x, float w, float px){ float d = abs(fract(x+0.5)-0.5)/max(w,1e-6);  // line at integers, px wide
  return 1.0 - smoothstep(0.5*px-0.5, 0.5*px+0.6, d); }
float moire(vec2 w){ return smoothstep(0.18, 0.45, max(w.x, w.y)); }   // 1 = cells < ~3 px: fade to mean tone
```
- Every pattern mixes toward its mean color by `moire(fwidth(g))`, so compressed cells near poles become a calm tone, not noise.

### 6.4 The eight patterns
The picker in Display is a 4×2 grid of 52×40 live swatches, each with its name below in `--t-caption`. The selected swatch gets a 1.5px `--accent` inset ring. A one-line description of the selected pattern sits under the grid in `--muted`. Pattern ids stay those in `GLR.PATTERNS`.

| # | Name (id) | Exact appearance; g = vSrc / cell |
|---|---|---|
| 1 | **Checker** (`checker`, default) | `mix(c0, c1, checker(g, fwidth(g)))`. Squares stay squares under conformal maps, which shows local rotation and scale. |
| 2 | **Conformal checker** (`polar`) | g = (ln\|z\|, arg z)·16/2π: 16 sectors, radial ratio e^{π/8} ≈ 1.48. Use `argWidth` for the angular `fwidth`. Cells stay square under zⁿ, exp and log, and it turns into a Cartesian checker under log. Inside \|z\| < cell/12 the fill is flat c₀. Option: "about the centroid". |
| 3 | **Graph paper** (`grid`) | Fill c₁. Lines Re s = k·cell are 1.25px *k*; lines Im s = k·cell are 1px c₀ (the two families stay distinct, so preserved orthogonality is visible). Every 5th line is +0.5px. The source axes are 2px *k*. |
| 4 | **Polar web** (`polargrid`) | Fill c₁. Circles \|s\| = k·cell are 1px c₀. Rays every 15° are 1px *k* at 70%; rays at multiples of 90° are 1.75px *k*. |
| 5 | **Orientation tiles** (`tiles`) | A checker of c₁ and mix(c₁, c₀, 0.35), with an **F** in every cell in *k*. In cell coordinates q ∈ [0,1)², y up, the F is three rectangles: stem [0.30,0.42]×[0.18,0.82], top bar [0.30,0.72]×[0.70,0.82], middle bar [0.30,0.62]×[0.46,0.56]. Each is a box SDF anti-aliased with `fwidth(q)`, and the F fades out when a cell is under 10px. Shows arg F′, \|F′\| and mirroring (conjugation flips the F). |
| 6 | **Source phase** (`phase`) | Ignores the shape color. `wheel(arg s, L)` with L = 0.62 + 0.14·saw(ln\|s\|/(π/6)), centered at the origin. Every image point shows the argument it came from, in the Phase tab's colors. The edge stays *k*. |
| 7 | **Area scale** (`stretch`) | Colored by local scale, not carried. t = clamp(log₂\|F′\| / 3, −1, 1), using the existing `vJac`. Color is mix(`--stretch-mid`, `--stretch-shrink`, (−t)^0.8) for t < 0 and mix(`--stretch-mid`, `--stretch-grow`, t^0.8) for t > 0, with source lines `iso(g)` 1px *k* at 18%. Blue shrinks, amber grows, and there is no red. The legend shows a 64×8 ramp with ticks ×⅛, 1, ×8. |
| 8 | **Solid** (`solid`) | Flat c₀. Boundary only. |

**Coordinate net** (Display checkbox, "Grid lines on regions"). It overlays `iso(g)` at 1 device px in *k* at 35% on Checker, Conformal checker, Source phase and Solid.

### 6.5 Boundaries, curves, selection, drafts
Every stroke is drawn over a casing in `--halo` at `--halo-a`. Joins and caps are round on canvas.

| Element | Casing | Stroke |
|---|---|---|
| Area boundary, closed set | 3.5px | 1.5px solid *k* |
| Area boundary, **open set** (formula with only < / >, complements of drawn shapes) | 3.5px | 1.5px **dashed 5/3.5** *k*: the textbook "boundary not included" |
| Curve (segment, line, ray, circle, arc, freehand) | 4px | 2px in the theme edge color *k* (c₀ is only 3:1 on the light plane) |
| Grid and polar-grid shapes | 2.5px | 1px *k* at 80% |
| Hovered | | +0.5px; cursor `move` |
| Selected (domain only) | | +0.75px; handles are 7×7 squares, `--surface` fill with a 1.5px *k* border, filled *k* on hover. Center and through-points are 7px circles. The radius handle sits at 45°. |
| Thumbnails | none | 1px *k* |

- **Orientation chevrons** (Display, default on). An open 6px chevron at 50% of the arc length of each open curve, and at angle 0 from the centroid of closed boundaries, in the stroke color. Reversal under *z̄* or 1/*z* becomes visible.
- **Draft.** 1.5px dashed 4/3 in *k*, fill at 35%, 6×6 filled vertex grips, a dashed rubber band to the cursor. **Dimension chip** (level 2, at cursor +14, +14, `--t-readout`): `r = 1.2500` · `2.0000 × 1.5000` · `2.2361 ∠ 26.57°` · `θ 0° → 60°` · `r₁ 0.5  r₂ 1.0`.
- **Drawing crosshair.** Full-span 1px `--accent` lines at `--cursor-a` while a drawing tool is active. A snap shows a 5×5 hollow `--accent` square, and the ruler markers jump with it.

### 6.6 Points, labels, probe, derivative gauge
- **Point.** A filled circle r 4 in *k*, with a 2px `--halo` ring. Selected adds a 1px ring at r 8.
- **Labels.** STIX Two Text italic 13 `--ink`, drawn as `strokeText` (3px `--halo`, round join) then `fillText`, at (+7, −7), placed greedily NE, NW, SE, SW to avoid earlier label boxes and flipping within 24px of an edge. Images take primes by stage (*a*′, *a*″, *a*‴, then *a*⁽⁴⁾), as today. User text labels ("trailing edge") are words, so they use Archivo 12/500 with the same halo.
- **Probe crosshair.** Four 7px arms with a 4px center gap, 1.25px `--probe` over a 3px `--halo` casing; on the Phase plot `#FFFFFF` with a 1px `--dc-casing`.
- **Derivative gauge** (Image mode). Around the source crosshair: a 10px-radius circle (1px `--probe` at 60%) and a 6px tick at angle 0 (1.5px `--accent`). At F(z): the **image of that circle** (48 samples through F, 1px `--probe` at 60%) and the image of the tick. A conformal map gives a circle scaled by |F′| and turned by arg F′. The drawn radius is clamped to 3–120px (the readout then adds `×` and the factor); at F′ = 0 the readout says "critical point".
- **Morph trails.** During Morph, each point draws its path *t* ↦ *H*(*t*, *p*) from 0 to the current *t* as a 1.25px polyline in *k* at 55%, with a 4px arrowhead.

### 6.7 Branch cuts, branch points, poles, zeros
- **Branch cut (seam).** A 3.5px `--halo` casing, then 1.75px solid `--cut`, with **hatches on the closed side** (the side whose values the cut takes; for the principal branch, the side approached counterclockwise): 5px at 45°, every 7px, 1.25px `--cut`, starting 8px from the branch point. This replaces today's red dashes.
- **Branch point.** An open circle r 3.5, filled `--halo`, 1.5px `--cut`.
- **Cut handle** (editable cuts, input plane). A 12px ring (2px `--cut`, `--halo` fill) on the cut at 0.33 of the view's smaller side, 14px on hover, cursor `grab`/`grabbing`. A level-2 chip 10px beyond it with a 1px `--cut` border reads `θ 180.0°` in B612 Mono 11 `--cut` (θ in STIX); delete "(drag)". **While dragging,** a protractor fades in over 80ms: an arc at 40px radius from 0 to θ, 1px `--cut` at 50%, ticks every 15°, labels every 45° in `--t-micro`. Steps 1°, Shift snaps 15°, and the card's cut field updates in sync.
- **Images of the cut banks** (output plane of that step). 1px dashed 4/3 `--cut` at 70%.
- **Pole.** A 9px "×" of 1.75px `--pole` over a 4px `--halo` "×" casing, with order > 1 shown as `--t-micro` "2" at the lower right. Tooltip: "Pole of f₂ at z = −i".
- **Zero** (Phase, Landscape and Sphere when known). An open circle r 3.5, 1.5px `--zero`, over a casing.
- **On the Phase plot,** poles and zeros are `--dc-line` with a 1px `--dc-casing`, and cuts keep `--cut` over a 3.5px white casing at 90%. **In thumbnails,** cuts are 1.25px without hatches and markers ×0.66.

### 6.8 Phase portrait (domain coloring)
**Render path.** A fragment shader evaluates the compiled chain per pixel (this exists in `GLChain`; keep it). Remove the CPU low-resolution pass; use dynamic resolution (8.4). If a step can't compile, fall back to a worker at half resolution with progressive tiles, LED amber until done.

**Phase wheel: perceptual OKLCH.**
- **Hue** `h = 29° + deg(arg w)` (mod 360): positive reals red, arg increasing counterclockwise through yellow, green, cyan, blue, magenta.
- **LUT:** a **256×32 RGBA8 texture** built once in JS. u = fract(arg/2π), L = mix(0.05, 0.98, v); each texel is `oklch(L, min(0.13, 0.97·Cmax(L,h)), h)` → sRGB; LINEAR, REPEAT in u, CLAMP in v. `wheel(θ, L)` is one fetch. It replaces the per-pixel `oklch()`, which clamps channels and so shifts hue.
- **Stops** at L 0.75, every 30° of arg from 0. Luminance varies only 0.39–0.45 across them, against 0.07–0.93 for HSV: `#F58C7E #EA9853 #CFA93E #A5B953 #6EC580 #27C8AF #1CC3D8 #53B8F7 #8EAAFD #B99BF5 #DB8FD6 #F089AC`.

**Styles.** Let *n* be the number of sectors (default 12), q = 2π/n, xm = ln|w| / q, xp = arg w / q. `saw` is the existing `sawAA` and `aw` is `argWidth`. Ids are `S.dc` values.

| Style (id) | Formula |
|---|---|
| **Tiles** (`enhanced`, default) | sm = saw(xm), sp = saw(xp); d = 1 − smoothstep(0.25, 0.6, max(fwidth(xm), aw/q)); L = 0.62 + d·(0.20·(sm − 0.5) + 0.07·(sp − 0.5)); color = wheel(θ, L). With n = 12, modulus steps are ×e^{π/6} ≈ 1.69 and phase steps are 30°, so **the cells are squares wherever F′ ≠ 0**: a curvilinear square grid. Zeros and poles become 12-armed stars. The \|w\| = 1 line is 1.25 device px `#FFFFFF` at 60%. |
| **Phase** (`phase`) | wheel(θ, 0.75). Optional isochromatic lines at integer xp: 1px `#000000` at 20%. |
| **Modulus** (`classic`) | u = (2/π)·atan\|w\|; L = 0.08 + 0.88u; chroma scaled by min(1, 5.2u(1 − u)) (mix toward the neutral of the same L). Zeros are black and poles white. Contours at \|w\| = 2ᵏ: 1px `#000000` at 15%. |
| **Contours** (`modulus`; best in light theme and for print) | Background mix(`--plane`, wheel(θ, 0.75), 0.12). Lines at integer xm: 1px `--ink` at 50%. \|w\| = 1: 1.75px `--ink`. Lines at integer xp: 1.25px wheel(θ, 0.55 light / 0.80 dark). |
| **Grid** (`grid`; pullback of the image's coordinate net) | Base mix(wheel(θ, 0.90), `--plane`, 0.35). Lines Re w = kΔ and Im w = kΔ: 1px wheel(θ, 0.45) at 85%. Every 5th line, and Re w = 0 and Im w = 0: 1.75px wheel(θ, 0.30). Δ = `S.dcGrid`, where "Auto" = niceStep(P90(\|w\|)/6) from a 32×32 sample taken when the view settles. |

- **Isolines and tiles fade out** where they would be denser than 3px: `a *= 1 − smoothstep(0.15, 0.35, fwidth(x))`.
- **Non-finite values.** NaN is `#7F7F7F` with a 45° hatch of 1px `#6A6A6A` every 6px. ±∞ is `#F5F5F5`.

**Overlays on the portrait** (mid-luminance in both themes, so identical in both): the major grid tier in `--dc-line` at `--dc-line-a`; axes in `--dc-line` at `--dc-axis-a` over a 1px `--dc-casing` at 40%; **region outlines** (default on) as 3px `#FFFFFF` at 95% then 1.3px `#0B1114` at 90%, dashed for open sets; cuts, poles and zeros as in 6.7. The rulers carry the numbers, so no labels sit on the colors.

**Legend chip** (136×72, padding 8).
- **Ring:** outer r 24, inner r 14, filled with `conic-gradient(from 90deg, #F58C7E, #F089AC, #DB8FD6, #B99BF5, #8EAAFD, #53B8F7, #1CC3D8, #27C8AF, #6EC580, #A5B953, #CFA93E, #EA9853, #F58C7E)` masked to the ring (CSS conics start at 3 o'clock here and run clockwise, so this order makes arg increase counterclockwise), with 1px `--line-strong` edges and labels outside in STIX italic 11 `--ink-2`: "1" east, "*i*" north, "−1" west, "−*i*" south.
- **Needle:** a 1.5px `--ink` line from the center to the probe's arg *w*, hidden with no probe.
- **Modulus strip:** a 64×8 strip of three sawtooth bands right of the ring, "×1.69 per band" (e^{2π/n} as *n* changes), with a 1px marker at the probe's |w|; in Modulus style a 0→∞ ramp with a tick at 1. Collapsed: a 20px ring.

### 6.9 Landscape (3D modulus surface)
The goal is a physical object you could hold: a lit relief standing on its own graph-paper plate, in the tradition of Jahnke–Emde reliefs and plaster models. Today's version is flat-lit, hard-clipped and has holes.

**Geometry**
- The domain is the left view box, aspect preserved, with the longer side mapped to [−1, 1].
- **Grid.** 256² vertices (384² at Fine and above) in a static index buffer.
- **Height pass**, run **once per chain, parameter, view or height-mode change:** a transform-feedback pass writes heights and *w* to a buffer, which is copied to an R32F height texture via `PIXEL_UNPACK_BUFFER`; the vertex shader reads neighbors with `texelFetch`. **Orbiting changes only camera uniforms.**
- **Height** (soft compression: poles become smooth spires and zeros smooth funnels, never holes). *H* = 0.55 × Scale (scrubber 0.25–2, default 1); μ = median |F| over the grid. log mode (default): h = H·(2/π)·atan(ln|F| / 1.4). |F| mode: h = H·((4/π)·atan(|F|/μ) − 1). Re F / Im F modes: h = H·(2/π)·atan(Re F / μ), likewise Im F.
- **Cliffs.** Drop only NaN cells and triangles whose vertex heights differ by more than 0.3·H (true discontinuities, such as |log z| across its cut), and draw the exposed edge as a 1.5px `--cut` line. Delete the current "jump > 0.6" rule, which tears holes.
- **Normals** by central differences on the height texture. **Ambient occlusion** ao = 1 − clamp(6·(box₉(h) − h), 0, 0.4), a 9×9 box filter, so valleys and zeros darken.
- **Skirt walls.** Extrude the 4 domain edges to the floor so the relief reads as a block cut out of the landscape: edge albedo × 0.55 under the same lights, vertical rules every 1/64 of the edge (0.75px `--land-mod-line` at 25%), top edge 1px `--land-mod-line` at 60%.

**Material and light.** All lighting is in linear light: decode albedo from sRGB, light it, then encode back. Lighting in sRGB space is why today's surface looks flat.
- **Albedo** (Material control), computed per fragment from *F*(*z*) at the interpolated *z* so contours stay crisp: **Phase** (default) wheel(arg F, 0.72); **Tiles** the 6.8 Tiles style; **Plaster** `--plaster`.
- **Lights**, fixed in the world so highlights travel across the relief as it turns:
  - **Key** azimuth 135°, elevation 50°, 0.80 white, Lambert × (0.5 + 0.5·ao). **Fill** azimuth −45°, elevation 20°, 0.18 × `--hemi-sky`. **Hemisphere ambient** mix(`--hemi-ground`, `--hemi-sky`, 0.5 + 0.5·n_z) × 0.40 × ao.
  - **Specular** Blinn-Phong on the key: exponent 48, strength 0.16 (satin ceramic); Plaster exponent 12, strength 0.05. **Rim** 0.10·(1 − max(0, n·v))³. **Back faces** use the flipped normal at 0.6. **Fog** mixes toward `--land-bottom` by 0.15·smoothstep(near, far, depth).
- **Contours on the surface** (`fwidth`, device px): **modulus** at ln|F| = kπ/6, 0.9px `--land-mod-line` at 40% (Plaster 65%), matching the phase portrait's Tiles so the conformal square net drapes over the relief; **phase** at arg F = kπ/6, 0.7px `--land-arg-line` at 30% (Plaster: `--land-mod-line` at 25%); **sea level |F| = 1**, 1.75px `#FFFFFF` at 90% over a 3px `#0B1114` at 35%.

**Stage**
- **Floor** at z_f = −H − 0.08, extending 8% beyond the walls, in `--land-floor` with the 6.1 graph-paper tiers, the outer 12% fading out. With Phase or Tiles material the **phase portrait is printed on it at 16%**. Source region outlines are projected onto it at 1.25px in their *k*. **Contact shading:** floor × (1 − 0.28·exp(−(h − z_f)/0.12)), in `--land-shadow` at `--land-shadow-a`.
- **Unit level** (checkbox, default off): the plane h(|F| = 1) as a 5% `--accent` fill with a 1px edge at 35%.
- **Box:** the floor rectangle plus the vertical edge at the back corner farthest from the camera (chosen per frame), 1px `--land-box`.
- **Labels** (2D overlay, projected each frame): ticks on the two floor edges facing the camera in `--t-micro` `--axis-label` with a halo; "Re *z*", "Im *z*" in STIX italic 12; a **height ruler** on the back edge labeled in |F| values 0.01, 0.1, 1, 10, 100 (when in range) through the height map, titled "|*F*|".
- **Background:** a vertical gradient `--land-top` → `--land-bottom`, times a vignette (1 − 0.06·r²).

**Camera**
- Perspective, 28° vertical FOV (telephoto, product-photo look; today 35°). Default yaw −38°, pitch 30°; distance auto-fits the bounding sphere, `r / sin(fov/2) × 1.05`.
- Orbit 0.35°/px, pitch clamped to [6°, 88°], inertia ×0.90 per frame. Wheel zoom ×1.1 per notch, clamped to [0.4, 4] × the fit distance. Shift-drag or right-drag pans.
- Double-click resets (400ms `--ease-std`). Views: 3/4, Top (pitch 88°), Front (pitch 8°). "Turntable" (6°/s) is off by default and disabled under reduced motion. MSAA via `antialias: true` on the stage canvas.
- **Probe.** Hovering the left plane draws a 1px `--probe` needle from the floor to (z, h(z)), with a 6px ring at the surface and a 3px dot on the floor.
- **Legend.** "height log |*F*|, contours ×e^{π/6}" in `--t-caption`, with a 32px hue ring.

### 6.10 Riemann sphere
- **Convention.** Unit sphere, with N = (0, 0, 1) ↔ ∞ and S ↔ 0. A sphere point P maps to z = (P_x + iP_y)/(1 − P_z).
- **Mesh.** Icosphere at subdivision 5.
- **Modes.** **Regions** (default): the base is `--plane` graph paper, and the image meshes are lifted by inverse stereographic projection (+0.002 radius offset) with their patterns and edges; unbounded images close up at ∞ and Möbius maps visibly send circles to circles. **Phase:** per fragment, z from P, then F(z), then the current 6.8 style.
- **Material.** The 6.9 light rig with specular 0.18 at exponent 40 (lacquered globe) and a Fresnel rim of 0.12·(1 − n·v)³.
- **Graticule** (shader, constant pixel width, on (arg z, log₂|z|)): meridians every 30° and parallels at |z| ∈ {¼, ½, 2, 4} at 1 device px `--grid-major`; the equator |z| = 1 at 1.5px `--axis`; the real great circle at 1.25px `--axis` at 70%. In Phase mode the lines become `#0B1114` at 18–45%.
- **Labels** (2D, projected). "0" at S and "∞" at N; "1", "*i*", "−1" and "−*i*" on the equator. They are STIX italic 13 `--axis-label` with a halo, faded by smoothstep(0.05, 0.3, n·v).
- **Silhouette.** 1.25px `--axis` at 50%.
- **Contact shadow.** An elliptical radial gradient (aspect 1.6 : 0.35) under the sphere, from `--land-shadow` at 18% (light) or 28% (dark) to 0.
- **Plane** (checkbox, default off). An equatorial disc of radius 2.4 at 14% with grid tiers, depth-clipped so the sphere sits half through it. With the probe active, a 1px `--accent` **projection ray** runs N → sphere point → plane point, with dots at all three.
- **Camera.** Trackball rotation with inertia. FOV 28°, default yaw −60° and pitch 18°, so ∞ is at the top. Double-click resets.
- **Background.** As in 6.9.

### 6.11 Morph
- **Transport** (level 2, 36px tall, from 8px left to 48px from the right along the bottom of the plot): play/pause (28px); a **scrubber** (2px `--line-strong` track filled `--accent` up to *t*, 8px integer ticks in 1px `--ink-2`, *f*₁, *f*₂ centered in their segments in STIX italic 11, a fader-cap thumb, magnetic snap to integers within 0.03); the `t = 1.37 / 2` readout in `--t-readout`; speed [0.5× · 1× · 2×]; and a homotopy menu, "Natural path" (each step's own homotopy; Möbius moves along a one-parameter subgroup) or "Straight line", plus Once / Loop.
- **Ghost outlines.** The start outline is 1px dashed 4/3 `--faint`; the end outline is 1px dotted 1/2 `--faint`. Points draw trails (6.6), and their labels read *a*ₜ.
- **Timing.** 1.6s per step with `--ease-inout` inside each step, a 0.5s hold at each integer *t*, and a 1.0s hold at the end. Under reduced motion there is no autoplay and Play runs once.

### 6.12 Thumbnails
- Same renderer at 240×88 CSS px (DPR ≤ 2), only on idle (≥ 150ms after the last input, ≤ 10 fps during edits), never during pan, zoom or orbit. Cached per (stage, chain signature, shapes signature) as an `ImageBitmap`.
- Framed to a robust box (1st–99th percentile) of the stage image plus 10%. Contents: graph paper, the current pattern, 1px edges without casing, cuts without hatches.
- **Never blank:** before the mesh is ready, the source outline mapped at mesh 40; with no area shapes, the curves and points; with nothing, the axes and "No shapes" in `--muted`.

---

## 7. Motion

The instrument is calm. There are no entrance animations, no staggered reveals and no hover lifts. Motion appears only in answer to an action, to show what changed.

| Interaction | Motion |
|---|---|
| Hover on a control | Color and border change at `--t-fast`. Nothing moves. |
| Fit, reset view, example load | The view tweens over `--t-view` with `--ease-out`: center linear, scale interpolated in log space. |
| Wheel zoom | Cursor-anchored. Each notch eases to its target over 120ms (log scale). A trackpad pinch applies immediately. |
| **Chain change** (add, remove, invert, reorder, bypass, preset, example) | **The image plane morphs from the old image to the new one along that step's homotopy** over `--t-hom` with `--ease-inout`, at mesh ≤ 160, then swaps to full resolution. This is the signature moment. Continuous edits (typing, scrubbing, dragging a cut) update live with no tween. |
| Popover, menu or palette open | Opacity 0→1 plus a 4px translate from the anchor side, `--t-med` `--ease-out`. Close is `--t-fast`, opacity only. Palette results don't animate. |
| Segmented thumb | Slides over `--t-med`. |
| Drawer, rail, panel collapse | Width or transform over `--t-med`. Canvases scale as bitmaps and re-render once on `transitionend`. |
| Card insert, remove, reorder | Insert: width 0→240 plus opacity over `--t-slow`. Remove: the reverse over `--t-med`, then a toast. Reorder: FLIP over `--t-med`. |
| Lamp changes | The row flashes `--accent-soft` for 600ms. The lamp switches instantly, the way an indicator does. |
| LED while computing | Opacity pulse 1→0.35 over 1.2s, only while refining. |
| Cut drag | The protractor fades in over 80ms. A snap gives a 1px highlight on the snapped degree tick. |
| Readout copy | The chip text reads "Copied" for 900ms. |
| 3D orbit | Inertia ×0.90 per frame. Reset is a 400ms `--ease-std` tween. |

- **Linked highlighting.** Shape row → that shape on both planes. Card → its singularities and its matrix row. Matrix column → its lamp; matrix row → its card. Hovering either plane probes both planes, the thumbnails (a 4px dot), the landscape and the sphere.
- **Keyboard.** Tool letters (5.2); `T` focuses the formula field; ⌘K opens the palette and `+` opens it filtered to functions; `1`–`5` switch right-plane modes; `Z` fits both planes; `[` `]` toggle panels; `?` opens the guide; Esc cancels a draft or closes a popover; Delete removes the selection; Enter closes a polygon; ⌘Z / ⇧⌘Z undo and redo.
- **Cursors.** `crosshair` with drawing tools, `grab`/`grabbing` for pan and orbit, `move` over shapes, `ew-resize` on scrub labels, `row-resize`/`col-resize` on gutters.
- **Reduced motion** (`prefers-reduced-motion: reduce`). Every duration becomes 0, except opacity fades capped at 80ms. The LED is steady. There is no inertia, no chain homotopy, no morph autoplay and no turntable.

---

## 8. Performance contract (the user's "laggy and slow")

The look depends on these rules. Each one names the code it replaces.

1. **Map once, draw many.** Today `REGION_VS` calls `mapPoint` four times per vertex, every frame, for every pane: about 12 chain evaluations per sub-triangle at about 0.5M sub-triangles, the main cause of lag. New: a **transform-feedback pass** (core WebGL2, `RASTERIZER_DISCARD`) evaluates each unique template vertex once per (shape mesh, stage map, parameter version) and writes `vec4(w.x, w.y, valid, jac)` to a buffer; the validity test (`cfin`, centroid deviation) moves into it. Draw passes only compute `(w − uCenter)·uScale`. **Pan and zoom change two uniforms; hover changes nothing in GL.** Only a playing morph and the chain homotopy still evaluate per frame, capped at mesh 160.
2. **No readback blit.** Today `GLR.blit` copies an offscreen WebGL canvas into 2D canvases with `drawImage` every frame. New: one WebGL2 context on **one stage canvas** absolutely positioned under both plots; each plane draws with `gl.viewport` and `gl.scissor` set to its plot rectangle in device px. The 2D overlay canvases (labels, handles, probe) and the ruler canvases stay on top. Thumbnails keep the offscreen-then-`drawImage` path, on idle only (6.12).
3. **Background meshing.** `Region.buildMesh`, `computeFix` and working-disc growth move to a Web Worker, transferring `Float32Array`s (until then, idle slices ≤ 6ms). While a handle, shape or parameter is dragged, use the draft mesh (N ≤ 160) and swap to the selected quality 150ms after release. Default quality is **Normal (240)**, not 480.
4. **Dynamic resolution** for per-pixel modes (Phase, Landscape fragment color, Sphere Phase): render at DPR 1 while a pointer drag, wheel or orbit is active. Re-render at full DPR (≤ 2) 120ms after the last input.
5. **Cache by signature, never by view.** Meshes and TF buffers are keyed by (shape, chain prefix signature, parameter version, N). `cell` is keyed by the shapes only. Landscape heights are keyed by (chain, parameters, view box, height mode).
6. **DOM over canvases.** No `backdrop-filter`; `contain: strict` on plane bodies and `content-visibility: auto` on cards; `pointermove` coalesced to one handler per rAF; readouts update text nodes only; the probe redraws only the overlay and rulers; MathJax re-typesets only changed nodes.
7. **Budgets.**

| Interaction | Target |
|---|---|
| Pan or zoom in any 2D mode | 60 fps, ≤ 4ms main thread per frame |
| Phase-mode pan at DPR 2 on a 1440 × 900 laptop | 60 fps |
| 3D and sphere orbit | 60 fps, camera-only |
| Parameter scrub | ≥ 30 fps at the draft mesh; full refinement ≤ 300ms after release |
| Add a step | Homotopy starts in ≤ 16ms |
| Theme switch | One frame |

---

## 9. Implementation checklist (by impact)

**P0: the user's explicit complaints**
- [ ] **8.1** Transform-feedback map cache. The view becomes uniform-only. Acceptance: panning a 480-mesh exp/Möbius chain holds 60 fps.
- [ ] **8.2** Stage canvas with scissored viewports. Remove the per-frame `GLR.blit`.
- [ ] **6.2** Whole-image meshing: remove `clipWin` from meshing and curves; add the working disc with feathered truncation, the field-of-view outline and the shape-based `cell`. Acceptance: in screenshot 3's scene (disc, √z, cut 180°) the full half-disc image shows while the left view is zoomed in.
- [ ] **8.3–8.6** Draft mesh while dragging, default quality 240, dynamic resolution, probe on overlays only.
- [ ] **6.9** Landscape rebuild, in order: height texture and soft heights (remove the hole rule); linear lighting; contours with sea level; skirts, floor print and contact shading; 28° camera with inertia and MSAA; height ruler.

**P1: "looks cheap": the visual system**
- [ ] **2** Tokens, **3** fonts, sentence case, B612 Mono readouts, and `readTheme()` token renames. The palette moves into tokens. The theme cycle button.
- [ ] **5.1** Header and z² mark. Command field. Examples menu with thumbnails.
- [ ] **5.8 / 6.1** Plane chrome: shader graph paper with tiers, rulers with cursor markers, readout/legend/view-stack/options overlays, LED, gutters; footers and overlay notes removed.
- [ ] **6.5–6.7** Halos under every stroke, dashed open boundaries, chevrons, the derivative gauge, hatched seams with branch points, the protractor, and new pole and zero markers.
- [ ] **6.4** The eight patterns with moiré fade, the swatch picker, opacity 0.85.
- [ ] **6.8** Phase LUT, five styles, overlays, and the legend with needle.
- [ ] **5.9** Step cards: fixed anatomy, thumbnail never blank, Möbius matrix, property strip, connectors with the variable and Insert, drag reorder, compact mode.
- [ ] **5.11** Lamps, matrix squares, and linked hover.
- [ ] **5.2–5.7** Tool keys with lit state, segmented thumb, buttons, complex field with Argand glyph and pad, scrubbers, fader, shape rows. All icons as SVG (Appendix A), with no glyph icons.

**P2: depth and reach**
- [ ] **5.10** Command palette with aliases, formula-as-query and the preview column.
- [ ] **6.10** Sphere polish: graticule, labels, contact shadow, plane and projection ray.
- [ ] **6.11** Morph transport, ghost outlines and point trails.
- [ ] **7** Chain homotopy at `--t-hom`, lamp flash, FLIP cards, reduced motion.
- [ ] **4** Breakpoints, drawers, the phone layout with bottom toolbar and sheets. Check at 390 × 844 that there is no horizontal scroll.
- [ ] **8.3** Worker meshing.

---

## Appendix A: icons

**Rules**
- **Sizes.** Tools are drawn on a 20×20 viewBox with stroke 1.5. UI icons are 16×16 with stroke 1.5.
- **Stroke.** `currentColor`, round caps and joins, fill none unless noted.
- **Areas.** Area tools add `fill="currentColor" fill-opacity=".16"`.
- **Points.**
  - Construction points (segment ends, arc ends, polygon vertices, rectangle corners) are **3.5×3.5 filled squares**, like CAD grips.
  - Centers are a "+" with 2.5px arms at 1px stroke.
  - Only the Point tool uses a dot.
- **Unbounded objects** (line, ray, half-plane) touch the viewBox edge.
- **No Unicode glyph icons** (●, ◌, ×, ⏻, ‹ ›).

**Tools (20×20)**

| Tool | Geometry |
|---|---|
| Select | `M5.5 3.5V15l3.1-2.9 2.1 4.5 1.9-.8-2.1-4.5h4.1z` (stroke only) |
| Point | circle (10,10) r 2.25 filled + `M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2` |
| Segment | `M5 15L15 5` + grips at (5,15), (15,5) |
| Line | `M1 17.9L19 2.1` + grips at (7,12.6), (13,7.4) |
| Ray | `M5 15L19 2.7` + grip at (5,15) |
| Circle | circle (10,10) r 6.5 + center "+" |
| Arc | `M3.5 14.5A7.5 7.5 0 0 1 16.5 14.5` + grips at both ends and at the apex (10, 3.26) |
| Freehand | `M3 14c2.2-4.8 4.2-.4 6.2-3.6S13 5.6 17 7.5` |
| Disc | circle (10,10) r 6.5, area fill |
| Rectangle | rect (3.5,5.5,13,9) rx .5, area fill + corner grips |
| Polygon | `M4 14.5L6.5 5 14 4.5l2.5 7L10 16z`, area fill + vertex grips |
| Lasso | `M5.2 12.8C3 9.6 5 4.8 9.6 4.5s7.4 2.6 6.4 6.2-5.6 4.9-8.6 4.3c-1-.2-1.7-1-2.2-2.2z`, area fill + `M5 13l-1.5 3.5` |
| Half-plane | rect (0,0,20,10.5) area fill, no stroke + `M0 10.5h20M14.5 8.5l2 2-2 2` (the region is on the left of the arrow) |
| Annulus | even-odd `M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14zm0 3.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 1 0 0-6.5z`, area fill, both circles stroked |
| Sector | `M4 16h13A13 13 0 0 0 13.2 6.8z`, area fill + grip at (4,16) |
| Formula | text "*f*" in STIX italic 14 + `M12 7h5M12 11h5` (≡) |
| Grid | stroke 1: `M4 4v12M8 4v12M12 4v12M16 4v12M4 4h12M4 8h12M4 12h12M4 16h12` |
| Polar grid | stroke 1: circles r 3 and r 6.5 + `M10 3.5v13M3.5 10h13M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2` |

**UI (16×16)**

| Icon | Paths |
|---|---|
| plus / minus | `M8 3.5v9M3.5 8h9` / `M3.5 8h9` |
| close | `M4.5 4.5l7 7M11.5 4.5l-7 7` |
| chevron left / right | `M10 3.5L5.5 8l4.5 4.5` / `M6 3.5L10.5 8 6 12.5` |
| more (filled) | circles r 1.1 at (3.5,8), (8,8), (12.5,8) |
| eye / eye-off | `M1.75 8s2.3-4.25 6.25-4.25S14.25 8 14.25 8s-2.3 4.25-6.25 4.25S1.75 8 1.75 8z` + circle (8,8) r 2 / the same + `M2.5 13.5l11-11` |
| fit | `M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3` + circle (8,8) r 1.75 |
| expand / restore | `M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9` / `M13 3L9 7M9 3.5V7h3.5M3 13l4-4M7 12.5V9H3.5` |
| undo / redo | `M5.5 3.5l-3 3 3 3M2.5 6.5h7a3.5 3.5 0 0 1 0 7H6` / `M10.5 3.5l3 3-3 3M13.5 6.5h-7a3.5 3.5 0 0 0 0 7H10` |
| theme | circle (8,8) r 5.75 + filled `M8 2.25a5.75 5.75 0 0 1 0 11.5z` |
| bypass (jumper) | `M1.5 11h3.5M11 11h3.5M5 11C5 5 11 5 11 11` + rect (6.5,9.5,3,3) |
| play / pause (filled) | `M5 3.5v9l7.5-4.5z` / rects (4.5,3.5,2.25,9) and (9.25,3.5,2.25,9) |
| search | circle (7,7) r 4.25 + `M10.25 10.25l3.25 3.25` |
| panel-left / panel-right | rect (2,2.5,12,11) rx 1.5 + `M6 2.5v11` / + `M10 2.5v11` |
| snap (magnet) | `M4 2.5v5.5a4 4 0 0 0 8 0V2.5M4 5h2.5M9.5 5H12` |
| unit circle | circle (8,8) r 5.5 with `stroke-dasharray="2 2"` + filled circle (8,8) r 1 |
| sliders | `M2.5 5h11M2.5 11h11` + circles (6,5) and (10,11) r 1.75, filled `--surface` |
| orbit reset | ellipse (8,8) rx 6 ry 2.75 + `M12 4.2l2 1.3-1.6 1.8` + filled circle (8,8) r 1.25 |
| copy / check | rect (5.5,5.5,8,8) rx 1.5 + `M10.5 5.5V3.75c0-.7-.55-1.25-1.25-1.25h-5.5c-.7 0-1.25.55-1.25 1.25v5.5c0 .7.55 1.25 1.25 1.25H5.5` / `M3.5 8.5l3 3 6-7` |
| warning | `M8 2.5l6 10.5H2z M8 6.5v3` + filled circle (8,11.25) r .8 |
| help | circle (8,8) r 6 + `M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.4` + filled circle (8,11.6) r .8 |

**Mode icons (14px)**

| Mode | Drawing |
|---|---|
| Image | A square with a 2×2 checker, two cells filled at 35% |
| Phase | A circle r 5.5 with spokes at 0°, 120° and 240° |
| Landscape | `M1.5 12.5c2.5 0 3.5-6 6.5-6s4 6 6.5 6` over `M1.5 14h13` |
| Sphere | A circle r 6, the equator half-ellipse `M2 8a6 2.2 0 0 0 12 0`, and a meridian ellipse |
| Morph | A 4px square, an arc arrow, then a dot r 2 |
