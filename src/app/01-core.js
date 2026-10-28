  const { C } = CX;
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const sub = (k) => String(k).split('').map((d) => SUB[+d] ?? d).join('');
  const wvar = (k) => (k === 0 ? 'z' : `w_{${k}}`);
  const wHtml = (k) => (k === 0 ? '<i>z</i>' : `<i>w</i>${sub(k)}`);
  // 16px stroke icons (currentColor)
  const svgI = (inner, fill) => `<svg class="ic" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="${fill ? 'currentColor' : 'none'}" stroke="${fill ? 'none' : 'currentColor'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const ICONS = {
    plus: svgI('<path d="M8 3.5v9M3.5 8h9"/>'),
    minus: svgI('<path d="M3.5 8h9"/>'),
    close: svgI('<path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/>'),
    chevL: svgI('<path d="M10 3.5L5.5 8l4.5 4.5"/>'),
    chevR: svgI('<path d="M6 3.5L10.5 8 6 12.5"/>'),
    chevD: svgI('<path d="M3.5 6l4.5 4.5L12.5 6"/>'),
    more: svgI('<circle cx="3.5" cy="8" r="1.1"/><circle cx="8" cy="8" r="1.1"/><circle cx="12.5" cy="8" r="1.1"/>', true),
    eye: svgI('<path d="M1.75 8s2.3-4.25 6.25-4.25S14.25 8 14.25 8s-2.3 4.25-6.25 4.25S1.75 8 1.75 8z"/><circle cx="8" cy="8" r="2"/>'),
    eyeOff: svgI('<path d="M1.75 8s2.3-4.25 6.25-4.25S14.25 8 14.25 8s-2.3 4.25-6.25 4.25S1.75 8 1.75 8z"/><circle cx="8" cy="8" r="2"/><path d="M2.5 13.5l11-11"/>'),
    fit: svgI('<path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/><circle cx="8" cy="8" r="1.75"/>'),
    expand: svgI('<path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9"/>'),
    restore: svgI('<path d="M13 3L9 7M9 3.5V7h3.5M3 13l4-4M7 12.5V9H3.5"/>'),
    undo: svgI('<path d="M5.5 3.5l-3 3 3 3M2.5 6.5h7a3.5 3.5 0 0 1 0 7H6"/>'),
    redo: svgI('<path d="M10.5 3.5l3 3-3 3M13.5 6.5h-7a3.5 3.5 0 0 0 0 7H10"/>'),
    theme: svgI('<circle cx="8" cy="8" r="5.75"/><path d="M8 2.25a5.75 5.75 0 0 1 0 11.5z" fill="currentColor" stroke="none"/>'),
    bypass: svgI('<path d="M1.5 11h3.5M11 11h3.5M5 11C5 5 11 5 11 11"/><rect x="6.5" y="9.5" width="3" height="3"/>'),
    play: svgI('<path d="M5 3.5v9l7.5-4.5z"/>', true),
    pause: svgI('<rect x="4.5" y="3.5" width="2.25" height="9"/><rect x="9.25" y="3.5" width="2.25" height="9"/>', true),
    search: svgI('<circle cx="7" cy="7" r="4.25"/><path d="M10.25 10.25l3.25 3.25"/>'),
    grip: svgI('<circle cx="6" cy="4" r="1"/><circle cx="10" cy="4" r="1"/><circle cx="6" cy="8" r="1"/><circle cx="10" cy="8" r="1"/><circle cx="6" cy="12" r="1"/><circle cx="10" cy="12" r="1"/>', true),
    panelL: svgI('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M6 2.5v11"/>'),
    panelR: svgI('<rect x="2" y="2.5" width="12" height="11" rx="1.5"/><path d="M10 2.5v11"/>'),
    // reset view: a circular arrow turning back (an ellipse with a dot read as the visibility eye)
    orbit: svgI('<path d="M2.75 8A5.25 5.25 0 1 0 8 2.75a5.7 5.7 0 0 0-3.95 1.65L2.75 5.7"/><path d="M2.75 2.75v2.95H5.7"/>'),
    trash: svgI('<path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.75 9h5.5l.75-9"/>'),
    guide: svgI('<path d="M8 4c-1.5-1-3.5-1.25-5.5-1v9.5c2-.25 4 0 5.5 1 1.5-1 3.5-1.25 5.5-1V3c-2-.25-4 0-5.5 1zM8 4v9.5"/>'),
    warning: svgI('<path d="M8 2.5l6 10.5H2zM8 6.5v3"/><circle cx="8" cy="11.25" r=".8" fill="currentColor" stroke="none"/>'),
    argand: svgI('<path d="M2.5 8h11M8 2.5v11"/><circle cx="11" cy="5" r="1.6" fill="currentColor" stroke="none"/>'),
    help: svgI('<circle cx="8" cy="8" r="6"/><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1v.4"/><circle cx="8" cy="11.6" r=".8" fill="currentColor" stroke="none"/>'),
    snap: svgI('<path d="M4 2.5v5.5a4 4 0 0 0 8 0V2.5M4 5h2.5M9.5 5H12"/>'),
    unit: svgI('<circle cx="8" cy="8" r="5.5" stroke-dasharray="2 2"/><circle cx="8" cy="8" r="1" fill="currentColor" stroke="none"/>'),
    sliders: svgI('<path d="M2.5 5h11M2.5 11h11"/><circle cx="6" cy="5" r="1.75" fill="var(--surface)"/><circle cx="10" cy="11" r="1.75" fill="var(--surface)"/>'),
    // ([v17 D5] the header's Settings and Share; the Language setting's globe, in Settings and the phone's sheet)
    globe: svgI('<circle cx="8" cy="8" r="5.75"/><path d="M2.25 8h11.5M8 2.25c-2.2 2.9-2.2 8.6 0 11.5M8 2.25c2.2 2.9 2.2 8.6 0 11.5"/>'),
    gear: svgI('<circle cx="8" cy="8" r="2.1"/><path d="M8 1.75v1.6M8 12.65v1.6M14.25 8h-1.6M3.35 8h-1.6M12.42 3.58l-1.13 1.13M4.71 11.29l-1.13 1.13M12.42 12.42l-1.13-1.13M4.71 4.71L3.58 3.58"/><circle cx="8" cy="8" r="4.4"/>'),
    share: svgI('<circle cx="4.25" cy="8" r="1.9"/><circle cx="11.75" cy="3.9" r="1.9"/><circle cx="11.75" cy="12.1" r="1.9"/><path d="M5.9 7.1l4.2-2.3M5.9 8.9l4.2 2.3"/>'),
    copy: svgI('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.75c0-.7-.55-1.25-1.25-1.25h-5.5c-.7 0-1.25.55-1.25 1.25v5.5c0 .7.55 1.25 1.25 1.25H5.5"/>'),
    check: svgI('<path d="M3.5 8.5l3 3 6-7"/>'),
    download: svgI('<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>'),
    sphere: svgI('<circle cx="8" cy="8" r="6"/><path d="M2 8a6 2.2 0 0 0 12 0"/><ellipse cx="8" cy="8" rx="2.4" ry="6"/>'),
    // the deformation's paths t -> H_t(z): a start dot, a curved path and its arrowhead
    // (the paths' own glyph: an open ring at z, the line, a small arrowhead at its middle, a filled dot at the end)
    paths: svgI('<circle cx="3.25" cy="12.25" r="1.75" stroke-width="1.25"/><path d="M4.4 10.9C6 6.6 9 4.6 12.2 4.3"/><path d="M5.6 5.4L8.3 5.6L7.1 8.1" stroke-width="1.3"/><circle cx="13" cy="4.25" r="1.7" fill="currentColor" stroke="none"/>'),
  };
  // right-plane mode icons (14px)
  const msvg = (inner) => `<svg class="mic" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const MODE_ICONS = {
    image: msvg('<rect x="2" y="2" width="12" height="12" rx="1"/><rect x="2" y="2" width="6" height="6" fill="currentColor" fill-opacity=".35" stroke="none"/><rect x="8" y="8" width="6" height="6" fill="currentColor" fill-opacity=".35" stroke="none"/>'),
    color: msvg('<circle cx="8" cy="8" r="5.5"/><path d="M8 8h5.5M8 8l-2.75 4.76M8 8l-2.75-4.76"/>'),
    '3d': msvg('<path d="M1.5 12.5c2.5 0 3.5-6 6.5-6s4 6 6.5 6"/><path d="M1.5 14h13"/>'),
    sphere: msvg('<circle cx="8" cy="8" r="6"/><path d="M2 8a6 2.2 0 0 0 12 0"/><ellipse cx="8" cy="8" rx="2.4" ry="6"/>'),
    // the deformation (the Deformation toggle in the top bar)
    // X → Y (the top bar's split view): two planes and the map between them
    xy: msvg('<rect x="1.5" y="4" width="5" height="8" rx=".8"/><rect x="9.5" y="4" width="5" height="8" rx=".8"/><path d="M6.5 8h2.6M8 6.7l1.3 1.3L8 9.3"/>'),
    morph: msvg('<rect x="1.5" y="6" width="4" height="4"/><path d="M6.5 6.5c2-3 4.5-3 6 0"/><path d="M11.5 4.5l1 2-2.2.3"/><circle cx="12.5" cy="10.5" r="2" fill="currentColor" stroke="none"/>'),
  };

  // ---------------- TeX via MathJax (falls back to source text) ----------------
  const TeX = (() => {
    const cache = new Map();
    let ready = false;
    const pending = new Set();
    function paint(node, tex, display) {
      if (!ready) {
        node.innerHTML = '';
        node.append(h('span', { class: 'tex-fallback' }, tex));
        pending.add(node);
        return;
      }
      const key = (display ? 'D' : 'I') + tex;
      let html = cache.get(key);
      if (html === undefined) {
        try { html = MathJax.tex2svg(I18N.notation(tex), { display }).outerHTML; } catch (e) { html = null; }
        if (cache.size > 3000) cache.clear();
        cache.set(key, html);
      }
      if (html == null) node.textContent = tex; else node.innerHTML = html;
    }
    function set(node, tex, display = false) {
      if (node.dataset.tex === tex && node.dataset.rd === String(ready)) { held.delete(node); return; }
      // hushed (a scrub or drag is under way): a node that already shows a formula keeps it until input pauses,
      // unless the new one is cached; fresh nodes are typeset at once
      if (hushT && ready && node.dataset.tex && !cache.has((display ? 'D' : 'I') + tex)) { held.set(node, [tex, display]); return; }
      held.delete(node);
      node.dataset.tex = tex;
      node.dataset.rd = String(ready);
      node.dataset.disp = display ? '1' : '';
      paint(node, tex, display);
    }
    function onReady() {
      if (ready) return;
      ready = true;
      for (const n of pending) if (n.isConnected) set(n, n.dataset.tex, !!n.dataset.disp);
      pending.clear();
    }
    // MathJax costs 2–7 ms per new formula: during continuous input, typeset once input has paused for ms
    const held = new Map();
    let hushT = 0;
    function hush(ms = 150) {
      clearTimeout(hushT);
      hushT = setTimeout(() => {
        hushT = 0;
        const jobs = [...held];
        held.clear();
        for (const [n, [t, d]] of jobs) if (n.isConnected) set(n, t, d);
      }, ms);
    }
    return { set, onReady, hush, get ready() { return ready; } };
  })();
  window.__mjReady = () => TeX.onReady();

  // ---------------- theme ----------------
  // Every canvas color comes from a CSS token; readTheme() runs at start and on every theme change.
  let TH = {};
  const OLD_PALETTE = ['#2f6fdb', '#e0532f', '#169a68', '#8b55d8', '#cf9213', '#0e93a6', '#d4467e', '#61748a'];
  function readTheme() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => cs.getPropertyValue(n).trim();
    const hx = (n, d) => { const x = v(n); return /^#[0-9a-f]{6}/i.test(x) ? x.slice(0, 7) : d; };
    const num = (n, d) => { const x = parseFloat(v(n)); return Number.isFinite(x) ? x : d; };
    const plane = hx('--plane', '#fcfdfd');
    const rgb = GLR.hexRGB(plane);
    const dark = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2] < 0.5;
    const defC = ['#3B6FD4', '#CD821A', '#12938F', '#BC4E98', '#31983D', '#7F56C4', '#888D22', '#607183'];
    const c = defC.map((d, i) => ({ c0: hx(`--c${i + 1}`, d), edge: hx(`--c${i + 1}-edge`, d), alt: hx(`--c${i + 1}-alt`, d) }));
    TH = {
      dark, plane, planeRGB: rgb,
      ink: hx('--ink', '#121A20'), ink2: hx('--ink-2', '#3E4C56'), muted: hx('--muted', '#56646E'), faint: hx('--faint', '#8A969E'),
      line: hx('--line', '#D2DADE'), lineStrong: hx('--line-strong', '#B3BEC4'), surface: hx('--surface', '#FFFFFF'), panel: hx('--panel', '#F1F4F5'), well: hx('--well', '#E9EEF0'),
      accent: hx('--accent', '#0A6A87'), good: hx('--good', '#1B7A47'), warn: hx('--warn', '#8F5408'), error: hx('--error', hx('--err', '#B4231A')),
      gridMinor: hx('--grid-minor', '#E2EEF2'), gridMedium: hx('--grid-medium', '#D3E6ED'), gridMajor: hx('--grid-major', '#B5D4E0'),
      axis: hx('--axis', '#2E3D47'), label: hx('--axis-label', hx('--label', '#4A606C')), rulerTick: hx('--ruler-tick', '#3E4C56'),
      cut: hx('--cut', '#CC3311'), pole: hx('--pole', '#A0153E'), zero: hx('--zero', '#121A20'), probe: hx('--probe', '#121A20'), halo: hx('--halo', plane), fov: hx('--fov', '#2E3D47'),
      dcLine: hx('--dc-line', '#FFFFFF'), dcCasing: hx('--dc-casing', '#0B1114'),
      landTop: hx('--land-top', '#F5F8F9'), landBottom: hx('--land-bottom', '#DCE4E7'), landFloor: hx('--land-floor', '#FAFCFC'), landBox: hx('--land-box', '#B3BEC4'),
      landMod: hx('--land-mod-line', '#18232A'), landArg: hx('--land-arg-line', '#FFFFFF'), plaster: hx('--plaster', '#ECEEEC'), landShadow: hx('--land-shadow', '#2E3D47'),
      hemiSky: hx('--hemi-sky', '#E6EEF4'), hemiGround: hx('--hemi-ground', '#8C9296'),
      stretchShrink: hx('--stretch-shrink', '#2E69B2'), stretchGrow: hx('--stretch-grow', '#D79628'), stretchMid: hx('--stretch-mid', '#E9F0F2'),
      haloA: num('--halo-a', 0.85), fovA: num('--fov-a', 0.55), cursorA: num('--cursor-a', 0.35), dcLineA: num('--dc-line-a', 0.22), dcAxisA: num('--dc-axis-a', 0.7), landShadowA: num('--land-shadow-a', 0.3),
      c,
      mono: v('--f-mono') || 'ui-monospace, monospace', ui: v('--f-ui') || 'system-ui, sans-serif', math: v('--f-math') || 'Georgia, serif',
    };
    TH.inkRGB = GLR.hexRGB(TH.ink);
    TH.axisRGB = GLR.hexRGB(TH.axis);
    inkCache.clear();
    // a system theme change (Auto) restyles the chrome before we hear of it: settle its color transitions at once
    try { if (document.getAnimations) for (const a of document.getAnimations()) if (/color/.test(a.transitionProperty || '')) a.finish(); } catch (e) { /* ignore */ }
  }
  // ---- colors of a shape: preset index (tokens) or a custom hex with OKLCH-derived shades ----
  const inkCache = new Map();
  function hexToOklab(hex) {
    const [r, g, b] = GLR.hexRGB(hex).map((c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  }
  function oklchToHex(L, Cc, hh) {
    // reduce chroma until the color fits in sRGB (97% of the gamut limit)
    const conv = (C2) => {
      const a = C2 * Math.cos(hh), b = C2 * Math.sin(hh);
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
      const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
      return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
    };
    let lo = 0, hi = Cc;
    if (conv(Cc).some((x) => x < 0 || x > 1)) { for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (conv(mid).some((x) => x < 0 || x > 1)) hi = mid; else lo = mid; } Cc = lo * 0.97; }
    return '#' + conv(Cc).map((c) => { c = Math.min(1, Math.max(0, c)); const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(s * 255).toString(16).padStart(2, '0'); }).join('');
  }
  function shapeInk(s) {
    if (printInk) { const r = printInk(s); if (r) return r; }
    if (!s.color) return TH.c[(s.ci || 0) % 8];
    const key = s.color + TH.dark;
    let r = inkCache.get(key);
    if (!r) {
      const [L, a, b] = hexToOklab(s.color);
      const Cc = Math.hypot(a, b), hh = Math.atan2(b, a);
      r = TH.dark
        ? { c0: s.color, edge: oklchToHex(Math.min(0.97, L + 0.17), 0.8 * Cc, hh), alt: oklchToHex(Math.max(0.05, L - 0.15), 0.8 * Cc, hh) }
        : { c0: s.color, edge: oklchToHex(Math.max(0.05, L - 0.17), Cc, hh), alt: oklchToHex(Math.min(0.97, L + 0.18), 0.55 * Cc, hh) };
      inkCache.set(key, r);
    }
    return r;
  }
  const withAlpha = (hex, a) => hex + Math.round(Math.max(0, Math.min(1, a)) * 255).toString(16).padStart(2, '0');

  // ---------------- state ----------------
  const MESH_MIN = 80, MESH_MAX = 1920;
  // storage keys; a ?ns=name query (used by test tabs) gives a page its own namespace
  const NS = (() => { try { return new URLSearchParams(location.search).get('ns') || ''; } catch (e) { return ''; } })();
  const lsk = (k) => (NS ? `${k}:${NS}` : k);
  const LS_KEY = lsk('complex-map-workbench-v1');
  let S = null;
  // the whole state replaced (a saved session loaded, a reset, the tour's practice, an example's thumbnail drawn in a
  // scratch state): the one place S itself is reassigned (#20 phase 3, step 5)
  function setState(next) { S = next; }
  // a pane hidden or shown: side 'L' (the tools and X) or 'R' (Y and the chain); the caller lays out and saves
  function setHidden(side, on) { if (side === 'L') S.hideLeft = on; else S.hideRight = on; }
  // the selection in the chain (a step k >= 1, 'F', or null) and the focused step (0: the whole map): the bare writes;
  // setFocus (src/app/08-thumbnails-render.js) is the user's action, with its selection and redraw
  function setSel(v) { S.sel = v; }
  function setFocusStep(k) { S.focus = k; }
  function blankState() {
    return {
      shapes: [], steps: [], focus: 0, pattern: 'checker', lines: true, unit: true, snap: true,
      alpha: 0.85, meshN: 240, v4: true, hideLeft: false, hideRight: false, solo: null, dc: 'enhanced',
      patternScale: 1, hcap: 2.2, spin: false, dcGrid: 0.5, morphSecs: 1.6, homAll: false, height: 'log', outline: true,
      srcView: { cx: 0, cy: 0, s: 60 }, nextId: 1,
      // w-plane targets, drawn in the right plane in Image mode; their preimages show in the left plane in every
      // mode (none by default); the optional Riemann sphere view of the left plane; Landscape: all sheets of a
      // multivalued map (S.sheets) with a window of 2W + 1 sheets for log and irrational powers (S.sheetW)
      targets: [], sheets: false, sheetW: 2, v5: true,
      // U-b: the left pane is X (domain of the map in focus), the right pane Y (its codomain), each with its own
      // surface; Phase paints X (Views in view.js; old saves are migrated by Views.migrate). wKey: the colour key of
      // the phase portrait painted in the Y plane (the Key switch in X's legend chip). landPlain: the relief paints
      // Plain whatever the style (an old landscape's default 'phase' material, kept without rewriting dc; cleared
      // when a style is picked)
      view: Views.blank(), v6: true, wKey: false, landPlain: false,
      // exact images (SPEC 10.1): mapped areas drawn per pixel through the inverse of the chain where it has one; an
      // internal switch (no visible option), kept in saved state
      exactImages: true,
      // v15: the shared numbers (src/params.js; constructions/DESIGN.md 1.5)
      params: [],
    };
  }
  // target colors skip c4 (magenta), the palette ink nearest the pole color: roots must not read as poles
  const TARGET_CI = [5, 2, 6, 0, 4, 7, 1];
  const V = { left: { cx: 0, cy: 0, s: 60 }, right: { cx: 0, cy: 0, s: 60 } };
  let rightAuto = true, leftAuto = true;
  let selected = null;
  let tool = 'select';
  let draft = null;
  // [v16.5 UX09, UX14] the last press on a plane was a finger (or a pen): larger handles, grab and close radii
  let ptrTouch = null;
  let probe = null; // {z (in left plane)}
  // the deformation transport (open: the right plane shows the homotopy at T in every view; closed: t = end)
  const morph = { T: 0, playing: false, last: 0, hold: 0, open: false };

  // undo history of {s: shapes, steps and nextId as JSON, focus}. The focus of the current entry follows
  // the live focus at the start of every user input (noteFocus), so undo returns to the step focused before the action.
  let hist = [], hi = -1;
  let exAt = -1;   // (v16.5 UX25: the history entry an example opened at; the Examples button names it until an edit)
  // (v16: and the deformation's bracket, S.homRange, normalised first; moving it is not an undo step)
  const rangeCopy = () => { if (S.homRange) HR.resolve(S, true); return S.homRange ? JSON.parse(JSON.stringify(S.homRange)) : null; };
  const snap = () => ({ s: JSON.stringify({ shapes: S.shapes, steps: S.steps, nextId: S.nextId, targets: S.targets, params: S.params || [] }), focus: S.focus, range: rangeCopy() });
  function noteFocus() { if (S && hist[hi]) { hist[hi].focus = S.focus; hist[hi].range = rangeCopy(); } }
  function commit() {
    const e = snap();
    if (hist[hi] && hist[hi].s === e.s) { hist[hi].focus = e.focus; hist[hi].range = e.range; return; }
    hist = hist.slice(0, hi + 1);
    hist.push(e);
    if (hist.length > 200) hist.shift();
    hi = hist.length - 1;
    dismissUndoToast();
    updateUndo(); exLabelSync();
    save();
  }
  function restore(e) {
    const o = JSON.parse(e.s), was = S.steps;
    S.shapes = o.shapes; S.steps = o.steps; S.nextId = o.nextId;
    Funcs.typedKeep(was, S.steps); // (Russian: a list text typed and refused stays refused after an undo: verify-1)
    S.targets = Array.isArray(o.targets) ? o.targets : [];
    S.params = Array.isArray(o.params) ? o.params : [];
    bindsAll();
    paramsRestored();
    // shapes that no longer exist give back their GPU meshes, lines and map caches
    const keep = new Set(S.shapes.map((x) => x.id));
    for (const id of [...gpu.keys()]) if (!keep.has(id)) dropShapeGPU(id);
    if (selected && !keep.has(selected) && !S.targets.some((x) => x.id === selected)) selected = null;
    zpSel = null; zpHover = null;
    const f = Math.max(0, Math.min(S.steps.length, e.focus | 0)), refocus = f !== S.focus;
    setFocusStep(f);
    if (e.range && typeof e.range === 'object') S.homRange = JSON.parse(JSON.stringify(e.range)); else delete S.homRange;
    dismissUndoToast();
    chainChanged(true); shapesChanged(true);
    if (refocus) setFocus(f);
    HR.resolve(S, true); buildDock(); updateBracket();
    updateUndo(); exLabelSync(); save(); histSay();
  }
  // [v16.5 UX14, UX15] an open polygon's points and a construction's own picks are undone first, one at a time
  const polyDraftOpen = () => !!(draft && draft.kind === 'polygon' && draft.pts && draft.pts.length);
  const draftUndoable = () => polyDraftOpen() || !!Construct.undoPickable();
  // ([v16.5 fix regress-7] it runs in every overlay frame (a pick or a polygon point changes Undo): the buttons are
  // touched only when what they show changed)
  let undoKey = '';
  function updateUndo() {
    const u = hi <= 0 && !draftUndoable(), r = hi >= hist.length - 1, k = (u ? 1 : 0) + '|' + (r ? 1 : 0);
    if (k === undoKey) return;
    undoKey = k;
    const ub = $('undoBtn'), rb = $('redoBtn');
    if (ub && ub.disabled !== u) ub.disabled = u;
    if (rb && rb.disabled !== r) rb.disabled = r;
  }
  // the last point of an open polygon goes (Undo, Backspace); the draft goes with its last point
  function polyBack() {
    if (!polyDraftOpen()) return false;
    draft.pts.pop();
    if (draft.cmAt && typeof draft.cmAt === 'object') delete draft.cmAt[draft.pts.length];
    if (!draft.pts.length) draft = null;
    requestRender('OL', 'OR', lGlobe() ? 'L' : null, rGlobe() ? 'R' : null);
    updateUndo();
    return true;
  }
  let saveT = 0, storageWarned = false;
  let figureSwap = false;   // v15: a link or a scene was written for the reload that opens it (nothing else is saved)
  // ([v16.5 check app-1, app-2] the header search's words are never cut: where its field is too narrow for them (an
  // example's name beside Examples, Italian's longer label, "Ctrl K"), it shows its short label (Russian, Italian) when
  // that fits, else its icon and shortcut alone (named by its aria-label and tooltip), and the example's name takes the
  // room. Measured in a frame when the header's width, the example's name or the fonts change; a phone has no field)
  let hdrFitRaf = 0;
  function hdrFit() {
    hdrFitRaf = 0;
    const f = $('cmdBtn'), top = f && f.closest('.top');   // (its parent is the phone's menu, display: contents here)
    if (!top) return;
    top.classList.remove('cmd-short', 'cmd-cut', 'share-icon');
    if (document.documentElement.classList.contains('ph')) return;
    const t = f.querySelector('.cmd-text');
    const cut = () => !!t && t.clientWidth > 0 && t.scrollWidth > t.clientWidth + 0.5;
    if (cut()) {
      if (f.querySelector('.ct-s')) top.classList.add('cmd-short');
      if (!f.querySelector('.ct-s') || cut()) { top.classList.remove('cmd-short'); top.classList.add('cmd-cut'); }
    }
    // ([v17 D5] then Share's word gives way, while Examples' own word or the field is squeezed, or the bar overflows)
    const ex = $('examplesBtn');
    const tight = () => top.scrollWidth > top.clientWidth + 0.5 || f.scrollWidth > f.clientWidth + 1 || (!!ex && ex.scrollWidth > ex.clientWidth + 1);
    if (tight()) top.classList.add('share-icon');
  }
  const hdrFitSoon = () => { if (!hdrFitRaf) hdrFitRaf = requestAnimationFrame(hdrFit); };
  function hdrFitInit() {
    const f = $('cmdBtn'), top = f && f.closest('.top'), xl = document.querySelector('#examplesBtn .exlabel');
    if (!top) return;
    new ResizeObserver(hdrFitSoon).observe(top);
    if (xl) new MutationObserver(hdrFitSoon).observe(xl, { childList: true, characterData: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(hdrFitSoon);
    hdrFitSoon();
  }
  // (v16.5 UX25: the open example's name shows after Examples until the first edit; exAt is the entry it opened at)
  function exLabelSync() {
    const xl = document.querySelector('#examplesBtn .exlabel');
    if (xl) xl.classList.toggle('stale', hi !== exAt);
  }
  // (v16.5 UX79) what one undo step did, in words, from its two snapshots: "add f₃ Sine", "add pole p₂ of f₁",
  // "delete Disc 1", "change a"; '' when it cannot be said briefly
  function histWhat(a, b) {
    if (!a || !b) return '';
    let A, B;
    try { A = JSON.parse(a.s); B = JSON.parse(b.s); } catch (e) { return ''; }
    const js = JSON.stringify, sa = A.steps || [], sb = B.steps || [], nm = (st) => defOf(st).label;
    if (sb.length !== sa.length) {
      const more = sb.length > sa.length, L = more ? sb : sa, Sh = more ? sa : sb, n = L.length - Sh.length;
      let i = 0;
      while (i < Sh.length && js(Sh[i]) === js(L[i])) i++;
      if (n === 1) return more ? $t('add f{x} {name}', { x: sub(i + 1), name: nm(L[i]) }) : $t('remove f{x} {name}', { x: sub(i + 1), name: nm(L[i]) });
      return more ? $t('add f{x}–f{x2}', { x: sub(i + 1), x2: sub(i + n) }) : $tn('remove {n} step', 'remove {n} steps', n, { n });
    }
    const diff = [];
    sa.forEach((st, i) => { if (js(st) !== js(sb[i])) diff.push(i); });
    if (diff.length > 1 && sa.map((x) => js(x)).sort().join('|') === sb.map((x) => js(x)).sort().join('|')) return $t('reorder the steps');
    if (diff.length === 1) {
      const i = diff[0], x = sa[i], y = sb[i], f = sub(i + 1);
      if (x.type !== y.type) return $t('replace f{x} with {name}', { x: f, name: nm(y) });
      if ((x.on === false) !== (y.on === false)) return y.on === false ? $t('bypass f{x}', { x: f }) : $t('turn f{x} back on', { x: f });
      if (y.type === 'zp') {
        const cnt = (st, kind) => (String(st.params[kind] || '').trim() ? Funcs.splitList(st.params[kind]).length : 0);
        for (const kind of ['zeros', 'poles']) {
          const ca = cnt(x, kind), cb = cnt(y, kind), z = kind === 'zeros';
          if (cb > ca) return z ? $t('add zero ζ{i} of f{x}', { i: sub(cb), x: f }) : $t('add pole p{i} of f{x}', { i: sub(cb), x: f });
          if (cb < ca) return z ? $t('remove a zero of f{x}', { x: f }) : $t('remove a pole of f{x}', { x: f });
        }
        if (String(x.params.zeros) !== String(y.params.zeros)) return $t('move a zero of f{x}', { x: f });
        if (String(x.params.poles) !== String(y.params.poles)) return $t('move a pole of f{x}', { x: f });
      }
      return $t('change f{x} {name}', { x: f, name: nm(y) });
    }
    if (diff.length) return $t('change the chain');
    const pa = new Map((A.params || []).map((q) => [q.name, q])), pb = new Map((B.params || []).map((q) => [q.name, q]));
    const dn = (n) => Params.display(n);
    for (const n of pb.keys()) if (!pa.has(n)) return $t('add the number {x}', { x: dn(n) });
    for (const n of pa.keys()) if (!pb.has(n)) return $t('delete the number {x}', { x: dn(n) });
    for (const n of pb.keys()) if (js(pa.get(n)) !== js(pb.get(n))) return $t('change {x}', { x: dn(n) });
    const namesA = shapeNames(A.shapes || []), namesB = shapeNames(B.shapes || []);
    for (const key of ['shapes', 'targets']) {
      const ma = new Map((A[key] || []).map((q) => [q.id, q])), mb = new Map((B[key] || []).map((q) => [q.id, q]));
      const nameOf = (q) => namesB.get(q.id) || namesA.get(q.id) || (Region.KINDS[q.kind] ? Region.KINDS[q.kind].label : String(q.kind));
      // ([v16.5 check app-8] the unit circle or an axis made a shape for a point put on it goes with that point: one
      // undo step "add z0", not "add 2 shapes")
      const disp = (q) => !!(q && q.fixed && !q.def && !q.at);
      const only = (ids, m) => { const own = ids.filter((id) => !disp(m.get(id))); return own.length && own.length < ids.length ? own : ids; };
      const add = only([...mb.keys()].filter((id) => !ma.has(id)), mb), del = only([...ma.keys()].filter((id) => !mb.has(id)), ma);
      const ch = [...mb.keys()].filter((id) => ma.has(id) && js(ma.get(id)) !== js(mb.get(id)));
      if (add.length === 1 && !del.length) return $t('add {name}', { name: nameOf(mb.get(add[0])) });
      if (del.length === 1 && !add.length) return $t('delete {name}', { name: nameOf(ma.get(del[0])) });
      if (add.length > 1 && !del.length) return $tn('add {n} shape', 'add {n} shapes', add.length, { n: add.length });
      if (del.length > 1 && !add.length) return $tn('delete {n} shape', 'delete {n} shapes', del.length, { n: del.length });
      if (ch.length === 1 && !add.length && !del.length) return $t('edit {name}', { name: nameOf(mb.get(ch[0])) });
      if (add.length || del.length || ch.length) return $t('change the shapes');
    }
    return '';
  }
  // which of Undo and Redo is running: every way in (the buttons, the keys, the phone's Undo, a toast) clicks #undoBtn or
  // #redoBtn, so a capturing listener notes it before their own listeners restore an entry, and it is cleared after them
  let histDir = '';
  document.addEventListener('click', (e) => { const b = e.target && e.target.closest ? e.target.closest('#undoBtn, #redoBtn') : null; histDir = b ? b.id : ''; }, true);
  document.addEventListener('click', () => { histDir = ''; });
  // restore() ends here: an undo or a redo says what it did
  function histSay() {
    const d = histDir;
    histDir = '';
    if (d === 'undoBtn' && hist[hi + 1]) histToast(histWhat(hist[hi], hist[hi + 1]), true);
    else if (d === 'redoBtn' && hi > 0) histToast(histWhat(hist[hi - 1], hist[hi]), false);
  }
  // the Undo and Redo tooltips name the action, set when the pointer or the keyboard reaches them
  document.addEventListener('pointerover', (e) => { const b = e.target && e.target.closest ? e.target.closest('#undoBtn, #redoBtn') : null; if (b) undoTip(b.id === 'undoBtn'); });
  document.addEventListener('focusin', (e) => { if (e.target && (e.target.id === 'undoBtn' || e.target.id === 'redoBtn')) undoTip(e.target.id === 'undoBtn'); });
  // the toast after an undo or a redo: what it did, and the way back (Redo is visible on a phone too)
  function histToast(what, undo) {
    const at = hi;
    const msg = undo ? (what ? $t('Undid: {what}.', { what }) : $t('Undone.')) : (what ? $t('Redid: {what}.', { what }) : $t('Redone.'));
    toast(msg, undo ? $t('Redo') : $t('Undo'), () => { if (hi === at) $(undo ? 'redoBtn' : 'undoBtn').click(); }, true, { ms: 4000 });
  }
  // the Undo and Redo tooltips name the action ("Undo: add f₃ Sine  ⌘Z"), set when the pointer or the keyboard comes
  function undoTip(undo) {
    const b = $(undo ? 'undoBtn' : 'redoBtn');
    if (!b) return;
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const what = undo ? (hi > 0 ? histWhat(hist[hi - 1], hist[hi]) : '') : (hi < hist.length - 1 ? histWhat(hist[hi], hist[hi + 1]) : '');
    const key = undo ? (mac ? '⌘Z' : 'Ctrl Z') : (mac ? '⇧⌘Z' : 'Ctrl Y');
    const t = (what ? (undo ? $t('Undo: {what}', { what }) : $t('Redo: {what}', { what })) : (undo ? $t('Undo') : $t('Redo'))) + '  ' + key;
    b.removeAttribute('title');
    if (b.dataset.tip !== t) b.dataset.tip = t;
  }
  // the panels the user chose at docked widths; narrow windows close the drawers at run time only
  const dockPref = { L: false, R: false };
  const noRuntime = (k, v) => (typeof k === 'string' && k[0] === '_' ? undefined : v);
  // (v16 review regress-1) noRuntime, and the uid and zero ids of steps no shape refers to are left out of saves,
  // links and scene files, so a scene without constructions saves the same bytes as in v15.1
  const cmSaveReplacer = (o) => (Constr.idReplacer ? Constr.idReplacer(o) : noRuntime);
  function writeState() {
    clearTimeout(saveT); saveT = 0;
    if (!S || tourHold || figureSwap) return null;
    if (S.homRange) HR.resolve(S, true);   // (v16: the bracket's indices current, SPEC 7)
    // the points carry their numbers in every save (a first-run scene has none yet; a load would give them the same
    // numbers, so the saved work comes back as it was written)
    numberPoints();
    const out = Object.assign({}, S, { hideLeft: dockPref.L, hideRight: dockPref.R, rightView: rightAuto ? null : { cx: V.right.cx, cy: V.right.cy, s: V.right.s } });
    // (v15.1: the phone's inset draws its plane's view smaller; the saved view is the one the plane shows large,
    // build/phone-swap.md)
    if (Phone.largeView) {
      const lv = Phone.largeView('L'), rv = Phone.largeView('R');
      if (lv && leftStage() === 0) out.srcView = Object.assign({}, S.srcView, lv);
      if (rv && out.rightView) out.rightView = rv;
    }
    // run-time fields of shapes (s._err: a shape's current error) are not state
    // (returns what it wrote, false when storage refused it: the language switch reloads only on a written save)
    let json;
    try { json = JSON.stringify(out, cmSaveReplacer(out)); localStorage.setItem(LS_KEY, json); return json; } catch (e) { warnStorage(); return false; }
  }
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(writeState, 300);
  }
  function warnStorage() {
    if (storageWarned) return;
    storageWarned = true;
    // wait for a toast that offers Undo, so this note never replaces it
    const show = () => { const th = $('toastHost'); if (th && th.querySelector('.toast[data-undo]')) { setTimeout(show, 1500); return; } toast($t('Changes are not being saved: this browser blocks site storage.')); };
    show();
  }
  let loadDropped = 0;
  function load() {
    let o;
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      o = JSON.parse(raw);
    } catch (e) { return null; }
    try { return sanitizeState(o); } catch (e) { console.warn('Saved state ignored', e); return null; }
  }
  // A saved state may come from another build or be damaged: keep only steps, shapes and settings this build can show.
  const isNum = (x) => typeof x === 'number' && Number.isFinite(x);
  const isXY = (p) => Array.isArray(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]);
  function shapeOk(s) {
    if (s.kind === 'formula' || s.kind === 'fcurve') return typeof s.expr === 'string';
    if (s.kind === 'curve' || s.kind === 'polygon') return Array.isArray(s.pts) && s.pts.length >= (s.kind === 'polygon' ? 3 : 2) && s.pts.every(isXY);
    const t = Region.defaultsFor(s.kind, C(0, 0), C(1, 1));
    return Object.keys(t).every((k) => (Array.isArray(t[k]) ? isXY(s[k]) : isNum(s[k])));
  }
  function sanitizeState(o) {
    if (!o || typeof o !== 'object' || !Array.isArray(o.shapes) || !Array.isArray(o.steps)) return null;
    if (!o.v3) { o.meshN = 240; o.v3 = true; }
    if (!o.v4) {
      o.v4 = true; o.alpha = 0.85; o.meshN = 240;
      for (const sh of o.shapes) { if (!sh || typeof sh !== 'object') continue; const i = OLD_PALETTE.indexOf(sh.color); if (i >= 0) { sh.ci = i; delete sh.color; } else if (!sh.color) sh.ci = sh.ci || 0; }
    }
    if (o.pattern === 'hue') o.pattern = 'phase';
    delete o.quality;
    let dropped = 0;
    const steps = [];
    for (const st of o.steps) {
      const d = st && typeof st === 'object' && Funcs.DEFS[st.type];
      if (!d) { dropped++; continue; }
      const p = st.params && typeof st.params === 'object' && !Array.isArray(st.params) ? st.params : {};
      const params = Funcs.defaults(st.type);
      for (const [key, v] of Object.entries(p)) {
        const q = d.params.find((x) => x.key === key);
        const num = (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && Number.isFinite(Number(v));
        if (!q) { if (num || typeof v === 'string') params[key] = v; continue; }
        if (q.type === 'choice') { if (q.choices.some((c) => c[0] === v)) params[key] = v; } else if (q.type === 'int' || q.type === 'angle') { if (num) params[key] = Number(v); } else if (typeof v === 'string' || isNum(v)) params[key] = String(v);
      }
      steps.push({ type: st.type, params, on: st.on !== false });
      if (typeof st.uid === 'string') steps[steps.length - 1].uid = st.uid;   // (v16: step uids and zero ids)
      if (st.zpIds && typeof st.zpIds === 'object') steps[steps.length - 1].zpIds = st.zpIds;
      if (st.zpNums && typeof st.zpNums === 'object') steps[steps.length - 1].zpNums = st.zpNums;   // ([UX54] checked by Constr.syncSteps)
    }
    const shapes = [], targets = [], ids = new Set();
    let maxId = 0;
    // the domain's shapes and the w-plane targets share one id space (the selection names either)
    const clean = (list, out) => {
      for (const sh of list) {
        if (!sh || typeof sh !== 'object' || !Region.KINDS[sh.kind] || !shapeOk(sh)) { dropped++; continue; }
        const id = typeof sh.id === 'string' && sh.id && !ids.has(sh.id) ? sh.id : null;
        if (id) { ids.add(id); const m = /^s(\d+)$/.exec(id); if (m) maxId = Math.max(maxId, +m[1]); }
        sh.id = id;
        for (const k of ['n', 'nc', 'nr']) if (k in sh) sh[k] = Math.max(1, Math.min(60, Math.round(sh[k])));
        sh.visible = sh.visible !== false;
        sh.ci = Number.isInteger(sh.ci) ? ((sh.ci % 8) + 8) % 8 : out.length % 8;
        if (typeof sh.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(sh.color)) delete sh.color;
        if ('complement' in sh) sh.complement = !!sh.complement;
        if ('label' in sh && typeof sh.label !== 'string') delete sh.label;
        if ('undef' in sh && typeof sh.undef !== 'string') delete sh.undef;
        if ('undefHid' in sh) { if (sh.undefHid && sh.undef) sh.undefHid = true; else delete sh.undefHid; }
        // v15: fields written as formulas of the shared numbers (the fields keep their last values)
        if ('bind' in sh) { const b = sh.bind && typeof sh.bind === 'object' && !Array.isArray(sh.bind) ? sh.bind : {}; sh.bind = {}; for (const [k, v] of Object.entries(b)) if (typeof v === 'string' && v.trim() && (k === 'expr' || k in sh)) sh.bind[k] = v.slice(0, 2000); if (!Object.keys(sh.bind).length) delete sh.bind; }
        out.push(sh);
      }
    };
    clean(o.shapes, shapes);
    // earlier builds kept a default target (the point 0, id t0) that only the Preimage view showed; targets now
    // show their preimages in every view, so that untouched default is dropped
    if (Array.isArray(o.targets)) {
      if (!o.v5) o.targets = o.targets.filter((t) => !(t && t.id === 't0' && t.kind === 'point' && Array.isArray(t.p) && t.p[0] === 0 && t.p[1] === 0 && !t.label));
      clean(o.targets, targets);
    }
    let next = Math.max(isNum(o.nextId) ? Math.floor(o.nextId) : 1, maxId + 1);
    for (const sh of shapes.concat(targets)) if (!sh.id) { while (ids.has('s' + next)) next++; sh.id = 's' + next++; ids.add(sh.id); }
    o.shapes = shapes; o.steps = steps; o.nextId = next; o.targets = targets;
    cmLoad(o);   // (v16 constructions: refs, fallbacks, one recompute)
    numberPoints(shapes);
    // the views of earlier builds (rightMode, sphereMode, leftSphere, material, spherePlane) -> o.view (panels.md 10)
    Views.migrate(o);
    const b = blankState();
    const st = Object.assign(b, o);
    const d0 = blankState();
    st.focus = Number.isInteger(st.focus) ? Math.max(0, Math.min(steps.length, st.focus)) : 0;
    // (v16 deformation range, SPEC 7) {a, b, ua, ub}: integers 1 <= a <= b <= steps, ua and ub strings or null. The saved
    // indices are current (writeState resolves first) and a save leaves out the uids of steps no shape refers to, so the
    // ends are taken by index and given the loaded steps' uids; the normal form follows at the first read
    if ('homRange' in st) {
      const r = st.homRange, okU = (u) => u === undefined || u === null || typeof u === 'string';
      if (r && typeof r === 'object' && Number.isInteger(r.a) && Number.isInteger(r.b) && r.a >= 1 && r.a <= r.b && r.b <= steps.length && okU(r.ua) && okU(r.ub)) {
        const uid = (k) => (steps[k - 1] && typeof steps[k - 1].uid === 'string' ? steps[k - 1].uid : undefined);
        const o2 = { a: r.a, b: r.b }, ua = r.a === 1 ? null : uid(r.a), ub = r.b === steps.length ? null : uid(r.b);
        if (ua !== undefined) o2.ua = ua;
        if (ub !== undefined) o2.ub = ub;
        st.homRange = o2;
      } else delete st.homRange;
    }
    // the Morph, Preimage and Integral views of earlier builds are now parts of every view: they open as Image
    // (F′ is a d/dz step of the chain now, so the old F | F′ switch is dropped)
    st.view = Views.clean(st.view);
    st.v6 = true;
    st.wKey = !!st.wKey;
    st.landPlain = !!st.landPlain;
    delete st.deriv;
    st.sheets = !!st.sheets;
    st.exactImages = st.exactImages !== false;
    st.params = Params.sanitize(o.params);
    st.sheetW = Number.isInteger(st.sheetW) ? Math.max(1, Math.min(4, st.sheetW)) : d0.sheetW;
    st.v5 = true;
    if (!PATTERNS.some((p) => p[0] === st.pattern)) st.pattern = d0.pattern;
    if (!DC_STYLES.some((p) => p[0] === st.dc)) st.dc = d0.dc;
    if (st.solo !== 'L' && st.solo !== 'R') st.solo = null;
    // enumerated settings: an unknown value (another build, a damaged save) falls back to the default
    // the straight-line homotopy is gone (2026-10-22): every save deforms along the natural paths; homAll: the steps
    // deform all at once (one t for every step) instead of one after another
    delete st.hom;
    st.homAll = st.homAll === true;
    if ('morphPaths' in st) st.morphPaths = st.morphPaths !== false;
    if (!['log', 'abs', 're', 'im'].includes(st.height)) st.height = d0.height;
    if ('sectors' in st && ![8, 12, 16, 24].includes(st.sectors)) delete st.sectors;
    if ('lscale' in st) { if (isNum(st.lscale)) st.lscale = Math.max(0.25, Math.min(2, st.lscale)); else delete st.lscale; }
    if ('fov' in st) st.fov = st.fov !== false;
    for (const k of ['lines', 'unit', 'snap', 'spin', 'outline', 'hideLeft', 'hideRight', 'compact', 'chev', 'unitLevel']) if (k in st) st[k] = !!st[k];
    // v15: the selected step or F (old saves: none, so the step shown alone or the last step)
    if (!(st.sel === 'F' || (Number.isInteger(st.sel) && st.sel >= 0 && st.sel <= st.steps.length))) st.sel = null;
    st.alpha = isNum(st.alpha) ? Math.max(0.2, Math.min(1, st.alpha)) : d0.alpha;
    st.patternScale = isNum(st.patternScale) && st.patternScale > 0 ? 2 ** Math.max(-2, Math.min(2, Math.round(Math.log2(st.patternScale)))) : 1;
    for (const k of ['hcap', 'dcGrid']) if (!isNum(st[k]) || st[k] <= 0) st[k] = d0[k];
    const okView = (v) => v && isNum(v.cx) && isNum(v.cy) && isNum(v.s) && v.s > 0;
    if (!okView(st.srcView)) st.srcView = d0.srcView;
    if (!okView(st.rightView)) st.rightView = null;
    const w = st.clipWin;
    if (w && !(isNum(w.x0) && isNum(w.x1) && isNum(w.y0) && isNum(w.y1) && w.x1 > w.x0 && w.y1 > w.y0)) delete st.clipWin;
    st.meshN = Math.max(MESH_MIN, Math.min(MESH_MAX, Math.round(+st.meshN) || 240));
    st.morphSecs = [3.2, 1.6, 0.8].reduce((a, c) => (Math.abs(c - st.morphSecs) < Math.abs(a - st.morphSecs) ? c : a), 1.6);
    loadDropped = dropped;
    return st;
  }

  // ---------------- chain ----------------
  let built = [];
  let chainSig = ['0'];
  // stage maps G_k as CPU functions of z (G_0 = id; a d/dz step k gives G_k = G_{k−1}′), rebuilt with the chain
  let stageFns = [];
  function rebuild() {
    built = S.steps.map((st) => Funcs.build(st));
    chainSig = ['0'];
    let acc = '';
    S.steps.forEach((st) => { acc += '|' + (st.on === false ? 'off' : JSON.stringify([st.type, st.params]) + paramSig(st)); chainSig.push(acc); });
    stageFns = null;
    if (typeof Funcs.stageFunctions === 'function') { try { stageFns = Funcs.stageFunctions(S.steps, built); } catch (e) { console.error('stageFunctions', e); stageFns = null; } }
    if (!Array.isArray(stageFns) || stageFns.length !== S.steps.length + 1) stageFns = localStageFunctions();
    if (GLR.ok) {
      try { GLR.setChain(GLChain.build(S.steps, built)); } catch (e) { console.error('GLChain', e); }
    }
  }
  const nSteps = () => S.steps.length;
  // a d/dz step: an operator on the chain so far (no function of its own input)
  const isDerivStep = (st, b) => !!st && (st.type === 'deriv' || !!(b && b.op === 'deriv'));
  function stepFn(k) {
    const st = S.steps[k - 1], b = built[k - 1];
    if (!st || st.on === false || !b || b.error || isDerivStep(st, b) || typeof b.f !== 'function') return null;
    return b.f;
  }
  // step k is a live d/dz step (bypassed or broken steps are the identity)
  function isDeriv(k) {
    const st = S.steps[k - 1], b = built[k - 1];
    return !!st && st.on !== false && !!b && !b.error && isDerivStep(st, b);
  }
  const stepActive = (k) => !!stepFn(k) || isDeriv(k);
  const derivIn = (a, b) => { for (let k = a + 1; k <= b; k++) if (isDeriv(k)) return true; return false; };
  // G′ by the 8-point circle formula (1/(N r)) Σ G(z + r ωʲ) ω^(−j): exact for polynomials of degree < 8, and it
  // nests (a second d/dz differentiates the first one's values)
  function circleDeriv(G) {
    const N = 8, W = Array.from({ length: N }, (_, j) => [Math.cos(TAU * j / N), Math.sin(TAU * j / N)]);
    return (z) => {
      const r = 1e-3 * (1 + Math.hypot(z.re, z.im));
      let sr = 0, si = 0;
      for (let j = 0; j < N; j++) {
        const [c, s] = W[j], w = G(C(z.re + r * c, z.im + r * s));
        sr += w.re * c + w.im * s; si += w.im * c - w.re * s;   // w · ω^(−j)
      }
      return C(sr / (N * r), si / (N * r));
    };
  }
  // the CPU stage maps when funcs.js has no Funcs.stageFunctions (same semantics, numeric derivatives)
  function localStageFunctions() {
    const out = [(z) => z];
    for (let k = 1; k <= S.steps.length; k++) {
      const prev = out[k - 1], f = stepFn(k);
      out.push(isDeriv(k) ? circleDeriv(prev) : f ? (z) => f(prev(z)) : prev);
    }
    return out;
  }
  function stageF(k) {
    const f = stageFns && stageFns[Math.max(0, Math.min(nSteps(), k))];
    return f || ((z) => z);
  }
  // the map from the plane of stage a to the plane of stage b (a > 0 only across steps that are not d/dz)
  function rangeF(a, b) {
    if (!a) return stageF(b);
    if (derivIn(a, b)) return () => C(NaN, NaN);
    const fs = [];
    for (let i = a + 1; i <= b; i++) { const f = stepFn(i); if (f) fs.push(f); }
    return (z) => { for (const f of fs) z = f(z); return z; };
  }
  const activeSteps = () => S.steps.map((_, i) => i + 1).filter((k) => stepActive(k));
  // a focused d/dz step differentiates a function of z: its input plane is the z-plane
  const focusDeriv = () => S.focus > 0 && isDeriv(S.focus);
  const leftStage = () => (S.focus === 0 || focusDeriv() ? 0 : S.focus - 1);
  const rightStage = () => (S.focus === 0 ? nSteps() : S.focus);
  // ---- the panes' views (U-b, panels.md 2): X on the left, Y on the right ----
  // lPlain: X Plane with the shapes (the plane of earlier builds' left pane); lColor: X Plane + Phase (the phase
  // portrait, earlier the right pane's Phase view); lGlobe: X Sphere (lPhase: with the portrait); lLand: X Landscape;
  // lFlat: X shows a plane in leftView() coordinates (drawing, rulers, flat overlays). rImage: Y Plane (the images,
  // the targets); rGlobe: Y Sphere.
  // (merged views, merged-views.md: X's picture follows the top bar's view: X → Y shows the shapes on X's Plane or
  // Sphere; Phase the portrait on its own Plane or Sphere (view.P); Landscape the relief, phase-coloured or plaster)
  const xSurf = () => { const v = S.view; return v.main === 'phase' ? v.P.surf : v.main === 'land' ? 'land' : v.L.surf; };
  const lPhase = () => S.view.main === 'phase' || (S.view.main === 'land' && !!S.view.D.phase);
  const lFlat = () => xSurf() === 'plane';
  const lPlain = () => S.view.main === 'xy' && S.view.L.surf === 'plane';
  const lColor = () => S.view.main === 'phase' && S.view.P.surf === 'plane';
  const lGlobe = () => xSurf() === 'sphere';
  const lLand = () => S.view.main === 'land';
  const rImage = () => S.view.R.surf === 'plane';
  const rGlobe = () => S.view.R.surf === 'sphere';
  // the Sphere's equatorial plane of X's globe (X → Y's z-sphere or the phase sphere)
  const xView = () => (S.view.main === 'phase' ? S.view.P : S.view.L);
  // the pane a merged view shows alone ('L': Phase, Landscape; 'R': X → Y with the deformation), else the expanded
  // pane of the split view (S.solo) or null
  const solo = () => Views.merged(S.view, morphOn()) || (S.view.main === 'xy' ? S.solo : null);
  // X paints F (the portrait, the landscape or the phase globe): it follows the homotopy while the transport is open
  const lPaintsF = () => lPhase() || lLand();
  // the landscape's material: Phase off is plaster; on, it paints Plain or Tiles (the styles the relief can paint, P10)
  const landMaterial = () => (!lPhase() ? 'plaster' : S.dc === 'phase' || S.landPlain ? 'phase' : 'tiles');
  // the function whose domain the left pane shows
  const focusF = () => (S.focus === 0 ? stageF(nSteps()) : focusDeriv() ? stageF(S.focus) : (stepFn(S.focus) || ((z) => z)));
  // its name: F, fₖ, or wₖ (a d/dz step's stage, a function of z)
  const fnText = () => (S.focus === 0 ? 'F' : focusDeriv() ? `w${sub(S.focus)}` : `f${sub(S.focus)}`);
  // Y's variable (P13): w at focus 0, w_k at focus k (the plane the map in focus lands in)
  const yHtml = () => (S.focus === 0 ? '<i>w</i>' : `<i>w</i>${sub(rightStage())}`);
  const fnHtml = () => (S.focus === 0 ? '<i>F</i>' : focusDeriv() ? `<i>w</i>${sub(S.focus)}` : `<i>f</i>${sub(S.focus)}`);

