'use strict';
(() => {
  const { C } = CX;
  const DEG = Math.PI / 180;
  const TAU = 2 * Math.PI;
  const $ = (id) => document.getElementById(id);
  function h(tag, attrs, ...kids) {
    const e = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.style.cssText = v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const k of kids.flat()) if (k != null && k !== false) e.append(k.nodeType ? k : document.createTextNode(String(k)));
    return e;
  }
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
    copy: svgI('<rect x="5.5" y="5.5" width="8" height="8" rx="1.5"/><path d="M10.5 5.5V3.75c0-.7-.55-1.25-1.25-1.25h-5.5c-.7 0-1.25.55-1.25 1.25v5.5c0 .7.55 1.25 1.25 1.25H5.5"/>'),
    check: svgI('<path d="M3.5 8.5l3 3 6-7"/>'),
    download: svgI('<path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10"/>'),
    sphere: svgI('<circle cx="8" cy="8" r="6"/><path d="M2 8a6 2.2 0 0 0 12 0"/><ellipse cx="8" cy="8" rx="2.4" ry="6"/>'),
    // the deformation's paths t -> H_t(z): a start dot, a curved path and its arrowhead
    paths: svgI('<circle cx="3.25" cy="12.25" r="1.4" fill="currentColor" stroke="none"/><path d="M3.25 12.25C4.5 7 8.5 4.25 13 4.25"/><path d="M10.25 2.25L13 4.25l-2.25 2.6"/>'),
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
        try { html = MathJax.tex2svg(tex, { display }).outerHTML; } catch (e) { html = null; }
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
    };
  }
  // target colors skip c4 (magenta), the palette ink nearest the pole color: roots must not read as poles
  const TARGET_CI = [5, 2, 6, 0, 4, 7, 1];
  const V = { left: { cx: 0, cy: 0, s: 60 }, right: { cx: 0, cy: 0, s: 60 } };
  let rightAuto = true, leftAuto = true;
  let selected = null;
  let tool = 'select';
  let draft = null;
  let probe = null; // {z (in left plane)}
  // the deformation transport (open: the right plane shows the homotopy at T in every view; closed: t = end)
  const morph = { T: 0, playing: false, last: 0, hold: 0, open: false };

  // undo history of {s: shapes, steps and nextId as JSON, focus}. The focus of the current entry follows
  // the live focus at the start of every user input (noteFocus), so undo returns to the step focused before the action.
  let hist = [], hi = -1;
  const snap = () => ({ s: JSON.stringify({ shapes: S.shapes, steps: S.steps, nextId: S.nextId, targets: S.targets }), focus: S.focus });
  function noteFocus() { if (S && hist[hi]) hist[hi].focus = S.focus; }
  function commit() {
    const e = snap();
    if (hist[hi] && hist[hi].s === e.s) { hist[hi].focus = e.focus; return; }
    hist = hist.slice(0, hi + 1);
    hist.push(e);
    if (hist.length > 200) hist.shift();
    hi = hist.length - 1;
    dismissUndoToast();
    updateUndo();
    save();
  }
  function restore(e) {
    const o = JSON.parse(e.s);
    S.shapes = o.shapes; S.steps = o.steps; S.nextId = o.nextId;
    S.targets = Array.isArray(o.targets) ? o.targets : [];
    // shapes that no longer exist give back their GPU meshes, lines and map caches
    const keep = new Set(S.shapes.map((x) => x.id));
    for (const id of [...gpu.keys()]) if (!keep.has(id)) dropShapeGPU(id);
    if (selected && !keep.has(selected) && !S.targets.some((x) => x.id === selected)) selected = null;
    zpSel = null; zpHover = null;
    const f = Math.max(0, Math.min(S.steps.length, e.focus | 0)), refocus = f !== S.focus;
    S.focus = f;
    dismissUndoToast();
    chainChanged(true); shapesChanged(true);
    if (refocus) setFocus(f);
    updateUndo(); save();
  }
  function updateUndo() { $('undoBtn').disabled = hi <= 0; $('redoBtn').disabled = hi >= hist.length - 1; }
  let saveT = 0, storageWarned = false;
  // the panels the user chose at docked widths; narrow windows close the drawers at run time only
  const dockPref = { L: false, R: false };
  const noRuntime = (k, v) => (typeof k === 'string' && k[0] === '_' ? undefined : v);
  function writeState() {
    clearTimeout(saveT); saveT = 0;
    if (!S) return;
    const out = Object.assign({}, S, { hideLeft: dockPref.L, hideRight: dockPref.R, rightView: rightAuto ? null : { cx: V.right.cx, cy: V.right.cy, s: V.right.s } });
    // run-time fields of shapes (s._err: a shape's current error) are not state
    try { localStorage.setItem(LS_KEY, JSON.stringify(out, noRuntime)); } catch (e) { warnStorage(); }
  }
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(writeState, 300);
  }
  function warnStorage() {
    if (storageWarned) return;
    storageWarned = true;
    // wait for a toast that offers Undo, so this note never replaces it
    const show = () => { const th = $('toastHost'); if (th && th.querySelector('.toast[data-undo]')) { setTimeout(show, 1500); return; } toast('Changes are not being saved: this browser blocks site storage.'); };
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
    // the views of earlier builds (rightMode, sphereMode, leftSphere, material, spherePlane) -> o.view (panels.md 10)
    Views.migrate(o);
    const b = blankState();
    const st = Object.assign(b, o);
    const d0 = blankState();
    st.focus = Number.isInteger(st.focus) ? Math.max(0, Math.min(steps.length, st.focus)) : 0;
    // the Morph, Preimage and Integral views of earlier builds are now parts of every view: they open as Image
    // (F′ is a d/dz step of the chain now, so the old F | F′ switch is dropped)
    st.view = Views.clean(st.view);
    st.v6 = true;
    st.wKey = !!st.wKey;
    st.landPlain = !!st.landPlain;
    delete st.deriv;
    st.sheets = !!st.sheets;
    st.exactImages = st.exactImages !== false;
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
    S.steps.forEach((st) => { acc += '|' + (st.on === false ? 'off' : JSON.stringify([st.type, st.params])); chainSig.push(acc); });
    stageFns = null;
    if (typeof Funcs.stageFunctions === 'function') { try { stageFns = Funcs.stageFunctions(S.steps, built); } catch (e) { console.error('stageFunctions', e); stageFns = null; } }
    if (!Array.isArray(stageFns) || stageFns.length !== S.steps.length + 1) stageFns = localStageFunctions();
    if (GLR.ok && typeof GLChain !== 'undefined') {
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
  const yText = () => (S.focus === 0 ? 'w' : `w${sub(rightStage())}`);
  const fnHtml = () => (S.focus === 0 ? '<i>F</i>' : focusDeriv() ? `<i>w</i>${sub(S.focus)}` : `<i>f</i>${sub(S.focus)}`);

  // ---------------- regions on the GPU ----------------
  let clipWin = { x0: -4, x1: 4, y0: -4, y1: 4 };
  const kindType = (s) => Region.KINDS[s.kind].type;
  const shapeKey = (s) => JSON.stringify([s.kind, s.p, s.a, s.b, s.c, s.m, s.r, s.r1, s.r2, s.t1, s.t2, s.pts, s.expr, s.complement, s.n, s.nc, s.nr]);
  const MESH_L = 4; // every base triangle is split into MESH_L^2 triangles on the GPU
  const fullRes = () => Math.max(10, Math.min(480, Math.round(S.meshN / MESH_L)));   // Max (1920): 480 base cells per side
  // The drag-time mesh cap (meshN 240 while a shape is moved or reshaped) applies only when the drag's frames would
  // leave the 60 fps budget (motion-vs-rest, minor finding: a capped mesh is a coarser look than the rest frame): when
  // the shape's last full-resolution mesh took more than DRAG_BUILD_MS to build (each drag frame rebuilds it), or once
  // two frames of this drag have run over the budget. The cap then holds until the drag ends (one look per gesture).
  const DRAG_BUILD_MS = 4, FRAME_BUDGET_MS = 14;   // compare_perf.py BUDGET60: a frame <= 14 ms
  function baseRes(s, r) {
    const full = fullRes();
    if (!(drag && (drag.mode === 'handle' || drag.mode === 'move'))) return full;
    const cap = Math.max(10, Math.round(240 / MESH_L));
    if (full <= cap) return full;
    if (!drag.capMesh && drag.shape === s && r && r.buildMs && r.buildMs[full] > DRAG_BUILD_MS) drag.capMesh = true;
    // (only the dragged shape: the others keep their meshes, and their looks, through the drag)
    return drag.capMesh && drag.shape === s ? cap : full;
  }
  const gpu = new Map(); // shape id -> {meshKey, mesh, meshRes, lineKey, lineRes, polys, refKey, fix: {L, R}, hold, live}
  function destroyFix(r) {
    for (const k of Object.keys(r.fix || {})) { const f = r.fix[k]; if (f && f.extraRes) GLR.destroy(f.extraRes); }
    r.fix = {};
  }
  // ---- the (mesh, fix-up) pairs on screen (motion-vs-rest causes 2 and 3) ----
  // A forward-drawn mesh is never shown without its fix-up while a fixed pair of the same shape exists:
  // - r.hold: the last complete pair {mesh, meshRes, meshKey, fix, fadeBox, skey, lref}. It is drawn for a role in place
  //   of a newer mesh whose fix-up for that role has not landed yet, when it shows the same shape (a re-centred clipWin,
  //   another base resolution) or the shape is being dragged (its live fix-up then lands within a frame or two).
  // - the strokes go with the fill drawn: a pair (the hold, a live job's mesh) names in lref the lineKey of the strokes
  //   it was drawn with; when the strokes are rebuilt (a drag move, a re-centre) the old ones are kept in r.lpool while
  //   a pair names them, and a hold is drawn with them (U-a review: the fill one position behind its outline in a drag).
  //   The new strokes are drawn once the current mesh is (fill and outline trail together, never apart).
  // - r.live: the dragged shape's fix-up job, advanced inside the motion frames (LIVE_SLICE ms per frame) instead of
  //   waiting for the pointer-up; a newer mesh does not cancel it: it finishes its own mesh, which becomes the hold,
  //   and the next job takes the newest mesh. After the pointer-up it runs on (r.liveTail) until the last mesh is fixed.
  // LIVE_SLICE ms per frame at least; more while the frame so far leaves room under LIVE_FRAME_MS (of the 14 ms 60 fps
  // budget), so a fix-up that fits lands in the frame that built its mesh and no hold frame is drawn (U-a review)
  const LIVE_SLICE = 4, LIVE_FRAME_MS = 9;
  let liveMsUsed = 0;   // the live fix-up time spent in this animation frame (frame() resets it)
  let frameStartT = -1e9;   // performance.now() at the start of the current animation frame
  const dragsShape = (s) => !!(drag && drag.shape === s && !drag.target && (drag.mode === 'move' || drag.mode === 'handle'));
  const liveOn = (s, r) => !!(r && (r.live || r.liveTail)) || dragsShape(s);
  function freePair(p) {
    if (!p) return;
    for (const k of Object.keys(p.fix || {})) { const f = p.fix[k]; if (f && f.extraRes) GLR.destroy(f.extraRes); }
    GLR.destroy(p.meshRes);
  }
  // the kept strokes no pair names any more are freed (all of them with all = true)
  function gcLines(r, all) {
    if (!r.lpool || !r.lpool.size) return;
    for (const [k, L] of [...r.lpool]) {
      if (!all && ((r.hold && r.hold.lref === k) || (r.live && r.live.lref === k))) continue;
      GLR.destroy(L.lineRes); r.lpool.delete(k);
    }
  }
  // the strokes to draw with the pair pm (from pairFor): the current ones, or the kept ones a hold was drawn with
  function linesOf(r, pm) {
    if (pm === r || !pm || pm.lref === undefined || pm.lref === r.lineKey) return r;
    const L = r.lpool && r.lpool.get(pm.lref);
    return L || r;
  }
  function dropHold(r) { const h = r.hold; r.hold = null; freePair(h); }
  function dropLive(r) {
    const j = r.live;
    r.live = null; r.liveTail = false;
    if (j && j.owned) freePair({ meshRes: j.meshRes, fix: j.fixDone });
  }
  // the current mesh is being replaced: keep it as the hold when it is complete, hand it to the live job that is fixing
  // it, or free it
  function retireMesh(r) {
    const job = r.live && !r.live.owned && r.live.meshKey === r.meshKey ? r.live : null;
    if (job) Object.assign(job, { owned: true, fixDone: r.fix, fadeBox: r.fadeBox, skey: r.skey });
    else if (r.meshRes && Object.values(r.fix || {}).some((f) => f && f.res && f.meshKey === r.meshKey)) {
      dropHold(r);
      r.hold = { mesh: r.mesh, meshRes: r.meshRes, meshKey: r.meshKey, fix: r.fix, fadeBox: r.fadeBox, skey: r.skey, lref: r.lineKey };
    } else { destroyFix(r); GLR.destroy(r.meshRes); }
    r.fix = {};
  }
  // the pair drawn for role: the current mesh with its fix-up, or the hold while the current one has none yet
  function pairFor(s, r, role) {
    const fx = role && r.fix[role] && r.fix[role].meshKey === r.meshKey ? r.fix[role] : null;
    const h = r.hold;
    if (fx || !role || !h || !h.fix[role] || !h.meshRes) return { p: r, fx };
    if (h.skey !== r.skey && !liveOn(s, r)) return { p: r, fx: null };
    // (a hold of another geometry whose strokes are gone is not drawn: a fill apart from its outline is worse)
    if (h.skey !== r.skey && h.lref !== r.lineKey && !(r.lpool && r.lpool.has(h.lref))) return { p: r, fx: null };
    return { p: h, fx: h.fix[role] };
  }
  // the roles whose fix-up of shape s is missing for its current mesh and map
  function liveNeeds(s, r) {
    const out = [];
    for (const tg of fixTargets()) {
      if (tg.need && !tg.need(s)) continue;
      const f = r.fix[tg.role];
      if (f && f.meshKey === r.meshKey && f.mapKey === tg.key) continue;
      out.push(tg);
    }
    return out;
  }
  function bindLive(r, job, res) {
    const make = (old) => {
      const fx = old && old.skip ? old : { meshKey: job.meshKey, skip: GLR.createSkip(job.meshRes, res.flags) };
      if (old && old.skip) GLR.setSkip(fx.skip, res.flags);
      if (fx.extraRes) GLR.destroy(fx.extraRes);
      fx.extraRes = res.extra.length ? GLR.createMesh(res.extra) : null;
      fx.mapKey = job.mapKey; fx.res = res;
      return fx;
    };
    if (!job.owned && job.meshKey === r.meshKey) {
      const old = r.fix[job.role];
      r.fix[job.role] = make(old && old.meshKey === r.meshKey ? old : null);
      // a hold that the current mesh now covers in every role it was drawn for is no longer needed
      if (r.hold && Object.keys(r.hold.fix).every((k) => r.fix[k] && r.fix[k].meshKey === r.meshKey)) dropHold(r);
    } else if (r.fix[job.role] && r.fix[job.role].meshKey === r.meshKey) {
      // the newest mesh already has its own fix-up for this role: the finished older pair is not needed
      freePair({ meshRes: job.meshRes, fix: job.fixDone });
    } else {
      // the job's mesh was replaced while it ran: the finished pair becomes the hold until the newest mesh has its own
      const fix = job.fixDone || {};
      const old = fix[job.role];
      fix[job.role] = make(old && old.meshKey === job.meshKey ? old : null);
      dropHold(r);
      r.hold = { mesh: job.mesh, meshRes: job.meshRes, meshKey: job.meshKey, fix, fadeBox: job.fadeBox || null, skey: job.skey, lref: job.lref };
    }
    gcLines(r);
    requestRender(job.role);
  }
  // advance the dragged shape's fix-up inside this frame (at most LIVE_SLICE ms per frame for all panes)
  function liveFix(s, r) {
    if (!GLR.ok || kindType(s) !== 'area') return;
    const dragging = dragsShape(s);
    if (dragging) r.liveTail = true;
    if (!r.liveTail && !r.live) return;
    const t0 = performance.now();
    for (;;) {
      if (!r.live) {
        const need = r.mesh && r.meshRes ? liveNeeds(s, r) : [];
        if (!need.length) { if (!dragging) r.liveTail = false; liveMsUsed += performance.now() - t0; return; }
        const tg = need[0];
        const budget = { ms: 0 };
        r.live = { role: tg.role, mapKey: tg.key, budget, gen: fixGen(r.mesh, tg.F, budget), mesh: r.mesh, meshRes: r.meshRes, meshKey: r.meshKey, skey: r.skey, lref: r.lineKey, owned: false };
      }
      const now = performance.now();
      const left = Math.max(LIVE_SLICE - liveMsUsed - (now - t0), LIVE_FRAME_MS - (now - frameStartT));
      if (left < 0.25) break;
      const job = r.live;
      job.budget.ms = left;
      let st;
      try { st = job.gen.next(); } catch (e) { console.error('live fix-up', e); dropLive(r); return; }
      job.ms = (job.ms || 0) + performance.now() - now; job.frames = (job.frames || 0) + 1;
      if (!st.done) break;
      r.liveStat = [+job.ms.toFixed(1), job.frames];
      r.live = null;
      bindLive(r, job, st.value);
    }
    liveMsUsed += performance.now() - t0;
    // not finished: the next frame goes on with it (also after the pointer-up, with no input to ask for frames)
    requestRender('L', 'R');
  }
  function dropShapeGPU(id) {
    lastPath.delete('R|' + id); lastPath.delete('L|' + id);
    smDropShape(id);
    const r = gpu.get(id);
    if (!r) return;
    destroyFix(r);
    dropHold(r); dropLive(r); gcLines(r, true);
    GLR.destroy(r.meshRes); GLR.destroy(r.lineRes);
    gpu.delete(id);
  }
  function dropAllGPU() { for (const id of [...gpu.keys()]) dropShapeGPU(id); }
  // o: curvesOf options ({reach: 'sphere'}: the settle-time refinement, SPEC 9.1; formula contours then carry the
  // stretched mesh's outer box, so the ones that end on it continue as rays)
  function sourceCurves(s, mesh, o) {
    let out = [];
    try { out = Region.curvesOf(s, clipWin, o); } catch (e) { out = []; }
    if (s.kind === 'formula' && mesh) {
      for (const c of mesh.contours) {
        const pc = Region.polyCurve(c.pts, false);
        if (pc && o && o.reach === 'sphere' && mesh.stretched && mesh.outer && !c.closed) Object.assign(pc, { outer: mesh.outer, openSides: mesh.open, cell: mesh.cell });
        if (pc) out.push(pc);
      }
    }
    return out;
  }
  // a usable meshing window: finite, positive size (a degenerate one, e.g. restored from old saved state, would
  // leave every unbounded shape without a mesh)
  const goodWin = (w) => !!w && w.x1 - w.x0 > 0 && w.y1 - w.y0 > 0 && Number.isFinite(w.x0 + w.x1 + w.y0 + w.y1);
  function shapeGPU(s) {
    if (!goodWin(clipWin)) { clipWin = viewBox(S.srcView); if (!goodWin(clipWin)) clipWin = { x0: -4, x1: 4, y0: -4, y1: 4 }; S.clipWin = clipWin; }
    let r = gpu.get(s.id);
    if (!r) { r = { fix: {} }; gpu.set(s.id, r); }
    const t = kindType(s);
    const sk = shapeKey(s);
    if (t === 'area') {
      const base = baseRes(s, r);
      let bb = null;
      try { bb = Region.bboxOf(s); } catch (e) { bb = null; }
      const ww = clipWin.x1 - clipWin.x0, wh = clipWin.y1 - clipWin.y0;
      const stretched = !bb || (bb.x1 - bb.x0) > 3 * ww || (bb.y1 - bb.y0) > 3 * wh;
      const key = sk + '|' + base + (stretched ? '|' + JSON.stringify(clipWin) : '');
      if (r.meshKey !== key) {
        let mesh = null;
        const tb = performance.now();
        try { mesh = Region.buildMesh(s, clipWin, base); s._err = null; } catch (err) { s._err = err.message; mesh = null; }
        // (the build time at each resolution: the drag-time cap reads the full-resolution one)
        (r.buildMs || (r.buildMs = {}))[base] = performance.now() - tb;
        retireMesh(r);
        r.mesh = mesh;
        r.meshKey = key;
        r.skey = sk;
        r.fadeBox = null;
        r.meshRes = mesh && mesh.tri.length && GLR.ok ? GLR.createMesh(Region.meshInstances(mesh)) : null;
        scheduleFix();
      }
      // a hold of another geometry is shown only while the shape's live fix-up runs
      if (r.hold && r.hold.skey !== sk && !liveOn(s, r)) dropHold(r);
    } else if (r.meshRes || r.mesh) {
      // a shape that is no longer an area (its id reused) gives back its mesh and map caches
      destroyFix(r); dropHold(r); dropLive(r); GLR.destroy(r.meshRes);
      r.meshRes = r.mesh = r.meshKey = null;
    }
    // a curve formula that no longer classifies as a curve (old saved state, a newer parser) says why in its row
    if (s.kind === 'fcurve') { try { Region.curveDesc(s); s._err = null; } catch (e) { s._err = e.message; } }
    if (t !== 'point') {
      const lkey = sk + '|' + JSON.stringify(clipWin) + (s.kind === 'formula' ? '|' + r.meshKey : '');
      if (r.lineKey !== lkey) {
        // a pair still on screen (the hold) or on its way to it (the live job's mesh) keeps the strokes it was drawn
        // with: fill and strokes then change together, when the new mesh's fix-up lands (a re-centred clipWin, a drag)
        if (r.lineKey !== undefined && ((r.hold && r.hold.lref === r.lineKey) || (r.live && r.live.lref === r.lineKey)) && !(r.lpool && r.lpool.has(r.lineKey))) {
          (r.lpool || (r.lpool = new Map())).set(r.lineKey, { lineRes: r.lineRes, lineKey: r.lineKey, open: r.open, lpolys: r.lpolys, lorigin: r.lorigin, arcs: r.arcs });
          r.lineRes = null;
        }
        const polys = sourceCurves(s, r.mesh).map((c) => Region.sampleCurve(c, clipWin)).filter((p) => p.length >= 4);
        // sent relative to the window centre (precision far from 0 and at deep zoom)
        const origin = [(clipWin.x0 + clipWin.x1) / 2, (clipWin.y0 + clipWin.y1) / 2];
        // P4 review: the refined samples (SPEC 9.1) are built right here when they fit the frame's budget (a shape
        // drag, a new clipWin after a left-plane pan or zoom, an edit), so motion frames and rest frames draw the same
        // strokes. Today's samples are drawn only when the refinement does not fit (the settle job then swaps it in).
        // r.polys keeps today's samples whatever is drawn: labels, chevrons, fits and hit tests read them (SPEC 9.1:
        // every other caller as today); r.lpolys holds the drawn ones (createLines order, dash arcs).
        const ref = refineNow(s, r, lkey, origin);
        const lp = ref ? ref.polys : polys;
        GLR.destroy(r.lineRes);
        r.lineRes = lp.length && GLR.ok ? GLR.createLines(lp, origin) : null;
        r.polys = polys; r.lpolys = lp; r.lorigin = origin;
        r.lineKey = lkey;
        r.lskey = sk;
        r.refKey = ref ? ref.key : undefined;
        r.arcs = null;
        r.open = t === 'area' && Region.isOpen(s);
        if (!ref) scheduleLines();
      }
    }
    gcLines(r);
    return r;
  }

  // ---------------- maps (what each view shows) ----------------
  const stageMap = (k) => ({ mode: 0, a: 0, b: k });
  // the focused map at t = end, on the left plane (a focused d/dz step's stage is a map of z)
  const endMap = () => (S.focus === 0 ? { mode: 0, a: 0, b: nSteps() } : focusDeriv() ? { mode: 0, a: 0, b: S.focus } : { mode: 0, a: S.focus - 1, b: S.focus });
  // what the right plane plots over the left plane (Phase, Landscape, the phase sphere): the focused map, or, while
  // the deformation transport is open, its homotopy at t
  const focusMap = endMap;
  // The deformation transport, for the renderer: null when closed. map/F: H_t as a map of the left plane (the plot
  // of Phase, Landscape and the phase sphere; map.base names that plane's stage when it is not the z-plane);
  // imageMap/imageF: H_t of the shapes' z-plane (Image, the regions sphere).
  function homView() {
    if (!morphOn()) return null;
    const r = morphState(true), a = morphState(false);
    return { map: r.map, F: r.F, key: r.key, t: morph.T, imageMap: a.map, imageF: a.F };
  }
  function morphRange() {
    if (S.focus > 0) return { steps: stepActive(S.focus) ? [S.focus] : [] };
    return { steps: activeSteps() };
  }
  const morphOn = () => morph.open && morphRange().steps.length > 0;
  // All at once (S.homAll): H_t = h_{n,t} o ... o h_{1,t} with one t in [0, 1] for every step (map mode 3); offered
  // for two or more steps without a d/dz (a d/dz is an operator on the chain, not a map with a homotopy of its own).
  // morphLen: the end of the transport's time, m steps one after another, or 1.
  const allAtOnce = () => !!S.homAll && morphRange().steps.length > 1 && !morphRange().steps.some((k) => isDeriv(k));
  const morphLen = () => (allAtOnce() ? 1 : morphRange().steps.length);
  // the primes of a point's label under the deformation: the steps begun (all of them at once for t > 0)
  const morphPrimes = () => (allAtOnce() ? (morph.T > 0 ? morphRange().steps.length : 0) : Math.ceil(morph.T)) + (S.focus > 0 ? S.focus - 1 : 0);
  const lerpF = (F0, F1, t) => (z) => { const a = F0(z), b = F1(z); return C((1 - t) * a.re + t * b.re, (1 - t) * a.im + t * b.im); };
  // the natural homotopy of step k at t, a map of its input plane (a straight line when the step has none: a constant
  // or a formula that is not recognisably a catalog map, funcs.js)
  function homF(k, t) {
    const b = built[k - 1];
    if (b && b.hom) return b.hom(t);
    const f = stepFn(k) || ((z) => z);
    return (z) => { const w = f(z); return C((1 - t) * z.re + t * w.re, (1 - t) * z.im + t * w.im); };
  }
  // GPU map spec, CPU function and a label for the current morph time. rel: the source points live in the plot's
  // own plane (the left plane, the input of a focused step: map.base = its stage) instead of the shapes' z-plane.
  // A d/dz step deforms along the straight line from G_{k−1} to G_k.
  function morphState(rel) {
    const { steps } = morphRange();
    const m = steps.length;
    const base = S.focus > 0 ? S.focus - 1 : 0;
    const end = S.focus > 0 ? S.focus : nSteps();
    const pb = rel ? leftStage() : 0;
    const src = (k) => rangeF(pb, k);
    const tag = (map) => { if (pb) map.base = pb; return map; };
    if (m === 0) return { map: tag({ mode: 0, a: pb, b: base }), F: src(base), label: 'no active steps', key: `none|${pb}|${base}` };
    if (allAtOnce()) {
      const t = Math.max(0, Math.min(1, morph.T));
      const F0 = src(base), Hs = steps.map((k) => homF(k, t));
      const F = (z) => { let w = F0(z); for (const H of Hs) w = H(w); return w; };
      return { map: tag({ mode: 3, a: base, b: end, t }), F, label: `all steps · t = ${t.toFixed(2)}`, key: `all|${pb}|${base}|${end}|${t}` };
    }
    const T = Math.max(0, Math.min(m, morph.T));
    const j = Math.min(m - 1, Math.floor(T));
    const t = T - j;
    const k = steps[j];
    const b = built[k - 1];
    const Fprev = src(k - 1);
    let F;
    if (isDeriv(k)) F = lerpF(Fprev, src(k), t);
    else { const Ht = homF(k, t); F = (z) => Ht(Fprev(z)); }
    return { map: tag({ mode: 1, hi: k, t }), F, label: `step ${k} · ${b && b.def ? b.def.label : ''} · t = ${t.toFixed(2)}`, key: `nat|${pb}|${k}|${t}` };
  }

  // ---------------- fix-ups: refine triangles that straddle cuts or touch poles ----------------
  // Runs on the CPU after interaction settles; a stale fix-up stays visually correct because the GPU
  // re-validates every refined triangle with the current map.
  const fixJob = { token: 0, timer: 0 };
  function scheduleFix() {
    clearTimeout(fixJob.timer);
    fixJob.token++;
    fixJob.timer = setTimeout(runFix, 160);
    scheduleLines();
  }
  // need(s): some visible consumer of the role draws shape s forward (SPEC 10.4: the flat pane and the globe of role
  // R, the left plane or the left globe of role L); a shape every consumer draws inverse (or is about to: pending)
  // needs no fix-up
  function fixTargets() {
    const out = [];
    const lk = leftStage();
    const needs = (map, role, kind) => (s) => pathOf(s, map, role, kind, { status: true }).path === 'forward';
    if (lk > 0 && solo() !== 'R') out.push({ role: 'L', F: stageF(lk), key: 'S' + chainSig[lk], need: needs(stageMap(lk), 'L', lGlobe() ? 'globe' : 'flat') });
    if (solo() !== 'L') {
      // (Y always shows the images: in its plane or on its globe)
      const imgs = true;
      const kind = rGlobe() ? 'globe' : 'flat';
      if (imgs && morphOn()) {
        if (!morph.playing) { const ms = morphState(false); out.push({ role: 'R', F: ms.F, key: 'M' + chainSig[nSteps()] + ms.key + S.focus, need: needs(ms.map, 'R', kind) }); }
      } else if (imgs && rightStage() > 0) {
        const k = rightStage();
        out.push({ role: 'R', F: stageF(k), key: 'S' + chainSig[k], need: needs(stageMap(k), 'R', kind) });
      }
    }
    return out;
  }
  const yieldNow = (ms = 0) => new Promise((r) => setTimeout(r, ms));
  // a yield between idle slices without the 4 ms clamp of nested setTimeout(0) (which held the SphereMesh driver at
  // about 40% duty: 3 ms of work per 7.6 ms): a background-priority task (scheduler.postTask: rendering and input run
  // first), else a MessageChannel message. Frames still render between slices.
  const yieldCh = typeof MessageChannel !== 'undefined' ? new MessageChannel() : null, yieldQ = [];
  if (yieldCh) yieldCh.port1.onmessage = () => { const r = yieldQ.shift(); if (r) r(); };
  const yieldTask = () => (typeof scheduler !== 'undefined' && scheduler && typeof scheduler.postTask === 'function'
    ? scheduler.postTask(() => {}, { priority: 'background' })
    : yieldCh ? new Promise((r) => { yieldQ.push(r); yieldCh.port2.postMessage(0); }) : yieldNow());
  // fix-ups never compete with motion: a homotopy, a view or camera tween, a drag or a playing morph
  const fixBusy = () => !!(trans.k || tweens.length || camTweens.length || drag || (morph.playing && morph.open));
  const FIX_SLICE = 5; // ms of work between yields (spec 8.3: idle slices of at most 6 ms)
  // the idle job: the fix-up of one mesh in FIX_SLICE ms slices, waiting out any motion between them; null when the
  // job went stale (fixJob.token moved on)
  async function computeFix(mesh, F, token) {
    const g = fixGen(mesh, F, { ms: FIX_SLICE });
    for (;;) {
      const st = g.next();
      if (st.done) return st.value;
      await yieldNow();
      while (fixBusy() && token === fixJob.token) await yieldNow(60);
      if (token !== fixJob.token) return null;
    }
  }
  // The fix-up computation as a generator: it yields (to its driver) whenever it has run for slice ms since it was
  // last resumed, and returns {flags, extra}. Two drivers: computeFix (the idle job above) and liveFix (the shape
  // being dragged, advanced inside its motion frames, so its fix-up keeps up with the drag).
  function* fixGen(mesh, F, slice) {
    const SRC = mesh.src, T = mesh.tri, nv = SRC.length / 2, nt = T.length / 3;
    const W = new Float64Array(nv * 2);
    let t0 = performance.now();
    const due = () => performance.now() - t0 > slice.ms;
    for (let i = 0; i < nv; i++) {
      const w = F(C(SRC[2 * i], SRC[2 * i + 1]));
      W[2 * i] = w.re; W[2 * i + 1] = w.im;
      if ((i & 63) === 63 && due()) { yield; t0 = performance.now(); }
    }
    const LIM = 1e12;
    const ok = (x, y) => Math.abs(x) < LIM && Math.abs(y) < LIM;
    const flags = new Float32Array(nt);
    const extra = [];
    let budget = 200000;
    const maxDepth = 5;
    // SPEC 8.1: trouble (the shape needs a SphereMesh): a vertex without a finite image, or a piece still failing the
    // midpoint test at depth 5 (view-independent: the mesh and the map only)
    let trouble = false;
    // depth-first subdivision of one bad triangle (up to 4^5 pieces) on an explicit stack, so the time slice is
    // checked inside it too
    const stack = [];
    function* refine(ax0, ay0, bx0, by0, cx0, cy0, wa0, wb0, wc0) {
      stack.length = 0;
      stack.push([ax0, ay0, bx0, by0, cx0, cy0, wa0, wb0, wc0, 0]);
      let n = 0;
      while (stack.length) {
        const [ax, ay, bx, by, cx, cy, wa, wb, wc, depth] = stack.pop();
        if (ok(wa.re, wa.im) && ok(wb.re, wb.im) && ok(wc.re, wc.im)) {
          const e = Math.max(Math.hypot(wa.re - wb.re, wa.im - wb.im), Math.hypot(wb.re - wc.re, wb.im - wc.im), Math.hypot(wc.re - wa.re, wc.im - wa.im));
          const wm = F(C((ax + bx + cx) / 3, (ay + by + cy) / 3));
          budget--;
          if (Math.hypot(wm.re - (wa.re + wb.re + wc.re) / 3, wm.im - (wa.im + wb.im + wc.im) / 3) <= 0.2 * e) {
            extra.push(ax, ay, bx, by, cx, cy);
            continue;
          }
        }
        if (depth >= maxDepth || budget <= 0) { trouble = true; continue; }
        const abx = (ax + bx) / 2, aby = (ay + by) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, cax = (cx + ax) / 2, cay = (cy + ay) / 2;
        const wab = F(C(abx, aby)), wbc = F(C(bcx, bcy)), wca = F(C(cax, cay));
        budget -= 3;
        // pushed in reverse, so the pieces are visited in the same order as the recursive version
        stack.push([abx, aby, bcx, bcy, cax, cay, wab, wbc, wca, depth + 1]);
        stack.push([cax, cay, bcx, bcy, cx, cy, wca, wbc, wc, depth + 1]);
        stack.push([abx, aby, bx, by, bcx, bcy, wab, wb, wbc, depth + 1]);
        stack.push([ax, ay, abx, aby, cax, cay, wa, wab, wca, depth + 1]);
        if ((++n & 15) === 0 && due()) { yield; t0 = performance.now(); }
      }
    }
    for (let t = 0; t < nt; t++) {
      const a = T[3 * t], b = T[3 * t + 1], c = T[3 * t + 2];
      const ax = W[2 * a], ay = W[2 * a + 1], bx = W[2 * b], by = W[2 * b + 1], cx = W[2 * c], cy = W[2 * c + 1];
      const nfin = (ok(ax, ay) ? 1 : 0) + (ok(bx, by) ? 1 : 0) + (ok(cx, cy) ? 1 : 0);
      let bad = nfin < 3;
      if (nfin < 3) trouble = true;
      if (nfin === 0) { flags[t] = 1; continue; } // entirely out of range: nothing to recover
      if (!bad) {
        const e = Math.max(Math.hypot(ax - bx, ay - by), Math.hypot(bx - cx, by - cy), Math.hypot(cx - ax, cy - ay));
        const wm = F(C((SRC[2 * a] + SRC[2 * b] + SRC[2 * c]) / 3, (SRC[2 * a + 1] + SRC[2 * b + 1] + SRC[2 * c + 1]) / 3));
        bad = !(Math.hypot(wm.re - (ax + bx + cx) / 3, wm.im - (ay + by + cy) / 3) <= 0.2 * e);
      }
      if (bad) {
        flags[t] = 1;
        if (budget > 0) yield* refine(SRC[2 * a], SRC[2 * a + 1], SRC[2 * b], SRC[2 * b + 1], SRC[2 * c], SRC[2 * c + 1], C(ax, ay), C(bx, by), C(cx, cy));
        else flags[t] = 0;
      }
      if ((t & 63) === 63 && due()) { yield; t0 = performance.now(); }
    }
    return { flags, extra: new Float32Array(extra), trouble };
  }
  async function runFix() {
    if (!GLR.ok) return;
    // started during motion: try again once it is over (the token stays, so the job is not lost)
    if (fixBusy()) { clearTimeout(fixJob.timer); fixJob.timer = setTimeout(runFix, 120); return; }
    const token = fixJob.token;
    fixJob.running = true; updateLeds();
    try { await runFixInner(token); } finally { if (token === fixJob.token) { fixJob.running = false; updateLeds(); } }
  }
  async function runFixInner(token) {
    for (const tg of fixTargets()) {
      for (const s of S.shapes) {
        if (s.visible === false || kindType(s) !== 'area') continue;
        const r = gpu.get(s.id);
        if (!r || !r.mesh || !r.meshRes) continue;
        // the dragged shape's fix-ups are the live driver's (liveFix), also for the tail after the pointer-up
        if (r.live || r.liveTail) continue;
        if (tg.need && !tg.need(s)) continue;
        const old = r.fix[tg.role];
        if (old && old.mapKey === tg.key && old.meshKey === r.meshKey) continue;
        // the other plane may already have refined this mesh for the same map (after adding a step, the left
        // plane shows the stage the right one just refined)
        const twin = Object.values(r.fix).find((f) => f && f.res && f.mapKey === tg.key && f.meshKey === r.meshKey);
        const res = twin ? twin.res : await computeFix(r.mesh, tg.F, token);
        if (!res || token !== fixJob.token || r.meshKey === undefined || !r.meshRes) return;
        let fx = old && old.meshKey === r.meshKey ? old : null;
        if (!fx) fx = { meshKey: r.meshKey, skip: GLR.createSkip(r.meshRes, res.flags) };
        else GLR.setSkip(fx.skip, res.flags);
        if (fx.extraRes) GLR.destroy(fx.extraRes);
        fx.extraRes = res.extra.length ? GLR.createMesh(res.extra) : null;
        fx.mapKey = tg.key; fx.res = res;
        r.fix[tg.role] = fx;
        if (r.hold && Object.keys(r.hold.fix).every((k) => r.fix[k] && r.fix[k].meshKey === r.meshKey)) dropHold(r);
        requestRender(tg.role);
      }
    }
  }

  // ---------------- the forward fallback: SphereMesh (SPEC 8, P5) ----------------
  // An area shape drawn forward (an ineligible chain or shape, exact images off, the cost guard's last resort, a morph
  // paused inside a step) that is unbounded or stretched (bboxOf null, or wider than 3 windows), or whose fix-up found
  // trouble (fixGen: a vertex without a finite image, or a piece still failing the midpoint test at depth 5; the
  // verdict depends on the shape, the map and the window, never on the right view), is drawn from a SphereMesh: the
  // sphere-native NVB mesher of src/sphere.js, refined on the CPU in the image metric, drawn as pre-mapped triangles
  // (GLR.createPreMesh / drawPreMapped). Playing homotopy frames (morph, transitions) keep today's GPU path, and so
  // does a pending inverse compile (it may show an already published mesh of the same content).
  // Jobs: one per key (shape, role, view kind, map, window, K, pattern; view), run one at a time in SM_SLICE ms idle
  // slices that wait out any motion (fixBusy, interacting), with their own keys: scheduleFix's token does not cancel
  // them; LED busy. A job is built for the view where the interaction settled. A flat mesh stays valid while the view
  // lies inside its guard box (the view it was built for, enlarged SM_GUARD times) and its zoom within 2x; a globe mesh
  // while the globe's radius is within 2x. While a rebuild runs, the old mesh of the same content is drawn inside its
  // guard box and today's GPU image (with its fix-ups) around it (8.8). K is that of the shape's alpha (not 8.8's
  // hover-dimmed alpha / 2: at alpha 0.85 that is K = 11 against 3, and exp(H) took 3.5x the work, 2.6 s against 0.74 s
  // at guard 1), so hovering the shape list reruns nothing and a dimmed infinitely-sheeted image may show its 4th and
  // later sheets faintly. The guard is 2 (8.8 says 3: the band's sheets cost 3.2x a guard-1 mesh, against 2.5x at 2).
  // Memory: one mesh per slot (shape, role, view kind) at rest: a slot's new mesh drops the slot's older ones (other
  // content, other views) when it publishes; SM_CPU_BYTES of published meshes (LRU) and GLR's preBytes (32 MB) only
  // bound the transients. Export meshes are dropped once the figure is drawn.
  // Budget (8.4, made deterministic): SphereMesh.APP's map evaluations (a stage-wise step probe counts 12) and nodes,
  // so the drawn mesh is the same whatever the machine's load; SM_MS_CAP CPU ms is a safety stop only. (The wall-clock
  // 1.5 s of 8.4 expired on every P5 scene, so the drawn meshes were partial and changed with the load.)
  const SM_APP = (typeof SphereMesh !== 'undefined' && SphereMesh.APP) || { maxWork: 250000, maxNodes: 300000, guard: 2 };
  const smWork = () => (SM_APP.workOf ? SM_APP.workOf(SphereMesh.kOf(S.alpha)) : SM_APP.maxWork);
  const SM_GUARD = SM_APP.guard, SM_SLICE = 5, SM_CPU_BYTES = 32 * 1024 * 1024, SM_LIVE_NODES = 1500000, SM_NODES = SM_APP.maxNodes, SM_MS_CAP = 10000;
  const sm = { entries: new Map(), jobs: new Map(), want: new Map(), running: false, kickT: 0, cpuBytes: 0, exportPartial: 0, exportGen: 0, stats: { built: 0, ms: 0, slices: 0, maxSlice: 0, cancelled: 0, partial: 0 } };
  const smOn = () => GLR.ok && !!GLR.createPreMesh && typeof SphereMesh !== 'undefined';
  function smStretched(s) {
    let bb = null;
    try { bb = Region.bboxOf(s); } catch (e) { bb = null; }
    const ww = clipWin.x1 - clipWin.x0, wh = clipWin.y1 - clipWin.y0;
    return !bb || (bb.x1 - bb.x0) > 3 * ww || (bb.y1 - bb.y0) > 3 * wh;
  }
  // the built steps of a still map (stage-wise limits), or null (a homotopy frame or a d/dz in range: probes)
  function smSteps(m) {
    if ((m.mode || 0) !== 0) return null;
    const out = [];
    for (let k = (m.a || 0) + 1; k <= (m.b || 0); k++) {
      if (isDeriv(k)) return null;
      if (stepFn(k)) out.push(built[k - 1]);
    }
    return out;
  }
  function smInjective(m) {
    if ((m.mode || 0) !== 0) return false;
    const list = [];
    for (let k = (m.a || 0) + 1; k <= (m.b || 0); k++) { if (isDeriv(k)) list.push({ deriv: true }); else if (stepFn(k)) list.push(built[k - 1].props); }
    try { return !!Funcs.composeProps(list).injective; } catch (e) { return false; }
  }
  // SPEC 8.1: why shape s (drawn forward for role under the normalised map m) needs a SphereMesh, or null
  function smNeed(s, r, role, m) {
    if (!smOn() || s._err || kindType(s) !== 'area' || (role !== 'R' && role !== 'L')) return null;
    if ((m.mode || 0) !== 0) {
      // a homotopy frame: never while it plays; paused, only when the shape is drawn forward at an end of the step
      // (a shape drawn exactly at both ends shows today's GPU image while paused inside the step: the mesh changed
      // 0.00% of its pixels there, at 200 ms of CPU and a mesh per paused T)
      if (morph.playing || trans.k) return null;
      const ends = homEnds(m);
      // (an identity end draws the region itself: exact)
      if (!ends || ends.every((e) => isIdentMap(e) || pathOf(s, e, role, 'flat').path !== 'forward')) return null;
    }
    if (isIdentMap(m)) return null;
    if (smStretched(s)) return 'unbounded';
    const f = r && r.fix && r.fix[role];
    const fk = (m.mode || 0) === 0 && !(m.a || 0) ? 'S' + chainSig[m.b || 0] : null;
    if (f && f.res && f.meshKey === r.meshKey && (!fk || f.mapKey === fk) && f.res.trouble) return 'trouble';
    return null;
  }
  // the two still maps a paused homotopy frame lies between (normalizeMap's ends), or null
  function homEnds(m) {
    const base = m.base || 0;
    if (m.mode === 1) { const k = m.hi || 0; return [{ mode: 0, a: base, b: Math.max(base, k - 1) }, { mode: 0, a: base, b: k }]; }
    if (m.mode === 2 || m.mode === 3) return [{ mode: 0, a: base, b: m.a || 0 }, { mode: 0, a: base, b: m.b || 0 }];
    return null;
  }
  // the content of a mesh (everything but the view); with win false, without the meshing window (the stand-in rule)
  function smContent(s, role, kind, m, win = true) {
    const pid = (GLR.PATTERNS || {})[S.pattern] ?? 1;
    return `${s.id}|${shapeKey(s)}|${role}|${kind}|${mapKeyOf(m)}|K${SphereMesh.kOf(S.alpha)}|p${pid}|${patternCell()}|${S.lines ? 1 : 0}` + (win ? `|${winKey()}` : '');
  }
  // the meshing window as the mesher's source view: clipWin at a nominal SM_WIN_PX px across (it is the left pane's box
  // when it was last re-centred), so the source metric depends on clipWin alone (an export's scaled views share it)
  const SM_WIN_PX = 480;
  function smLeft() {
    const w = clipWin.x1 - clipWin.x0, h = clipWin.y1 - clipWin.y0, sv = SM_WIN_PX / Math.max(w, h);
    return { cx: (clipWin.x0 + clipWin.x1) / 2, cy: (clipWin.y0 + clipWin.y1) / 2, s: sv, W: w * sv, H: h * sv };
  }
  // the globe's radius on screen, device px (as sphereView's contact shadow)
  function globeRpx(pane, c, base) {
    const pc = GLR.camera(c, pane.w, pane.h), D = Math.hypot(...pc.eye);
    return D > 1 ? Math.tan(Math.asin(1 / D)) / Math.tan(base.fov / 2) * pane.h / 2 * pane.dpr : 0;
  }
  // the mesher's view of a pane: flat in device px, or the globe's radius
  function smView(kind, pane, R) {
    if (kind === 'globe') return R > 4 ? { kind: 'sphere', R } : null;
    return { kind: 'flat', cx: pane.view.cx, cy: pane.view.cy, s: pane.view.s * pane.dpr, W: pane.pw, H: pane.ph, guard: SM_GUARD };
  }
  const smViewKey = (v) => (v.kind === 'sphere' ? `R${v.R.toFixed(2)}` : `${v.cx},${v.cy},${v.s},${v.W}x${v.H}`);
  function smValid(e, v) {
    if (e.view.kind !== v.kind) return false;
    if (v.kind === 'sphere') return v.R <= 2 * e.view.R && e.view.R <= 2 * v.R;
    if (!(v.s <= 2 * e.view.s && e.view.s <= 2 * v.s)) return false;
    const g = e.guardBox, hw = v.W / 2 / v.s, hh = v.H / 2 / v.s;
    return !!g && v.cx - hw >= g.x0 && v.cx + hw <= g.x1 && v.cy - hh >= g.y0 && v.cy + hh <= g.y1;
  }
  // the GL buffers of a published mesh (uploaded at its first draw; again after an eviction or a context loss)
  function smRes(e) {
    if (!e.res || !e.res.n) e.res = e.data.n ? GLR.createPreMesh(e.data) : null;
    return e.res;
  }
  // the draw state of a pre-mapped mesh (the look of drawScene's forward draw)
  function smLook(s, pane, alpha, map) {
    const ink = shapeInk(s);
    return { view: pane.view, dpr: pane.dpr, color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha, pattern: S.pattern, cell: patternCell(), lines: S.lines, sphN: sphN(),
      stretch: { shrink: GLR.hexRGB(TH.stretchShrink), grow: GLR.hexRGB(TH.stretchGrow), mid: GLR.hexRGB(TH.stretchMid) }, key: map ? smKeyOf(map) : null };
  }
  // SPEC 5 for a flat forward mesh (gl.js drawPreMapped): the inverse path's sheet key D (clipWin, its R and rs, the
  // accumulation set P of the chain's plan) and its tie rule, per sample, so the front sheet is the one the exact image
  // shows; null for a chain with no inverse plan (the mesh's own far-to-near leaf order, 8.6)
  function smKeyOf(map) {
    if (typeof Inverse === 'undefined') return null;
    const m = normalizeMap(map);
    if ((m.mode || 0) !== 0 || isIdentMap(m)) return null;
    const plan = invPlan(m.a || 0, m.b || 0);
    if (!plan || !plan.ok) return null;
    const R = Math.hypot(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0) / 2;
    return { win: clipWin, R, rs: R / 8, sing: invSing(plan) };
  }
  // SPEC 8.8: what to draw for forward shape s in a view -> null (today's GPU path) | {e} (a published mesh valid for
  // the view: drawn alone) | {old} (the old mesh of the same content while its rebuild runs: inside its guard box, the
  // GPU image around it). allowJob: a job may be requested for this view (live panes; not a pending compile).
  function smFor(s, r, role, kind, map, pane, R, allowJob) {
    const m = normalizeMap(map);
    const why = smNeed(s, r, role, m);
    if (!why) return null;
    const v = smView(kind, pane, R);
    if (!v) return null;
    const ck = smContent(s, role, kind, m), ck0 = smContent(s, role, kind, m, false);
    // (the stand-in during a rebuild may come from another meshing window: a left pan re-centred clipWin, which
    // changes the mesh's sheet order but not the image: still far nearer to it than today's GPU draw)
    let best = null, old = null;
    for (const e of sm.entries.values()) {
      if (e.ck0 !== ck0) continue;
      if (!best && e.ck === ck && smValid(e, v)) best = e;
      if (!old || (e.ck === ck) > (old.ck === ck) || ((e.ck === ck) === (old.ck === ck) && e.t > old.t)) old = e;
    }
    const slot = `${s.id}|${role}|${kind}`;
    if (best) {
      best.t = performance.now();
      if (!offRender && sm.want.get(slot)) { const j = sm.jobs.get(sm.want.get(slot)); if (j && j.ck === ck) smCancel(j); sm.want.delete(slot); }
      return { e: best, why };
    }
    if (allowJob && !offRender) smRequest(slot, ck, s, role, kind, m, v, why);
    return old ? { old, why } : { why };
  }
  function smCancel(job) {
    if (job.mesh) job.mesh.dispose();
    job.mesh = null; job.cancelled = true;
    sm.jobs.delete(job.key);
    sm.stats.cancelled++;
  }
  // a job for (slot, content, view): requested by a draw; it starts once the interaction has settled
  function smRequest(slot, ck, s, role, kind, m, v, why) {
    if (interacting() || fixBusy()) { smKick(); return; }
    const key = ck + '|' + smViewKey(v);
    const prev = sm.want.get(slot);
    if (prev === key && sm.jobs.has(key)) return;
    if (prev && prev !== key) { const j = sm.jobs.get(prev); if (j) smCancel(j); }
    sm.want.set(slot, key);
    if (!sm.jobs.has(key)) {
      const F = cpuMap(m), steps = smSteps(m);
      const cfg = {
        steps, F, injective: smInjective(m), shape: JSON.parse(JSON.stringify(s)),
        left: smLeft(),
        view: v, Kmax: SphereMesh.kOf(S.alpha),
        pattern: { id: (GLR.PATTERNS || {})[S.pattern] ?? 1, cell: patternCell(), lines: !!S.lines },
        maxWork: smWork(), budgetMs: SM_MS_CAP, maxNodes: SM_NODES,
      };
      sm.jobs.set(key, { key, ck, ck0: smContent(s, role, kind, m, false), slot, role, kind, view: v, why, cfg, mesh: null, ms: 0, slices: 0, t0: performance.now() });
    }
    smPumpLater();
  }
  // a frame after the interaction settles requests the jobs the motion frames could not
  function smKick() {
    clearTimeout(sm.kickT);
    sm.kickT = setTimeout(() => { if (interacting() || fixBusy()) smKick(); else requestRender('L', 'R'); }, 160);
  }
  let smPumpT = 0;
  function smPumpLater() { if (!smPumpT && !sm.running) smPumpT = setTimeout(() => { smPumpT = 0; smPump(); }, 0); }
  // the idle driver: one job at a time, SM_SLICE ms per slice, waiting out any motion between slices
  async function smPump() {
    if (sm.running) return;
    sm.running = true; updateLeds();
    try {
      for (;;) {
        let job = null;
        for (const key of sm.want.values()) { const j = sm.jobs.get(key); if (j && !j.cancelled) { job = j; break; } }
        if (!job) break;
        while ((fixBusy() || interacting()) && !job.cancelled) await yieldNow(60);
        if (job.cancelled || sm.want.get(job.slot) !== job.key) { if (!job.cancelled) smCancel(job); continue; }
        // live nodes across the jobs kept (one runs at a time; SPEC 8.4: 1.5M live)
        let liveN = 0;
        for (const j of sm.jobs.values()) if (j.mesh && j !== job) liveN += j.mesh.nodes;
        if (liveN > SM_LIVE_NODES) for (const j of [...sm.jobs.values()]) if (j !== job && j.mesh && sm.want.get(j.slot) !== j.key) smCancel(j);
        // (the pre-mapped programs link in the background while the job runs, not at the mesh's first draw)
        if (!job.mesh && GLR.prestart) GLR.prestart(job.kind === 'globe' ? ['regionSP'] : ['regionP']);
        const t0 = performance.now();
        let st;
        try {
          // (the mesher's set-up, its coverage grids, takes a slice of its own; a step aims at SM_SLICE - 2 ms, so a
          // long leaf at its end stays within the 6 ms of a slice)
          if (!job.mesh) { job.mesh = SphereMesh.create(job.cfg); st = { done: false }; }
          else st = job.mesh.step(SM_SLICE - 2);
        } catch (err) { console.error('SphereMesh', err); st = { done: true, failed: true }; }
        const dt = performance.now() - t0;
        job.ms += dt; job.slices++;
        sm.stats.slices++; sm.stats.ms += dt; if (dt > sm.stats.maxSlice) sm.stats.maxSlice = dt;
        if (dt > 6) (sm.stats.long || (sm.stats.long = [])).push([+dt.toFixed(1), job.slices, job.mesh ? job.mesh.phase : -1]);
        if (st.done) smFinish(job, st);
        await yieldTask();
      }
    } finally { sm.running = false; updateLeds(); }
  }
  function smFinish(job, st) {
    sm.jobs.delete(job.key);
    if (sm.want.get(job.slot) === job.key) sm.want.delete(job.slot);
    if (st.failed || !job.mesh) { if (job.mesh) job.mesh.dispose(); return; }
    const data = job.mesh.publish(), stats = job.mesh.stats();
    job.mesh.dispose();
    const bytes = (data.pos ? data.pos.byteLength : 0) + (data.pos3 ? data.pos3.byteLength : 0) + data.attr.byteLength + data.tri.byteLength;
    const e = { key: job.key, ck: job.ck, ck0: job.ck0, slot: job.slot, role: job.role, kind: job.kind, view: job.view, guardBox: data.guardBox, data, res: null, t: performance.now(), bytes, why: job.why, exp: !!job.exp, expGen: job.expGen || 0,
      info: { n: data.n, partial: !!data.partial, nodes: stats.nodes, work: stats.work, ms: +job.ms.toFixed(1), slices: job.slices, settleMs: +(performance.now() - job.t0).toFixed(0), budgetWhy: stats.budgetWhy } };
    // one mesh per slot: the slot's older meshes (another content: pattern, alpha, lines, a paused T, the map; or
    // another view) go now; the new one is the stand-in of the slot's next rebuild
    for (const x of [...sm.entries.values()]) if (x.slot === e.slot) smDrop(x);
    sm.entries.set(e.key, e); sm.cpuBytes += bytes;
    sm.stats.built++; if (data.partial) sm.stats.partial++;
    // memory: the least recently drawn published meshes go first
    if (sm.cpuBytes > SM_CPU_BYTES) for (const x of [...sm.entries.values()].sort((a, b) => a.t - b.t)) { if (sm.cpuBytes <= SM_CPU_BYTES) break; if (x !== e) smDrop(x); }
    requestRender(job.role === 'L' ? 'L' : 'R');
  }
  // the export meshes, once the figure is drawn (or abandoned)
  function smDropExport(gen = null) { for (const e of [...sm.entries.values()]) if (e.exp && (gen == null || e.expGen === gen)) smDrop(e); }
  function smDrop(e) {
    if (sm.entries.get(e.key) === e) { sm.entries.delete(e.key); sm.cpuBytes -= e.bytes; }
    if (e.res) GLR.destroy(e.res);
    e.res = null;
  }
  // a shape removed (or every shape: a context loss drops the GL buffers only, the CPU data re-uploads)
  function smDropShape(id) {
    for (const e of [...sm.entries.values()]) if (e.slot.startsWith(id + '|')) smDrop(e);
    for (const j of [...sm.jobs.values()]) if (j.slot.startsWith(id + '|')) smCancel(j);
    for (const k of [...sm.want.keys()]) if (k.startsWith(id + '|')) sm.want.delete(k);
  }
  // SPEC 10.6: the meshes an export's flat panels draw with, at the export's resolution (prepareExport): every
  // forward shape that needs one, sliced and cancellable (alive), stored like the screen's (slot '...|x', flagged exp)
  // until the figure is drawn (smDropExport). Budget: 4x the screen's work and 2x its nodes (deterministic); a mesh
  // that still ends on a budget is reported (sm.exportPartial -> the figure's partial flag and the dialog's note).
  // Its slices count in sm.stats (maxSlice, long) like the screen's.
  async function smPrepareExport(panes, alive, gen = 0) {
    sm.exportPartial = 0; sm.lastExport = [];
    for (const { role, pane, map } of panes) {
      for (const s of S.shapes) {
        if (s.visible === false || kindType(s) !== 'area') continue;
        const r = gpu.get(s.id) || shapeGPU(s);
        if (pathOf(s, map, role, 'flat', { status: true }).path !== 'forward') continue;
        const m = normalizeMap(map);
        if (!smNeed(s, r, role, m)) continue;
        const v = smView('flat', pane, 0), ck = smContent(s, role, 'flat', m);
        const have = [...sm.entries.values()].find((e) => e.ck === ck && smValid(e, v));
        if (have) { if (have.exp) have.expGen = gen; continue; }
        const mesh = SphereMesh.create({
          steps: smSteps(m), F: cpuMap(m), injective: smInjective(m), shape: JSON.parse(JSON.stringify(s)),
          left: smLeft(),
          view: v, Kmax: SphereMesh.kOf(S.alpha), pattern: { id: (GLR.PATTERNS || {})[S.pattern] ?? 1, cell: patternCell(), lines: !!S.lines },
          maxWork: smWork() * 4, budgetMs: SM_MS_CAP * 3, maxNodes: SM_NODES * 2,
        });
        const t0 = performance.now();
        let cpu = 0, slices = 0, st;
        for (;;) {
          if (!alive()) { mesh.dispose(); return false; }
          const a = performance.now();
          st = mesh.step(SM_SLICE - 2);
          const dt = performance.now() - a;
          cpu += dt; slices++;
          sm.stats.slices++; sm.stats.ms += dt; if (dt > sm.stats.maxSlice) sm.stats.maxSlice = dt;
          if (dt > 6) (sm.stats.long || (sm.stats.long = [])).push([+dt.toFixed(1), slices, 'export']);
          if (st.done) break;
          await yieldTask();
        }
        if (st.partial) sm.exportPartial++;
        { const x = mesh.stats(); sm.lastExport.push({ n: mesh.publish().n, partial: !!st.partial, budgetWhy: x.budgetWhy, nodes: x.nodes, work: x.work, ms: +cpu.toFixed(1), slices, view: v }); }
        smFinish({ key: ck + '|' + smViewKey(v), ck, ck0: smContent(s, role, 'flat', m, false), slot: `${s.id}|${role}|flat|x`, role, kind: 'flat', view: v, why: 'export', exp: true, expGen: gen, mesh, ms: cpu, slices, t0 }, { done: true });
      }
    }
    return alive();
  }

  // ---------------- lines: reach and singular points, on settle only (SPEC 9.1, P4) ----------------
  // Motion frames keep today's lineKey and samples (a scrub never resamples, re-uploads or re-caches a line). Once the
  // interaction has settled (LINE_QUIET ms after the last input or change, nothing moving), this idle job builds each
  // line's refined samples (Region.Lines.refine: long curves reach expandBox(clipWin, 1e28) with their tails stopped
  // where the stage maps leave 1e19, samples toward the chain's singular points, formula contours continued as rays)
  // and swaps them in. A refinement is keyed by the line's own key (shape and clipWin), the drawn stages' structure and
  // the structural singular points (rounded to 1e-9 of the window size), so a small parameter change reuses it. It
  // stays drawn through later motion (its samples are fixed in the source plane like today's). A new line key (the
  // shape or clipWin changed) is refined at once in shapeGPU when it fits the frame (refineNow, P4 review); only a
  // shape whose refinement does not fit draws today's samples until this job swaps the refined ones in.
  const lineJob = { token: 0, timer: 0, running: 0 };
  const LINE_QUIET = 150, LINE_SLICE = 5;
  function scheduleLines() {
    clearTimeout(lineJob.timer);
    lineJob.token++;
    lineJob.timer = setTimeout(runLines, 0);
  }
  const lineWait = () => {
    const now = performance.now();
    if (fixBusy() || interacting()) return 60;
    return Math.max(0, LINE_QUIET - (now - Math.max(motionInT, scrubT, lastChangeT)));
  };
  // the stage maps the lines are drawn under (the right plane's, the left plane's when it shows a stage); their plan
  // gives the singular points (a chain's later stages list every earlier op's points too)
  function lineSpec() {
    const ks = [...new Set([rightStage(), leftStage()])].filter((k) => k > 0 && !isIdentMap(stageMap(k))).sort((a, b) => a - b);
    if (!ks.length || typeof Inverse === 'undefined') return null;
    const top = ks[ks.length - 1];
    const plan = invPlan(0, top);
    const W = Math.max(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0), q = 1e-9 * W;
    let sing = null, sk = 'scan|' + chainSig[top];
    if (plan.ok) {
      try { sing = Inverse.singular(plan, clipWin, ['undef', 'branch', 'pole'], 16); } catch (e) { sing = []; }
      sk = sing.map((e) => e.kind[0] + Math.round(e.z.re / q) + ',' + Math.round(e.z.im / q)).join(';');
    }
    const struct = ks.map((k) => k + ':' + S.steps.slice(0, k).map((st) => (st.on === false ? '-' : st.type)).join(',')).join('/');
    return { Fs: ks.map((k) => stageF(k)), sing, key: struct + '|' + sk };
  }
  // lineSpec() for the current stages, chain and clipWin (Inverse.singular is not free: a shape drag rebuilds its
  // lines every frame with the same spec)
  let lineSpecC = { key: null, spec: null };
  function lineSpecNow() {
    const k = `${rightStage()}|${leftStage()}|${chainSig[nSteps()]}|${S.steps.map((st) => (st.on === false ? '-' : st.type)).join(',')}|${winKey()}`;
    if (lineSpecC.key !== k) { let spec = null; try { spec = lineSpec(); } catch (e) { spec = null; } lineSpecC = { key: k, spec }; }
    return lineSpecC.spec;
  }
  // the refined polylines of shape s (every curve; today's samples for a curve whose refinement throws)
  function refinePolys(s, mesh, spec, origin) {
    const polys = [];
    for (const c of sourceCurves(s, mesh, { reach: 'sphere' })) {
      let ps = [];
      try { ps = Region.Lines.refine([c], spec.Fs, spec.sing, { win: clipWin, origin, maxInsert: 8192, maxEval: 2048 }); } catch (e) { console.error('line refinement', e); ps = [Region.sampleCurve(c, clipWin)]; }
      for (const p of ps) if (p.length >= 4) polys.push(p);
    }
    return polys;
  }
  // The synchronous refinement of a new line key (shapeGPU): {polys, key}, or null when there is nothing to refine or
  // it does not fit: LINE_CAP ms per frame during a drag, LINE_FRAME ms otherwise, judged by the shape's last cost
  // (force: no cap, the figure export)
  const LINE_CAP = 6, LINE_FRAME = 8;
  const lineBudget = { t: -1e9, ms: 0 };
  function refineNow(s, r, lkey, origin, force) {
    if (!GLR.ok || !Region.Lines) return null;
    const spec = lineSpecNow();
    if (!spec) return null;
    const now = performance.now();
    if (now - lineBudget.t > 12) { lineBudget.t = now; lineBudget.ms = 0; }
    if (!force && lineBudget.ms + (r.refMs || 0) > (drag ? LINE_CAP : LINE_FRAME)) return null;
    const polys = refinePolys(s, r.mesh, spec, origin);
    const ms = performance.now() - now;
    r.refMs = ms; lineBudget.ms += ms;
    return { polys, key: lkey + '|' + spec.key };
  }
  // the figure export (prepareExport): every visible shape's lines refined for the current spec, one shape at a time,
  // yielding to the page between shapes once 8 ms have passed (SPEC 10.6: the export never blocks the dialog); alive():
  // false when the export was cancelled (an option changed, the dialog closed) -> false then
  async function refineAllNow(alive = () => true) {
    if (!GLR.ok || !Region.Lines) return true;
    let t0 = performance.now();
    for (const s of S.shapes) {
      if (!alive()) return false;
      const spec = lineSpecNow();
      if (!spec) return true;
      if (s.visible === false || kindType(s) === 'point') continue;
      const r = gpu.get(s.id);
      if (!r || !r.lineKey || r.refKey === r.lineKey + '|' + spec.key) continue;
      const origin = r.lorigin || [(clipWin.x0 + clipWin.x1) / 2, (clipWin.y0 + clipWin.y1) / 2];
      swapLines(r, refinePolys(s, r.mesh, spec, origin), origin);
      r.refKey = r.lineKey + '|' + spec.key;
      if (performance.now() - t0 > 8) { await new Promise((res) => setTimeout(res, 0)); t0 = performance.now(); }
    }
    return alive();
  }
  // swap in refined polylines (nothing uploaded when they equal the drawn ones)
  function swapLines(r, polys, origin) {
    const old = r.lpolys || [];
    const same = old.length === polys.length && polys.every((p, i) => p.length === old[i].length && p.every((x, k) => x === old[i][k]));
    if (same) return;
    const res = polys.length ? GLR.createLines(polys, origin) : null;
    GLR.destroy(r.lineRes);
    r.lineRes = res; r.lpolys = polys; r.lorigin = origin; r.arcs = null;
    requestRender('L', 'R', 'T');
  }
  async function runLines() {
    lineJob.timer = 0;
    if (!GLR.ok || !Region.Lines) return;
    const wait = lineWait();
    if (wait > 0) { lineJob.timer = setTimeout(runLines, Math.max(20, wait)); return; }
    const token = lineJob.token;
    const spec = lineSpecNow();
    if (!spec) return;
    const todo = [];
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point') continue;
      const r = gpu.get(s.id);
      if (!r || !r.lineKey || r.refKey === r.lineKey + '|' + spec.key) continue;
      todo.push([s, r]);
    }
    if (!todo.length) return;
    lineJob.running = token; updateLeds();
    let t0 = performance.now();
    // yield to the page, wait out any motion; true when this job went stale meanwhile
    const rest = async () => {
      await yieldNow();
      while (lineWait() > 0 && token === lineJob.token) await yieldNow(40);
      t0 = performance.now();
      return token !== lineJob.token;
    };
    try {
      const origin = [(clipWin.x0 + clipWin.x1) / 2, (clipWin.y0 + clipWin.y1) / 2];
      for (const [s, r] of todo) {
        const lkey = r.lineKey, key = lkey + '|' + spec.key;
        const curves = sourceCurves(s, r.mesh, { reach: 'sphere' });
        const polys = [];
        for (const c of curves) {
          let ps = [];
          try { ps = Region.Lines.refine([c], spec.Fs, spec.sing, { win: clipWin, origin, maxInsert: 8192, maxEval: 2048 }); } catch (e) { console.error('line refinement', e); ps = [Region.sampleCurve(c, clipWin)]; }
          for (const p of ps) if (p.length >= 4) polys.push(p);
          if (performance.now() - t0 > LINE_SLICE && await rest()) return;
        }
        if (token !== lineJob.token) return;
        if (r.lineKey !== lkey || gpu.get(s.id) !== r) continue;     // rebuilt meanwhile: its own job follows
        // the same samples as drawn (bounded curves away from singular points): nothing to upload
        swapLines(r, polys, origin);
        r.refKey = key;
        if (performance.now() - t0 > LINE_SLICE && await rest()) return;
      }
    } finally {
      if (lineJob.running === token) { lineJob.running = 0; updateLeds(); }
    }
  }

  // ---------------- drawing ----------------
  // Pattern cell size depends on the shapes (not the view), so it stays put while panning and zooming.
  let cellBase = 0, cellKey = '';
  function patternCell() {
    const key = S.shapes.map(shapeKey).join('|');
    if (key !== cellKey || !cellBase) {
      cellKey = key;
      let size = 0;
      for (const s of S.shapes) {
        if (kindType(s) !== 'area') continue;
        let b = null;
        try { b = Region.bboxOf(s); } catch (e) { b = null; }
        if (b) size = Math.max(size, b.x1 - b.x0, b.y1 - b.y0);
      }
      if (!size) size = Math.max(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0);
      cellBase = Axes.niceStep(size / 10);
    }
    return cellBase * (S.patternScale || 1);
  }
  let hoverShape = null;
  const mapKeyOf = (map) => `${map.mode}|${map.a || 0}|${map.b || 0}|${map.hi || 0}|${map.t || 0}|${map.base || 0}|${chainSig[Math.max(map.b || 0, map.hi || 0)] || ''}`;
  // the CPU twin of a GPU map spec (dash phases of mapped strokes follow its arc length); map.base: the stage of the
  // source plane of a homotopy (0, the z-plane, by default)
  function cpuMap(map) {
    const mode = map.mode || 0, pb = map.base || 0;
    if (mode === 1) {
      const k = map.hi || 0, Fp = rangeF(pb, k - 1), t = map.t || 0;
      if (isDeriv(k)) return lerpF(Fp, rangeF(pb, k), t);
      if (!stepFn(k)) return Fp;
      const Ht = homF(k, t);
      return (z) => Ht(Fp(z));
    }
    if (mode === 2) return lerpF(rangeF(pb, map.a || 0), rangeF(pb, map.b || 0), map.t || 0);
    if (mode === 3) {
      const F0 = rangeF(pb, map.a || 0), t = map.t || 0, Hs = [];
      for (let k = (map.a || 0) + 1; k <= (map.b || 0); k++) if (stepActive(k)) Hs.push(isDeriv(k) ? () => C(NaN, NaN) : homF(k, t));
      return (z) => { let w = F0(z); for (const H of Hs) w = H(w); return w; };
    }
    return rangeF(map.a || 0, map.b || 0);
  }
  // Per segment of r.lineRes (createLines order): the arc length of the curve under F at the segment start and the
  // segment's length, so dashes keep their rhythm along the mapped curve (cached per map key)
  function arcOf(r, F, key) {
    if (!r.arcs) r.arcs = new Map();
    let a = r.arcs.get(key);
    if (a) { r.arcs.delete(key); r.arcs.set(key, a); return a; }
    // anchored at each polyline's point nearest the clipWin centre (P4 review: reach tails start up to 1e28 away,
    // where float32 does not resolve a dash period; the anchor is the same for today's and the refined samples)
    const data = Region.Lines.arcs(r.lpolys || r.polys || [], F, r.lorigin || [(clipWin.x0 + clipWin.x1) / 2, (clipWin.y0 + clipWin.y1) / 2], Math.hypot(clipWin.x1 - clipWin.x0, clipWin.y1 - clipWin.y0) / 2);
    a = { key: `${r.lineKey}|${key}`, data };
    r.arcs.set(key, a);
    if (r.arcs.size > 4) r.arcs.delete(r.arcs.keys().next().value);
    return a;
  }
  // ---------------- exact images: the inverse path (SPEC 2.1, 2.2, 10) ----------------
  // A mapped area is drawn per pixel through the closed-form inverse of the chain (GLR.drawInverse) when the map and
  // the shape allow it; otherwise forward, as before (mesh + fix-ups). Phase flags (SPEC 11.0): P2 enabled the right
  // plane (flat); P3 the globes (Y Sphere, role R; X Sphere, role L, also at stage 0) and the left plane at a focused
  // stage (role L, flat). Thumbnails (role null) draw like the right plane.
  const PHASE = { R: { flat: true, globe: true }, L: { flat: true, globe: true } };
  const forceFwd = new Set();          // shape ids drawn forward whatever their eligibility (tests: mixed paths)
  let hideStrokes = false;             // tests: the flat panes' shape strokes left out (the crack test reads the fill under them)
  let offRender = false;               // renderOff (figure export) is drawing: no cost guard, no half resolution
  // a map spec that applies no live step: drawn without the chain, as today (GLR's isIdent)
  function isIdentMap(m) {
    const mode = m.mode || 0;
    const lo = mode === 0 ? (m.a || 0) + 1 : (m.base || 0) + 1, hi = mode === 1 ? (m.hi || 0) : (m.b || 0);
    for (let k = Math.max(1, lo); k <= Math.min(hi, nSteps()); k++) if (stepActive(k)) return false;
    return true;
  }
  // SPEC 10.5: a paused homotopy at a step boundary is the stage map it equals (mode 0), so the transport open and
  // paused there shows the exact image and closing it does not pop. Only while nothing plays, and only for steps whose
  // homotopy has H_0 = id and H_1 = f exactly (Inverse.homExact); the linear homotopy is exact at its ends.
  function normalizeMap(map) {
    const mode = map.mode || 0;
    if (!mode || morph.playing || trans.k) return map;
    const t = map.t, base = map.base || 0;
    if (mode === 1) {
      const k = map.hi || 0, st = S.steps[k - 1];
      if (st && st.on !== false && !isDeriv(k) && !(typeof Inverse !== 'undefined' && Inverse.homExact(st))) return map;
      if (t === 1) return { mode: 0, a: base, b: k };
      if (t === 0) return { mode: 0, a: base, b: Math.max(base, k - 1) };
    } else if (mode === 2) {
      if (t === 0) return { mode: 0, a: base, b: map.a || 0 };
      if (t === 1) return { mode: 0, a: base, b: map.b || 0 };
    } else if (mode === 3) {
      // all at once: exact at its ends when every step's homotopy is (Inverse.homExact)
      for (let k = (map.a || 0) + 1; k <= (map.b || 0); k++) {
        const st = S.steps[k - 1];
        if (stepActive(k) && (isDeriv(k) || !(typeof Inverse !== 'undefined' && Inverse.homExact(st)))) return map;
      }
      if (t === 0) return { mode: 0, a: base, b: map.a || 0 };
      if (t === 1) return { mode: 0, a: base, b: map.b || 0 };
    }
    return map;
  }
  // Inverse.planChain per stage range and chain signature (parameter values included: a scrub makes new plans)
  const invPlans = new Map();
  function invPlan(a, b) {
    const ck = `${a}|${b}|${chainSig[nSteps()]}`;
    let p = invPlans.get(ck);
    if (!p) {
      try { p = Inverse.planChain(S.steps, built, a, b); } catch (e) { p = { ok: false, reason: 'plan: ' + (e && e.message), ops: [] }; }
      p._ck = ck;
      if (invPlans.size >= 32) invPlans.clear();
      invPlans.set(ck, p);
    }
    return p;
  }
  // the shape-level preparation (SPEC 3.6) and the image box of the scissor (4.8), cached by plan, clipWin and shape;
  // prepMs: the preparation work of the current frame (SPEC 10.2: past 4 ms, an uncached bounded shape waits a frame)
  const invPreps = new Map(), invSings = new Map();
  let prepMs = 0, prepDeferred = false;
  const winKey = () => `${clipWin.x0},${clipWin.x1},${clipWin.y0},${clipWin.y1}`;
  function shapeBounded(s) {
    if (s.complement) return false;
    let b = null;
    try { b = s.kind === 'formula' ? Region.formulaBox(s) : Region.bboxOf(s); } catch (e) { b = null; }
    return !!b && [b.x0, b.x1, b.y0, b.y1].every(Number.isFinite);
  }
  function invSing(plan) {
    const k = plan._ck + '|' + winKey();
    let v = invSings.get(k);
    if (!v) {
      try { v = Inverse.accumulation(plan, clipWin); } catch (e) { v = []; }
      if (invSings.size >= 32) invSings.clear();
      invSings.set(k, v);
    }
    return v;
  }
  function invPrep(plan, s, budget) {
    const key = `${plan._ck}|${winKey()}|${shapeKey(s)}`;
    let e = invPreps.get(key);
    if (e) { invPreps.delete(key); invPreps.set(key, e); return e; }
    if (budget && prepMs > 4 && shapeBounded(s)) { prepDeferred = true; return null; }
    const t0 = performance.now();
    let prep;
    try { prep = Inverse.prepare(plan, { win: clipWin, shape: s, sing: invSing(plan) }); } catch (err) { prep = { ok: false, reason: 'prepare: ' + (err && err.message) }; }
    prepMs += performance.now() - t0;
    e = { key, prep, box: undefined };
    invPreps.set(key, e);
    if (invPreps.size > 64) invPreps.delete(invPreps.keys().next().value);
    return e;
  }
  // SPEC 4.8: a conservative w-box of a bounded shape's image (rigorous disc enclosures through the whole op list:
  // Inverse.imageBox; cuts and folds inside the shape are covered), or null (unbounded, or a pole in reach: no scissor)
  // While the user scrubs (every frame a new plan: the cache misses for every shape), only the first, coarser pass
  // runs (still a conservative enclosure: a slightly larger scissor); the refinement follows on the first quiet frame
  // (P2 review: eight polygons cost 4 ms of main thread per scrub frame).
  const BOX_RE = { kind: 'add', e: C(1, 0) }, BOX_IM = { kind: 'add', e: C(0, 1) };
  function invBox(e, plan, s, budget) {
    if (e.box !== undefined && !(e.boxCoarse && !interacting())) return e.box;
    if (budget && prepMs > 2) return e.box !== undefined ? e.box : null;
    const coarse = !!budget && interacting();
    let box = null;
    if (shapeBounded(s) && plan.ops.length) {
      const t0 = performance.now();
      try {
        const one = (coord) => {
          let r = Inverse.imageBox(plan.ops, s, coord, Infinity, { cap: 256 });
          if (r.empty || !(Number.isFinite(r.lo) && Number.isFinite(r.hi))) return null;
          if (r.hi > r.lo && !coarse) {
            const q = Inverse.imageBox(plan.ops, s, coord, (r.hi - r.lo) / 64, { cap: 1024 });
            if (!q.empty && Number.isFinite(q.lo) && Number.isFinite(q.hi)) r = q;
          }
          return r;
        };
        const x = one(BOX_RE), y = x && one(BOX_IM);
        if (x && y) box = { x0: x.lo, x1: x.hi, y0: y.lo, y1: y.hi };
      } catch (err) { box = null; }
      prepMs += performance.now() - t0;
    }
    e.box = box; e.boxCoarse = coarse;
    return box;
  }
  // ---- the cost guard (SPEC 10.12): the GPU time of each live pane's frame against a fixed 60 Hz budget (the user's
  // rule: "60 fps is enough"; the display's refresh plays no part). When a pane's motion frames stay over it, their
  // inverse passes render at half resolution; only if that is not enough do the pane's bounded clean shapes go forward
  // (the last resort). A level is left by a probe of the finer one (hysteresis; GLR.CostGuard). Per scene and chain
  // structure, B class and dpr (the guard key).
  // The budget per pane follows the perf suite's 60 fps frame of 14 ms (compare_perf.py BUDGET60, the lead's decision of
  // 2026-10-20): a frame is the pane's reading + 2.2 ms (main thread, blit, sync) + 1.8 ms (the other pane's forward
  // redraw at dpr 2), so 14 - 2.2 - 1.8 = 10 ms; the exit stays 3 ms below it. Under the user's rule ("60 fps is
  // enough"; motion frames must look like rest frames) half resolution is only the safety net for a GPU whose measured
  // frames would leave 60 fps, never a prediction (the predicted floor of 13.14 is withdrawn: full-resolution frames of
  // the heaviest panes, exp(H) and z^i(H) at alpha <= 0.5 and dpr 2, measured 12.6-14.6 ms p95 on the suite's M4).
  const GUARD_OPTS = { budget: 10, exit: 7 };
  let guard = GLR.CostGuard ? GLR.CostGuard(GUARD_OPTS) : null;
  const paneState = () => ({ view: '', t: 0, inv: false, motion: false, lv: 0, qs: [], reads: [], readsLv: 0, nq: 0, key: '', demoted: false, halfT: 0, half: false, full: false, burst: 0, lastMotion: -1e9 });
  const paneG = { R: paneState(), L: paneState() };
  const guardLog = [];   // the last measurements fed to the guard (for the test hooks)
  // a shape the guard may demote: bounded and clean (its image box is finite: no pole or essential singularity in reach)
  const guardDemotes = (role, s, plan, e) => !!guard && (role === 'R' || role === 'L') && guard.state(role).demote && invBox(e, plan, s) !== null;
  // once per live pane frame, before its fills: feed the guard (timer results, or the frame lag) -> {half}
  // Measurement refinements (the policy itself is GLR.CostGuard's): the first GUARD_GRACE motion frames after a pause
  // do not count (an idle Apple GPU runs at a low clock for its first frames: 8 ms readings for a 3 ms pass), and each
  // reading is the median of the pane's last 3 at the same level (one slow frame is not a trend). Each reading carries
  // the level its frame was drawn at (0 full, 1 half, 2 half and demoted; -1: neither, ignored). A pane whose last
  // frame was drawn at half resolution is redrawn at full resolution as soon as the input ends (pointer up, or 45 ms
  // without input). Without timer queries the guard reads the frame's lag (the time from the request of an animation
  // frame to its start: a GPU behind its frames delays them) instead of the time between two frames of the pane, which
  // for input-driven frames is the input's spacing (a notched wheel, a slow drag: 80 ms intervals demoted cheap scenes,
  // P2 review). Half resolution is used only within continuous motion (the previous frame of the pane less than
  // HALF_SETTLE ms ago): an isolated event (a wheel notch) draws at full resolution, never soft then sharp.
  const GUARD_GRACE = 4, GUARD_EVERY = 2, HALF_SETTLE = 45;
  let rafReqT = 0, frameLag = 0;
  const drawnLevel = (demoted, half) => (demoted ? (half ? 2 : -1) : half ? 1 : 0);
  // the live panes that drew inverse passes in this animation frame, and their measured entries: when both panes drew
  // them, each reading gets half of the frame's GPU budget (frame() marks the entries at its end)
  const invPaneQ = { L: null, R: null, drew: { L: false, R: false } };
  // SPEC 10.12 (13.14): the level a pane's inverse passes need in motion, predicted from their structure: 1 (half
  // resolution) when GLR.inverseEstimate puts the pane's passes over HALF_EST ms of the suite's M4 at full clock. The
  // GPU's clock follows its load (a frame with twice the work took 1 ms longer, 13.14), so a pane whose exact passes
  // do not fit the GPU's low clock runs its motion frames at the 60 fps ceiling, and the timer readings show the clock
  // rather than the work; the measured guard needed ~14 motion frames to trip besides. The prediction makes the
  // motion frames of a heavy pane (exp(H), z^i(H) at alpha <= 0.5 and dpr 2) cheap from the first contiguous frame;
  // still frames, thumbnails and exports stay full resolution and exact, and a slower GPU still trips the guard.
  const HALF_EST = 2.2;
  function predictLevel(list, map, role, pane, recs) {
    if (!GLR.inverseEstimate) return 0;
    const px = pane.pw * pane.ph, k = pane.view.s * pane.dpr;
    let est = 0;
    for (const s of list) {
      if (kindType(s) !== 'area') continue;
      const p = pathOf(s, map, role, 'flat', { recs, budget: true });
      if (p.path !== 'inverse') continue;
      const b = p.e && p.e.box;
      const a = b && [b.x0, b.x1, b.y0, b.y1].every(Number.isFinite) ? Math.min(px, Math.max(0, (b.x1 - b.x0) * k + 8) * Math.max(0, (b.y1 - b.y0) * k + 8)) : px;
      est += GLR.inverseEstimate(p.prep, hoverShape && hoverShape !== s.id ? S.alpha * 0.5 : S.alpha, S.alpha, a);
    }
    return est > HALF_EST ? 1 : 0;
  }
  function guardFrame(side, pane, key, floor = 0) {
    const g = paneG[side];
    const now = performance.now();
    const contiguous = g.t > 0 && now - g.t < HALF_SETTLE;
    const vk = `${pane.view.cx},${pane.view.cy},${pane.view.s},${pane.pw}x${pane.ph}`;
    let motion = vk !== g.view || !!drag || tweens.length > 0 || now - lastChangeT < 200;
    g.view = vk;
    if (g.full) { g.full = false; motion = false; }          // the settle frame after half-resolution motion
    if (key !== g.key) { g.key = key; g.demoted = false; g.reads = []; guard.frame(side, { key }); }
    if (motion) {
      if (now - g.lastMotion > 300) g.burst = 0;
      // a new motion burst: the guard may probe the finer level for it (hysteresis)
      if (++g.burst === 1) guard.burst(side, now);
      g.lastMotion = now;
    }
    const counts = motion && g.burst > GUARD_GRACE;
    const timed = GLR.timer && GLR.timer.available;
    // (results are polled only while brackets are outstanding: the poll's disjoint check is a GL query of its own)
    if (timed) {
      for (const r of paneG.R.qs.length || paneG.L.qs.length ? GLR.timer.poll() : []) {
        const q = paneG[r.tag];
        if (!q) continue;
        let i = q.qs.findIndex((x) => Math.abs(x.t - r.t) < 2);
        const e = i >= 0 ? q.qs[i] : null;
        if (i >= 0) q.qs.splice(0, i + 1);
        if (!e || !e.inv) continue;                            // a frame without inverse passes says nothing
        // (the median of the last 3 readings at the same level)
        if (e.lv !== q.readsLv) { q.reads = []; q.readsLv = e.lv; }
        q.reads.push(r.ms); if (q.reads.length > 3) q.reads.shift();
        const ms = q.reads.length < 3 ? r.ms : q.reads.slice().sort((x, y) => x - y)[1];
        const gs = guard.frame(r.tag, { key: q.key, motion: e.motion, gpuMs: ms, inverse: true, level: e.lv, share: e.share || 1, t: now });
        guardLog.push([r.tag, +r.ms.toFixed(2), e.motion, `${e.lv}>${gs.level}`, gs.over]); if (guardLog.length > 160) guardLog.shift();
      }
    } else if (g.t && now - g.t < 250) {
      const gs = guard.frame(side, { key, motion: g.motion, gpuMs: null, intervalMs: frameLag, inverse: g.inv, level: g.lv, t: now });
      guardLog.push([side, 'lag', +frameLag.toFixed(1), g.motion && g.inv, `${g.lv}>${gs.level}`]); if (guardLog.length > 160) guardLog.shift();
    }
    g.t = now; g.motion = counts; g.inv = false;
    if (guard.setFloor) guard.setFloor(side, floor, now);
    const st = guard.state(side);
    if (st.demote && !g.demoted) { g.demoted = true; scheduleFix(); }
    if (!st.demote && g.demoted) { g.demoted = false; requestRender(side); }   // recovered: the shapes return to inverse
    return { motion: counts, half: st.half && motion && contiguous, demoted: st.demote, timed };
  }
  // the view is in continuous motion (a drag, a tween, a transition, a playing morph, a wheel, a slider or a scrub of
  // changes): an inverse program never drawn yet is not drawn now (its first draw stalls the GPU process), another
  // ready B class or the forward stand-in takes its place (gl.js drawInverse) and it is warmed at the next quiet
  // moment. A single discrete change (an example, a toggle) or a hover is not motion: its program draws as soon as it
  // is ready (P2 review gate: holding it back added 200-300 ms to every example load)
  function interacting() {
    const now = performance.now();
    return !!(drag || tweens.length || camTweens.length || trans.k || (morph.playing && morph.open) || now - motionInT < 150 || now - scrubT < 150);
  }
  // An inverse program that landed is warmed (GLR.warmInverse: a one-pixel draw with a real pass's state builds its
  // Metal pipeline, the 75-205 ms first-draw stall of the GPU process) as soon as nothing moves: at once when its compile
  // lands (GLR.onReady) or a live frame finds it cold, else polled every 100 ms until the motion ends; then the panes
  // redraw with it. Live frames never draw a cold program (drawInverse coldOk false: the forward stand-in or another
  // warm B class shows meanwhile), so the stall never lands inside a pan, a zoom, a transition or a frame.
  // Half-resolution pipelines (a refused half draw asked for one; full resolution draws meanwhile) are not urgent: they
  // are warmed only after WARM_HALF_IDLE ms without motion (drags, wheels, sliders, scrubs; a hover does not count, or
  // a pointer resting on a pane would hold it off for good), so their stall does not meet the next gesture (P2 gate: a
  // 117 ms wheel latency when one landed between two wheel gestures).
  // (A pane predicted to need half resolution, predictLevel, gets its half pipelines with its first warm-up, or at the
  // next quiet moment: its motion frames are half resolution from the first gesture on.)
  const WARM_HALF_IDLE = 1000;
  let warmT = 0, warmDue = 0;
  const halfPred = { L: 0, R: 0 };
  function scheduleWarm(delay = 100) {
    const due = performance.now() + delay;
    if (warmT) { if (due >= warmDue) return; clearTimeout(warmT); }
    warmDue = due;
    warmT = setTimeout(() => {
      warmT = 0;
      const need = GLR.ok && GLR.inverseColdState ? GLR.inverseColdState() : 0;
      if (!need) return;
      if (interacting()) { scheduleWarm(); return; }
      const idle = performance.now() - Math.max(motionInT, scrubT);
      const pred = halfPred.L > 0 || halfPred.R > 0;
      if (pred && GLR.wantHalf) GLR.wantHalf();
      if (need === 1 && !pred && idle < WARM_HALF_IDLE) { scheduleWarm(Math.max(50, WARM_HALF_IDLE - idle)); return; }
      if (GLR.warmInverse(need === 1 || pred)) requestRender('L', 'R', 'T');
    }, delay);
  }
  // the settle frame of a pane that drew half resolution in motion
  function halfSettle(side, ms) {
    const g = paneG[side];
    clearTimeout(g.halfT);
    g.halfT = setTimeout(() => { g.halfT = 0; if (!g.half) return; g.half = false; g.full = true; requestRender(side); }, ms);
  }
  window.addEventListener('pointerup', () => { for (const k of ['R', 'L']) if (paneG[k].half) halfSettle(k, 0); }, { capture: true, passive: true });
  // the logical path a live view last drew a shape with: a shape that turns forward needs its fix-ups (SPEC 10.4)
  const lastPath = new Map();
  function notePath(role, id, path) {
    const k = role + '|' + id, prev = lastPath.get(k);
    if (prev === path) return;
    lastPath.set(k, path);
    if (path === 'forward' && prev && prev !== 'forward') scheduleFix();
  }
  let invFailKey = '', invThrew = false;
  let thumbNotFinal = false;   // a thumbnail drew a forward stand-in for an inverse program still compiling
  let sideDraw = false;    // renderExampleThumb: a side chain (GLR side mode) is drawing
  // live panes that drew a forward stand-in while the inverse program compiled: any draw that finds the program
  // ready (a thumbnail can finish its link first, without GLR.onReady) redraws them
  const invWaiting = new Set();
  let lastRecs = null;     // the shape records of the last packShapes (GLR.packShapes: once per scene draw)
  // SPEC 2.2: the path of area shape s under map in a view (role 'R' | 'L' | null: thumbnail; viewKind 'flat' |
  // 'globe') -> {path: 'inverse' | 'pending' | 'forward', reason, m (normalised map), plan, prep, e}. Drawing asks
  // without o.status ('inverse' = eligible: drawInverse decides between drawn, pending and error); fix-up gating and
  // the test hooks ask with o.status (the program's state, without starting a compile).
  function pathOf(s, map, role, viewKind = 'flat', o = {}) {
    const F = (reason) => ({ path: 'forward', reason });
    if (!GLR.ok || typeof Inverse === 'undefined' || !GLR.drawInverse) return F('no WebGL2 inverse renderer');
    const m = normalizeMap(map);
    if ((m.mode || 0) !== 0) return F(morph.playing || trans.k ? 'homotopy playing' : 'paused inside a step (homotopy)');
    // (on a globe an identity map draws inverse too: the walk is the pixel's own point, so a region through infinity
    // covers the north pole exactly, where the lifted mesh left a hole; panels.md 11, the stage-0 globe inverse)
    if (isIdentMap(m) && viewKind !== 'globe') return F('identity map');
    if (S.exactImages === false) return F('exact images off');
    if (!(PHASE[role || 'R'] || {})[viewKind]) return F(`${role || 'R'} ${viewKind}: not in this phase`);
    const plan = invPlan(m.a || 0, m.b || 0);
    if (!plan.ok) return F(plan.reason || 'no inverse');
    if (s._err) return F('invalid shape');
    if (forceFwd.has(s.id)) return F('forced forward');
    const recs = o.recs || lastRecs, rec = recs && recs.get(s.id);
    if (rec && !rec.ok) return rec.pending ? { path: 'pending', reason: rec.reason } : F(rec.reason || 'shape record');
    const e = invPrep(plan, s, !!o.budget);
    if (!e) return F('preparation deferred a frame');
    if (!e.prep.ok) return F(e.prep.reason || 'shape not eligible');
    if (!offRender && viewKind === 'flat' && guardDemotes(role, s, plan, e)) return F('cost guard');
    const out = { path: 'inverse', reason: null, m, plan, prep: e.prep, e };
    if (o.status) {
      const st = GLR.inverseStatus(S.alpha, viewKind), info = GLR.inverseInfo;
      // the query itself can land a compile (no GLR.onReady then): redraw the panes still showing a stand-in
      if (st === 'ready' && invWaiting.size) { const w = [...invWaiting]; invWaiting.clear(); requestRender(...w, 'T'); }
      if (st === 'pending' || (st === 'none' && info && info.ok)) { out.path = 'pending'; out.reason = 'compiling'; }
      else if (st === 'error') return F('inverse program failed to compile');
      else if (st === 'none') return F((info && info.reason) || 'no inverse program');
    }
    return out;
  }
  // starts the inverse compile for map (mode 0) when some visible area shape of the right plane could draw inverse
  function requestInverseFor(map) {
    if (!GLR.inverseRequest || !GLR.packShapes || typeof Inverse === 'undefined' || S.exactImages === false || !PHASE.R.flat) return;
    if (isIdentMap(map) || !invPlan(map.a || 0, map.b || 0).ok) return;
    const list = S.shapes.filter((s) => s.visible !== false && kindType(s) === 'area' && !s._err);
    if (!list.length) return;
    GLR.packShapes(S.shapes.filter((s) => s.visible !== false));
    if (GLR.inverseRequest(S.alpha, 'flat') === 'pending') invWaiting.add('R');
  }
  // a short message over a plane (GPU problems, an idle Cauchy or Integral view): a level-2 chip like the DOM ones
  // (--overlay, 1px --line-strong, --shadow-1, --r-2, --ink-2 text), wrapped to at most 360px, below the centre
  function paneNote(pane, text) {
    const ctx = pane.ctx;
    ctx.save();
    ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.font = `13px ${TH.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const maxW = Math.max(80, Math.min(360, pane.w - 48));
    const lines = [];
    let line = '';
    for (const w of String(text).split(' ')) {
      const t = line ? line + ' ' + w : w;
      if (line && ctx.measureText(t).width > maxW) { lines.push(line); line = w; } else line = t;
    }
    if (line) lines.push(line);
    const tw = Math.min(pane.w - 16, Math.max(...lines.map((t) => ctx.measureText(t).width)));
    const bw = Math.round(tw + 24), bh = lines.length * 18 + 14;
    const x0 = Math.round(pane.w / 2 - bw / 2) + 0.5, y0 = Math.round(Math.min(pane.h - bh - 56, pane.h / 2 + 28)) + 0.5;   // below the centre, clear of a point at the view's middle
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x0, y0, bw, bh, 3); else ctx.rect(x0, y0, bw, bh);
    ctx.shadowColor = TH.dark ? '#00000066' : '#121A201A'; ctx.shadowBlur = 2; ctx.shadowOffsetY = 1;
    ctx.fillStyle = withAlpha(TH.surface, 0.92); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = TH.lineStrong; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = TH.ink2;
    lines.forEach((t, i) => ctx.fillText(t, pane.w / 2, y0 + 7 + 9 + i * 18));
    ctx.restore();
  }
  // after a GPU frame: say why shapes are missing when the chain's shader failed (spec 8.6)
  function glStatusNote(pane) {
    const st = GLR.frameStatus ? GLR.frameStatus() : null;
    if (st && st.error) { paneNote(pane, st.error); setLed(pane === paneL ? 'L' : 'R', 'err', st.error); }
  }
  // Draw graph paper, fills and curves of every visible shape under the GPU map 'map'.
  // opt: {thin (thumbnail), L, cache, domain, noGrid, under (draws before the fills), arcF/arcKey (CPU map for dashes)}
  function drawScene(pane, map, role, opt = {}) {
    const list = S.shapes.filter((s) => s.visible !== false);
    // exact images (SPEC 10.2): when this map may draw inverse, the frame's shape records are packed once, and each
    // area shape takes its path in list order (inverse and forward passes interleave, so list order holds across paths)
    const m0 = normalizeMap(map);
    const live = (role === 'R' || role === 'L') && !offRender && !opt.thin;
    let recs = null, gf = null, timing = false, invN = 0;
    const halfDraws0 = GLR.inverseHalfDraws || 0;
    if (GLR.ok && GLR.packShapes && typeof Inverse !== 'undefined' && S.exactImages !== false && (PHASE[role || 'R'] || {}).flat
      && (m0.mode || 0) === 0 && !isIdentMap(m0) && invPlan(m0.a || 0, m0.b || 0).ok) {
      recs = GLR.packShapes(list).recs;
      if (!sideDraw) lastRecs = recs;
      if (live && guard) {
        const info = GLR.inverseInfo;
        // (the key includes the B class of the opacity: a trip at alpha 0.3 does not hold at alpha 1, P2 review)
        // (no predicted floor: motion stays at full resolution unless the measured frames leave the 60 fps budget;
        // predictLevel stays as a test hook)
        const floor = 0;
        halfPred[role] = 0;
        gf = guardFrame(role, pane, `${info ? info.key : ''}|${m0.a || 0}|${m0.b || 0}|${list.map((x) => x.id + x.kind).join(',')}|${pane.dpr}|B${GLR.inverseB ? GLR.inverseB(S.alpha) : ''}`, floor);
      }
    }
    // Who may start an inverse compile (SPEC 4.4): the live panes and exports (drawInverse starts it once the chain's
    // forward programs have landed). Thumbnails and gallery images only use a program that is already ready: a
    // thumbnail compile during a playing deformation stalled it, and compiled programs that no pane needed
    let invGate = null;
    if (recs && !live && !offRender) {
      const st0 = GLR.inverseStatus(S.alpha, 'flat');
      if (st0 !== 'ready') invGate = st0 === 'pending' ? 'pending' : 'forward';
    }
    // the cost guard's measurement: one TIME_ELAPSED bracket over the pane's whole frame, from before its clear to just
    // before the blit. A query that begins or ends inside a Metal render pass splits it (the reading then carries the
    // split's load and store, and the frame pays for it: +1-2 ms per measured frame at dpr 2 when it ended after the
    // fills, before the strokes); the blit ends the pass anyway. Only counting motion frames are measured, every
    // GUARD_EVERY-th one; still frames, which the guard ignores, never pay for it
    if (gf && gf.timed && gf.motion && paneG[role].nq++ % GUARD_EVERY === 0) {
      const q = paneG[role].qs;
      q.push({ t: performance.now(), motion: gf.motion, inv: false, lv: -1, dem: !!gf.demoted, hd0: GLR.inverseHalfDraws || 0 });
      if (q.length > 32) q.shift();
      timing = GLR.timer.begin(role);
      if (!timing) q.pop();
    }
    const cell = patternCell();
    // a half-resolution motion frame (the cost guard, SPEC 10.12): the leading run of inverse passes (in list order,
    // from the first shape drawn inverse to the next one that is not) goes into the half-size target BEFORE the pane's
    // main pass begins, and is upsampled at the run's place (GLR.beginHalfPre / compositeHalf, 13.14): binding the half
    // target inside the main pass split it, a store and a reload of the multisampled frame that cost as much as half
    // resolution saved. A pass that cannot draw at half resolution yet ends the run and draws in the main pass.
    let preIds = null, preDone = false;
    if (gf && gf.half && GLR.beginHalfPre && !invGate && GLR.beginHalfPre(pane.pw, pane.ph)) {
      preIds = new Set();
      for (const s of list) {
        if (kindType(s) !== 'area') continue;
        const p = pathOf(s, map, role, 'flat', { recs, budget: live });
        if (p.path !== 'inverse') { if (preIds.size) break; continue; }
        const box = invBox(p.e, p.plan, s, live);
        const sc = box ? GLR.scissorOf(box, pane.view, pane.dpr, 4) : null;
        if (sc && !sc[2]) { preIds.add(s.id); continue; }       // its image misses the pane: nothing to draw
        let alpha = S.alpha;
        if (hoverShape && hoverShape !== s.id) alpha *= 0.5;
        const ink = shapeInk(s);
        let res = 'error';
        try {
          res = GLR.drawInverse({
            map: p.m, plan: p.plan, prep: p.prep, shape: s, viewKind: 'flat', view: pane.view, dpr: pane.dpr,
            look: { color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha, alphaOwn: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), stretch: { shrink: GLR.hexRGB(TH.stretchShrink), grow: GLR.hexRGB(TH.stretchGrow), mid: GLR.hexRGB(TH.stretchMid) } },
            scissor: sc, half: true, halfPre: true, motion: live && interacting(), coldOk: offRender,
          });
        } catch (err) { res = 'error'; }
        if (res !== 'drawn') break;                             // drawn in the main pass, from here on
        preIds.add(s.id);
        invN++;
        if (invWaiting.size) { const w = [...invWaiting].filter((x) => x !== role || !live); invWaiting.clear(); requestRender(...w, 'T'); }
      }
    }
    GLR.begin(pane.pw, pane.ph);
    if (GLR.drawGrid && !opt.noGrid) {
      GLR.drawGrid({ view: pane.view, dpr: pane.dpr, plane: TH.planeRGB, minor: GLR.hexRGB(TH.gridMinor), medium: GLR.hexRGB(TH.gridMedium), major: GLR.hexRGB(TH.gridMajor), axis: TH.axisRGB, unit: S.unit && !opt.thin && !opt.noUnit, unitAlpha: 0.55 });
    }
    if (opt.under) opt.under();
    // the transform-feedback cache key includes the map mode and t, so any still frame may be cached; thumbnails
    // are kept as bitmaps, so they skip the map cache (GLR evaluates them into a scratch texture, as it does the
    // frames of a homotopy); a thumbnail never waits for a compile (a 250 ms stall
    // right after adding a step): it is redrawn when the program is ready (renderThumb, GLR.onReady)
    const cache = opt.cache !== false && !opt.thin;
    const sync = false;
    let arcFn = null;
    const arcF = () => arcFn || (arcFn = opt.arcF || cpuMap(map));
    const arcKey = opt.arcKey || mapKeyOf(map);
    const stretch = { shrink: GLR.hexRGB(TH.stretchShrink), grow: GLR.hexRGB(TH.stretchGrow), mid: GLR.hexRGB(TH.stretchMid) };
    if (live) prepDeferred = false;
    for (const s of list) {
      if (kindType(s) !== 'area') continue;
      const r = shapeGPU(s);
      const ink = shapeInk(s);
      let alpha = S.alpha;
      if (hoverShape && hoverShape !== s.id) alpha *= 0.5;
      // drawn in the half-resolution pre-pass: its layer is upsampled here, at the run's first shape
      if (preIds && preIds.has(s.id)) {
        if (!preDone) { GLR.compositeHalf(); preDone = true; }
        if (live) notePath(role, s.id, 'inverse');
        continue;
      }
      let lp = 'forward';
      if (recs) {
        const p = pathOf(s, map, role, 'flat', { recs, budget: live });
        lp = p.path;
        if (p.path === 'inverse' && invGate) {
          lp = invGate === 'pending' ? 'pending' : 'forward';
          if (invGate === 'pending') { if (live) invWaiting.add(role); else thumbNotFinal = true; }
        } else if (p.path === 'inverse') {
          const box = invBox(p.e, p.plan, s, live);
          const sc = box ? GLR.scissorOf(box, pane.view, pane.dpr, 4) : null;
          // an image that misses the pane draws nothing (counted as drawn)
          if (sc && !sc[2]) { if (live) notePath(role, s.id, 'inverse'); continue; }
          let res = 'error';
          try {
            res = GLR.drawInverse({
              map: p.m, plan: p.plan, prep: p.prep, shape: s, viewKind: 'flat', view: pane.view, dpr: pane.dpr,
              look: { color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha, alphaOwn: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), stretch },
              scissor: sc, half: !!(gf && gf.half), motion: live && interacting(), coldOk: offRender,
            });
          } catch (err) { if (!invThrew) { invThrew = true; console.error('exact images: inverse pass failed; drawing forward', err); } }
          if (res === 'drawn') {
            invN++;
            if (live) notePath(role, s.id, 'inverse');
            // the program landed (possibly inside this very call, without GLR.onReady): redraw the other panes that drew
            // a stand-in, and the thumbnails (one drawn forward meanwhile has a stale signature)
            if (invWaiting.size) { const w = [...invWaiting].filter((x) => x !== role || !live); invWaiting.clear(); requestRender(...w, 'T'); }
            continue;
          }
          lp = res === 'pending' ? 'pending' : 'forward';
          if (res === 'pending') { if (live) invWaiting.add(role); else thumbNotFinal = true; }
          // a failed compile (silent: console only) draws forward from now on, with its fix-ups (SPEC 4.4, 10.4)
          if (res === 'error' && GLR.inverseStatus(S.alpha, 'flat') === 'error') {
            const k = (GLR.inverseInfo || {}).key || '';
            if (k !== invFailKey) { invFailKey = k; scheduleFix(); }
          }
        }
        if (live) notePath(role, s.id, lp);
      }
      // the dragged shape's fix-up keeps up with the drag; the pair drawn is the current mesh with its fix-up, or the
      // last complete pair while the current one's is on its way (never an unfixed mesh in motion)
      if (live && role) liveFix(s, r);
      // SPEC 8: a published SphereMesh valid for this view replaces the GPU draw and its fix-ups; while a rebuild runs
      // the old one is drawn inside its guard box, the GPU image around it (exports: the meshes prepareExport built)
      const smd = (live || offRender) && role ? smFor(s, r, role, 'flat', map, pane, 0, live && lp !== 'pending') : null;
      if (smd && smd.e && (!smd.e.data.n || smRes(smd.e))) { if (smd.e.data.n) GLR.drawPreMapped(smd.e.res, smLook(s, pane, alpha, map)); continue; }   // (n 0: nothing of it shows)
      let smOld = null, smOut = null;
      if (smd && smd.old && smRes(smd.old)) {
        const sc = GLR.scissorOf(smd.old.guardBox, pane.view, pane.dpr, 0);
        if (sc === null) { GLR.drawPreMapped(smd.old.res, smLook(s, pane, alpha, map)); continue; }
        if (sc[2] > 0) {
          smOld = sc;
          // the pane around the guard box: up to four rects
          smOut = [[0, 0, pane.pw, sc[1]], [0, sc[1] + sc[3], pane.pw, pane.ph - sc[1] - sc[3]], [0, sc[1], sc[0], sc[3]], [sc[0] + sc[2], sc[1], pane.pw - sc[0] - sc[2], sc[3]]].filter((q) => q[2] > 0 && q[3] > 0);
        }
      }
      const pf = pairFor(s, r, role), pm = pf.p, fx = pf.fx;
      if (!pm.meshRes) { if (smOld) GLR.drawPreMapped(smd.old.res, Object.assign(smLook(s, pane, alpha, map), { scissor: smOld })); continue; }
      // feather only the sides where a stretched mesh is truncated far away, never a real boundary
      let fade = null;
      if (pm.mesh && pm.mesh.stretched && pm.mesh.outer) {
        if (!pm.fadeBox) {
          const o = pm.mesh.outer, op = pm.mesh.open, BIG = 1e30;
          pm.fadeBox = { x0: op.x0 ? o.x0 : -BIG, x1: op.x1 ? o.x1 : BIG, y0: op.y0 ? o.y0 : -BIG, y1: op.y1 ? o.y1 : BIG, w: 0.04 * Math.max(o.x1 - o.x0, o.y1 - o.y0) };
        }
        fade = pm.fadeBox;
      }
      const st = {
        map, view: pane.view, dpr: pane.dpr, L: opt.L || MESH_L, color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB,
        alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), skip: fx ? fx.skip : null, stretch, fade, sync,
        // the fix-up's skip flags are bound per draw and do not change the mapped values: not part of the key
        cacheKey: cache ? `${pm.meshKey}|${mapKeyOf(map)}` : null,
      };
      if (smOut) st.scissors = smOut;
      GLR.drawRegion(pm.meshRes, st);
      if (fx && fx.extraRes) GLR.drawRegion(fx.extraRes, Object.assign({}, st, { skip: null, L: 1, cacheKey: cache ? `x|${fx.mapKey}|${mapKeyOf(map)}` : null }));
      if (smOld) GLR.drawPreMapped(smd.old.res, Object.assign(smLook(s, pane, alpha, map), { scissor: smOld }));
    }
    if (gf) {
      const g = paneG[role];
      g.inv = invN > 0;
      // a half-resolution motion frame is followed by a full one once the motion stops
      g.half = !!(gf.half && invN && (GLR.inverseHalfDraws || 0) > halfDraws0);
      g.lv = drawnLevel(gf.demoted, g.half);
      if (g.half) halfSettle(role, 45);
    }
    // a bounded shape whose preparation waited (frame budget) is drawn inverse on the next frame
    if (live && prepDeferred) { prepDeferred = false; requestRender(role); }
    const halo = GLR.hexRGB(TH.halo);
    for (const s of hideStrokes ? [] : list) {
      if (kindType(s) === 'point') continue;
      const r0 = shapeGPU(s);
      // the strokes that go with the fill drawn (a hold's own strokes while it stands in for the current mesh)
      const r = role && r0.hold && kindType(s) === 'area' ? linesOf(r0, pairFor(s, r0, role).p) : r0;
      if (!r.lineRes) continue;
      const ink = shapeInk(s);
      const grid = s.kind === 'cgrid' || s.kind === 'pgrid';
      const area = kindType(s) === 'area';
      let w = opt.thin ? 1 : grid ? 1 : area ? 1.5 : 2;
      let cw = opt.thin ? 0 : grid ? 2.5 : area ? 3.5 : 4;
      if (!opt.thin && s.id === selected && opt.domain) { w += 0.75; cw += 0.75; }
      if (!opt.thin && s.id === hoverShape) { w += 0.5; cw += 0.5; }
      const st = { map, view: pane.view, dpr: pane.dpr, M: opt.thin ? 4 : 8, width: w * pane.dpr, color: GLR.hexRGB(ink.edge), alpha: grid ? 0.8 : 1, sync, cacheKey: cache ? `${r.lineKey}|${mapKeyOf(map)}` : null };
      if (cw) st.casing = { color: halo, alpha: TH.haloA, width: cw * pane.dpr };
      // open sets: the boundary is not included, drawn dashed 5/3.5 (spec 6.5)
      if (area && r.open && !opt.thin) { st.dash = [5, 3.5]; st.arc = arcOf(r, arcF(), arcKey); }
      GLR.drawLines(r.lineRes, st);
    }
    if (GLR.flushHalf) GLR.flushHalf();
    // (half: what the frame drew, not what it asked for: a program not yet warm for half resolution draws full)
    if (timing) { GLR.timer.end(); const q = paneG[role].qs; if (q.length) { const e = q[q.length - 1]; e.inv = invN > 0; e.lv = drawnLevel(e.dem, (GLR.inverseHalfDraws || 0) > e.hd0); if (e.inv) invPaneQ[role] = e; } }
    if (live && invN) invPaneQ.drew[role] = true;
    // a ready inverse program that waits for its first draw (or its first half-resolution draw) is warmed at a quiet
    // moment, then the panes redraw with it (P2 review: no 75-200 ms first-draw stall inside a drag or a transition).
    // Thumbnails too: a thumbnail's status query can land a compile (no GLR.onReady then) and find it cold.
    if (recs && !offRender && GLR.inverseColdWaiting) scheduleWarm(interacting() ? 100 : 0);
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    if (!opt.thin) glStatusNote(pane);
  }
  const PRIMES = ['', '′', '″', '‴'];
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  let figMode = false; // set while a figure is drawn: image points read F(z₀) rather than z₀″
  let figVec = false; // the figure draws the deformation's outline, paths and labels as vectors (the morph figure)
  function pointLabel(s, idx, primes) {
    const base = s.label || 'abcdefghjkmnpqrstuv'[idx % 19] + (idx >= 19 ? Math.floor(idx / 19) : '');
    // (a one-panel figure of the deformation draws H_t at the current t: its moving points read H_t(z₀))
    if (figMode && primes > 0 && morphOn() && !figVec) return `Hₜ(${base})`;
    if (figMode && primes > 0) return `${S.focus === 0 && primes === nSteps() ? 'F' : S.focus > 0 ? `f${sub(S.focus)}` : `w${sub(primes)}`}(${base})`;
    return base + (primes < 4 ? PRIMES[primes] : '⁽' + String(primes).split('').map((d) => SUP[+d]).join('') + '⁾');
  }
  // ---- labels of points, roots, targets and curve ends: one placer per plane and frame ----
  // Callers queue their labels (placeLabels); once the frame's drawing is done (a microtask, before paint) they are
  // placed together, so a label avoids every other label, every marker, the selected shape's handles and the cut
  // handles, whichever was drawn first, and prefers spots off the curves. Labels at one point merge ("z₀ = z₁");
  // a label with no free spot is dropped rather than printed over another. pane.begin() discards a stale queue.
  function labelReg(pane) {
    if (!pane.labels) pane.labels = { items: [], marks: [], curves: [], view: Object.assign({}, pane.view), queued: false };
    return pane.labels;
  }
  // the curves drawn in this plane: shapes of 'list' under F (from drawPoints), or a screen polyline (labelPath)
  function labelCurves(pane, F, list) { labelReg(pane).curves.push({ F, list }); }
  function labelPath(pane, xy) { labelReg(pane).curves.push({ xy }); }
  // labels: STIX italic for variables, Archivo for words. it: {x, y, text, word?, rad? (marker radius)}
  function placeLabels(ctx, pane, items) {
    const r = labelReg(pane);
    for (const it of items) { r.items.push(it); r.marks.push([it.x, it.y, it.rad || 8]); }
    if (!r.queued) { r.queued = true; queueMicrotask(() => flushLabels(pane, r)); }
  }
  const lblPolys = new WeakMap(); // shape (not in the GPU cache, e.g. a target) -> {key, polys} in the target window
  function labelPolysOf(s) {
    const g = gpu.get(s.id);
    if (g && g.polys && S.shapes.includes(s)) return g.polys;
    const win = targetWin(), key = shapeKey(s) + JSON.stringify(win);
    let c = lblPolys.get(s);
    if (!c || c.key !== key) {
      let polys = [];
      try { polys = Region.curvesOf(s, win).map((cv) => Region.sampleCurve(cv, win)).filter((p) => p.length >= 4); } catch (e) { polys = []; }
      c = { key, polys }; lblPolys.set(s, c);
    }
    return c.polys;
  }
  function flushLabels(pane, r) {
    if (pane.labels !== r) return;   // the plane was redrawn since: its own queue follows
    pane.labels = null;
    if (!r.items.length) return;
    const v0 = pane.view; pane.view = r.view;
    try { flushLabelsIn(pane, r); } finally { pane.view = v0; }
  }
  function flushLabelsIn(pane, r) {
    const ctx = pane.ctx, W = pane.w, H = pane.h;
    // hard obstacles: markers (points, roots, curve ends), handles of the selected shape and the cut handles
    const marks = r.marks;
    const hard = [];
    const sel = pane === paneL && lFlat() && leftStage() === 0 ? S.shapes.find((x) => x.id === selected)
      : pane === paneR && rImage() && targetsEditable() ? (S.targets || []).find((x) => x.id === selected) : null;
    if (sel) {
      try { for (const [, z] of Region.handlesOf(sel)) { const [x, y] = pane.w2s(z); hard.push({ x0: x - 7, x1: x + 7, y0: y - 7, y1: y + 7 }); } } catch (e) { /* no handles */ }
    }
    if (pane === paneL && lFlat()) for (const hd of cutHandlesL) hard.push({ x0: hd.x - 8, x1: hd.x + 84, y0: hd.y - 11, y1: hd.y + 11 });
    // soft obstacles: the curves, as a 4px occupancy grid
    const G = 4, gw = Math.ceil(W / G) + 2, gh = Math.ceil(H / G) + 2;
    let grid = null;
    const mark = (x0, y0, x1, y1) => {
      const n = Math.min(400, Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / 2));
      for (let i = 0; i <= n; i++) {
        const u = n ? i / n : 0, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u;
        if (x < -G || y < -G || x > W + G || y > H + G) continue;
        grid[(Math.floor(y / G) + 1) * gw + Math.floor(x / G) + 1] = 1;
      }
    };
    const markXY = (xy) => {
      for (let i = 2; i + 1 < xy.length; i += 2) {
        const ax = xy[i - 2], ay = xy[i - 1], bx = xy[i], by = xy[i + 1];
        if (!Number.isFinite(ax + ay + bx + by)) continue;
        if (Math.abs(bx - ax) + Math.abs(by - ay) > 2 * (W + H)) continue;   // a jump across a cut, not a curve
        if ((ax < 0 && bx < 0) || (ay < 0 && by < 0) || (ax > W && bx > W) || (ay > H && by > H)) continue;
        mark(ax, ay, bx, by);
      }
    };
    for (const c of r.curves) {
      if (!grid) grid = new Uint8Array(gw * gh);
      if (c.xy) { markXY(c.xy); continue; }
      for (const s of c.list || []) {
        if (s.visible === false || kindType(s) === 'point') continue;
        for (const p of labelPolysOf(s)) {
          const n = p.length / 2, stride = Math.max(1, Math.floor(n / 600)), xy = [];
          for (let i = 0; i < n; i += stride) {
            const w = c.F(C(p[2 * i], p[2 * i + 1]));
            if (CX.isFin(w)) { const q = pane.w2s(w); xy.push(q[0], q[1]); } else xy.push(NaN, NaN);
          }
          if (stride > 1 && (n - 1) % stride) { const w = c.F(C(p[p.length - 2], p[p.length - 1])); if (CX.isFin(w)) xy.push(...pane.w2s(w)); }
          markXY(xy);
        }
      }
    }
    const curveCost = (x0, y0, x1, y1) => {
      if (!grid) return 0;
      let n = 0;
      const i0 = Math.max(0, Math.floor((x0 + 1) / G) + 1), i1 = Math.min(gw - 1, Math.floor((x1 - 1) / G) + 1);
      const j0 = Math.max(0, Math.floor((y0 + 1) / G) + 1), j1 = Math.min(gh - 1, Math.floor((y1 - 1) / G) + 1);
      for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) n += grid[j * gw + i];
      return n;
    };
    // merge labels at one point (a root on a shape point, a target on an image point)
    const groups = [];
    for (const it of r.items) {
      const g = groups.find((q) => Math.abs(q.x - it.x) < 2.5 && Math.abs(q.y - it.y) < 2.5);
      const word = /\s|[a-z]{3,}/i.test(it.text) && !/^[a-z][′″‴⁽]?/i.test(it.text.slice(0, 2)) ? true : !!it.word;
      if (g) { if (!g.texts.includes(it.text)) g.texts.push(it.text); g.word = g.word && word; }
      else groups.push({ x: it.x, y: it.y, texts: [it.text], word });
    }
    const placed = [];
    const th = 13;
    let mcx = 0, mcy = 0;
    for (const m of marks) { mcx += m[0] / marks.length; mcy += m[1] / marks.length; }
    ctx.save();
    ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.lineWidth = 3;
    for (const g of groups) {
      const text = g.texts.join(' = ');
      ctx.font = g.word ? `500 12px ${TH.ui}` : `italic 500 13px ${TH.math}`;
      const tw = ctx.measureText(text).width;
      // NE, NW, SE, SW; then E, W, N, S; then the diagonals one step further out
      const cands = [[7, -7, 0], [-7 - tw, -7, 0], [7, 7 + th, 0], [-7 - tw, 7 + th, 0],
        [10, th / 2 - 1, 0.6], [-10 - tw, th / 2 - 1, 0.6], [-tw / 2, -10, 0.6], [-tw / 2, 10 + th, 0.6],
        [13, -13, 2], [-13 - tw, -13, 2], [13, 13 + th, 2], [-13 - tw, 13 + th, 2]];
      // in a cluster (roots on a circle), straight out from the cluster's centre
      const ux = g.x - mcx, uy = g.y - mcy, ul = Math.hypot(ux, uy);
      if (marks.length > 2 && ul > 1) {
        for (const [d, pen] of [[9, 0.3], [16, 1.2]]) {
          const ax = g.x + d * ux / ul, ay = g.y + d * uy / ul;
          cands.splice(4, 0, [ax - g.x + (ux / ul - 1) * tw / 2, ay - g.y + (uy / ul + 1) * th / 2, pen]);
        }
      }
      let best = null, bestCost = Infinity;
      for (const [dx, dy, pen] of cands) {
        const x0 = g.x + dx, y1 = g.y + dy, y0 = y1 - th, x1 = x0 + tw;
        if (x0 < 2 || x1 > W - 2 || y0 < 2 || y1 > H - 2) continue;
        const hit = (b) => x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0;
        if (placed.some(hit) || hard.some(hit)) continue;
        if (marks.some(([mx, my, rad]) => (Math.abs(mx - g.x) >= 2.5 || Math.abs(my - g.y) >= 2.5) && x0 < mx + rad && x1 > mx - rad && y0 < my + rad && y1 > my - rad)) continue;
        // a label nearer another marker than its own reads as that marker's: allowed only as a last resort
        const bx = (x0 + x1) / 2, by = (y0 + y1) / 2, dOwn = Math.hypot(bx - g.x, by - g.y);
        const amb = marks.some(([mx, my]) => (Math.abs(mx - g.x) >= 2.5 || Math.abs(my - g.y) >= 2.5) && Math.hypot(bx - mx, by - my) < dOwn - 1);
        const cost = Math.min(3, 0.5 * curveCost(x0, y0, x1, y1)) + pen + (amb ? 4 : 0);
        if (cost < bestCost) { best = [x0, y1]; bestCost = cost; if (cost === 0) break; }
      }
      if (!best) continue;   // no free spot: dropped, never printed over another label or a handle
      const [x, y] = best;
      placed.push({ x0: x - 1, x1: x + tw + 1, y0: y - th - 1, y1: y + 2 });
      ctx.strokeStyle = TH.halo; ctx.strokeText(text, x, y);
      ctx.fillStyle = TH.ink; ctx.fillText(text, x, y);
    }
    ctx.restore();
  }
  function drawPoints(pane, F, opt = {}) {
    const ctx = pane.ctx;
    let pi = 0;
    const labels = [];
    if (!opt.thin) labelCurves(pane, F, opt.list || S.shapes);   // labels keep off these curves
    for (const s of opt.list || S.shapes) {
      if (s.visible === false || kindType(s) !== 'point') continue;
      const idx = pi++;
      const w = F(C(s.p[0], s.p[1]));
      if (!CX.isFin(w)) continue;
      const [x, y] = pane.w2s(w);
      if (x < -20 || y < -20 || x > pane.w + 20 || y > pane.h + 20) continue;
      const ink = shapeInk(s);
      ctx.fillStyle = ink.edge;
      ctx.strokeStyle = TH.halo;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, opt.thin ? 2.6 : 4, 0, TAU); ctx.stroke(); ctx.fill();
      if (!opt.thin && s.id === selected && opt.domain) { ctx.strokeStyle = ink.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke(); }
      if (!opt.thin) labels.push({ x, y, text: opt.target ? targetLabel(s, idx) : pointLabel(s, idx, opt.primes || 0), word:!!(s.label && /\s|[A-Za-z]{3,}/.test(s.label)) });
    }
    if (labels.length) placeLabels(ctx, pane, labels);
  }
  // branch cuts and poles of step k+1 live in the plane of stage k
  function drawCuts(pane, k, editable, thin) {
    const st = S.steps[k];
    const b = built[k];
    if (!st || st.on === false || !b || b.error) return [];
    const ctx = pane.ctx;
    const handles = [];
    ctx.save();
    ctx.lineCap = 'round';
    for (const c of b.cuts) {
      let x0, y0, x1, y1;
      if (c.kind === 'ray') {
        const d = C(Math.cos(c.ang), Math.sin(c.ang));
        const cl = Region.clipLine(c.p, d, Region.expandBox(pane.box(), 1.2), 0);
        if (!cl) continue;
        [x0, y0] = pane.w2s(cl[0]); [x1, y1] = pane.w2s(cl[1]);
        if (c.editable && editable) {
          const bx = pane.box();
          const R = Math.min(bx.x1 - bx.x0, bx.y1 - bx.y0) * 0.33;
          const [hx, hy] = pane.w2s(CX.add(c.p, CX.scale(d, R)));
          handles.push({ x: hx, y: hy, step: k + 1, p: c.p, deg: st.params.cut ?? 180 });
        }
      } else if (c.kind === 'seg') {
        [x0, y0] = pane.w2s(c.a); [x1, y1] = pane.w2s(c.b);
      } else continue;
      ctx.strokeStyle = TH.halo; ctx.globalAlpha = TH.haloA; ctx.lineWidth = thin ? 2.5 : 3.5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = TH.cut; ctx.lineWidth = thin ? 1.25 : 1.75;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      if (!thin && c.kind === 'ray') {
        // hatches on the closed side (the side whose values the cut takes: clockwise of the ray)
        const L = Math.hypot(x1 - x0, y1 - y0), ux = (x1 - x0) / L, uy = (y1 - y0) / L;
        const nx = -uy, ny = ux;
        ctx.lineWidth = 1.25;
        ctx.beginPath();
        for (let t = 8; t < L; t += 7) { const px = x0 + ux * t, py = y0 + uy * t; ctx.moveTo(px, py); ctx.lineTo(px + (nx - ux) * 3.54, py + (ny - uy) * 3.54); }
        ctx.stroke();
        // branch point
        ctx.fillStyle = TH.halo; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x0, y0, 3.5, 0, TAU); ctx.fill(); ctx.stroke();
      }
    }
    const sc = thin ? 0.66 : 1;
    // a zeros-and-poles step: its handles draw them in its input plane (drawZpHandles); elsewhere (a figure, the
    // thumbnails) its zeros are dots in the zero ink beside the pole crosses
    if (b.def && b.def.id === 'zp') {
      if (editable && !figMode && lFlat()) { ctx.restore(); return handles; }
      for (const z of b.zp.zeros) {
        if (!CX.isFin(z)) continue;
        const [x, y] = pane.w2s(z);
        ctx.fillStyle = TH.zero; ctx.strokeStyle = TH.halo; ctx.lineWidth = 2.5 * sc;
        ctx.beginPath(); ctx.arc(x, y, 4 * sc, 0, TAU); ctx.stroke(); ctx.fill();
      }
    }
    for (const p of b.poles) {
      if (!CX.isFin(p)) continue;
      const [x, y] = pane.w2s(p);
      const r = 4.5 * sc;
      const cross = () => { ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); };
      ctx.strokeStyle = TH.halo; ctx.lineWidth = 4 * sc; cross();
      ctx.strokeStyle = TH.pole; ctx.lineWidth = 1.75 * sc; cross();
    }
    ctx.restore();
    return handles;
  }
  // images of the two banks of each ray cut, in the plane of stage R (dashed)
  function drawCutBanks(pane, R) {
    const ctx = pane.ctx;
    ctx.save();
    ctx.setLineDash([4, 3]); ctx.lineWidth = 1; ctx.strokeStyle = TH.cut; ctx.globalAlpha = 0.7;
    for (let k = 1; k <= R; k++) {
      const b = built[k - 1];
      // a d/dz step after the cut's step makes the stage no function of the cut's plane: no banks to draw
      if (!stepFn(k) || !b || derivIn(k - 1, R)) continue;
      const tail = (z) => { for (let j = k; j <= R; j++) { const f = stepFn(j); if (f) z = f(z); } return z; };
      for (const c of b.cuts) {
        if (c.kind !== 'ray') continue;
        for (const side of [-1, 1]) {
          const a = c.ang + side * 1e-7;
          ctx.beginPath();
          let pen = false;
          for (let i = 0; i <= 200; i++) {
            const rr = 1e-3 * Math.pow(1e7, i / 200);
            const z = C(c.p.re + rr * Math.cos(a), c.p.im + rr * Math.sin(a));
            const w = tail(z);
            if (!CX.isFin(w)) { pen = false; continue; }
            const [x, y] = pane.w2s(w);
            if (Math.abs(x) > 1e5 || Math.abs(y) > 1e5) { pen = false; continue; }
            if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            pen = true;
          }
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }
  // image of the left viewport rectangle (where the left view lands)
  function drawFov(pane, F) {
    const b = leftPaneBox();
    const ctx = pane.ctx;
    const corners = [C(b.x0, b.y0), C(b.x1, b.y0), C(b.x1, b.y1), C(b.x0, b.y1)];
    ctx.save();
    ctx.strokeStyle = TH.fov; ctx.globalAlpha = TH.fovA; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
    ctx.beginPath();
    for (let e = 0; e < 4; e++) {
      const p = corners[e], q = corners[(e + 1) % 4];
      let pen = false, lx = 0, ly = 0;
      for (let i = 0; i <= 64; i++) {
        const w = F(C(p.re + (q.re - p.re) * i / 64, p.im + (q.im - p.im) * i / 64));
        if (!CX.isFin(w)) { pen = false; continue; }
        const [x, y] = pane.w2s(w);
        if (pen && Math.hypot(x - lx, y - ly) > 200) pen = false;
        if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
        pen = true; lx = x; ly = y;
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);
    for (const c of corners) { const w = F(c); if (!CX.isFin(w)) continue; const [x, y] = pane.w2s(w); ctx.strokeRect(x - 2, y - 2, 4, 4); }
    ctx.restore();
  }
  // orientation chevrons: at mid-length of open curves and at angle 0 of closed boundaries
  function drawChevrons(pane, F) {
    if (!S.chev) return;
    const ctx = pane.ctx;
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point' || s.kind === 'cgrid' || s.kind === 'pgrid') continue;
      const r = gpu.get(s.id);
      if (!r || !r.polys) continue;
      ctx.strokeStyle = shapeInk(s).edge; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
      for (const p of r.polys) {
        const n = p.length / 2;
        if (n < 3) continue;
        let i;
        const closed = Math.hypot(p[0] - p[2 * n - 2], p[1] - p[2 * n - 1]) < 1e-9;
        if (closed) {
          let cx = 0, cy = 0; for (let j = 0; j < n; j++) { cx += p[2 * j]; cy += p[2 * j + 1]; } cx /= n; cy /= n;
          let best = 1e9; i = 1;
          for (let j = 1; j < n - 1; j++) { const a = Math.abs(Math.atan2(p[2 * j + 1] - cy, p[2 * j] - cx)); if (a < best && p[2 * j] > cx) { best = a; i = j; } }
        } else {
          let total = 0; const acc = [0];
          for (let j = 1; j < n; j++) { total += Math.hypot(p[2 * j] - p[2 * j - 2], p[2 * j + 1] - p[2 * j - 1]); acc.push(total); }
          i = Math.max(1, Math.min(n - 2, acc.findIndex((v) => v >= total / 2)));
        }
        const z0 = C(p[2 * i - 2], p[2 * i - 1]), z1 = C(p[2 * i + 2], p[2 * i + 3]);
        const w0 = F(z0), w1 = F(z1), wm = F(C(p[2 * i], p[2 * i + 1]));
        if (!CX.isFin(w0) || !CX.isFin(w1) || !CX.isFin(wm)) continue;
        const [x, y] = pane.w2s(wm), [ax, ay] = pane.w2s(w0), [bx, by] = pane.w2s(w1);
        const L = Math.hypot(bx - ax, by - ay);
        if (!(L > 1e-6) || x < 0 || y < 0 || x > pane.w || y > pane.h) continue;
        const ux = (bx - ax) / L, uy = (by - ay) / L;
        ctx.beginPath();
        ctx.moveTo(x - ux * 3 - uy * 3.5, y - uy * 3 + ux * 3.5); ctx.lineTo(x + ux * 3, y + uy * 3); ctx.lineTo(x - ux * 3 + uy * 3.5, y - uy * 3 - ux * 3.5);
        ctx.stroke();
      }
    }
  }
  // overlay layer: cut handles, selection handles, drawing previews, probes
  function chip(ctx, x, y, text, color, border, font) {
    ctx.font = font || `11px ${TH.mono}`;
    const tw = ctx.measureText(text).width;
    const w = tw + 12, hgt = 20;
    ctx.fillStyle = withAlpha(TH.surface, 0.92); ctx.strokeStyle = border || TH.lineStrong; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x, y - hgt / 2, w, hgt, 3) : ctx.rect(x, y - hgt / 2, w, hgt); ctx.fill(); ctx.stroke();
    ctx.fillStyle = color || TH.ink; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 6, y + 0.5);
  }
  function drawCutHandles(pane, handles) {
    const ctx = pane.octx;
    for (const hd of handles) {
      const dragging = drag && drag.mode === 'cut' && drag.step === hd.step;
      const hot = hoverCut === hd.step || dragging;
      if (dragging) {
        const [bx, by] = pane.w2s(hd.p);
        const r = 40, ang = hd.deg * DEG;
        ctx.save();
        ctx.strokeStyle = TH.cut; ctx.lineWidth = 1; ctx.globalAlpha = 0.5;
        ctx.beginPath(); ctx.arc(bx, by, r, 0, -ang, ang > 0); ctx.stroke();
        ctx.beginPath();
        for (let q = 0; q < 24; q++) { const a = q * Math.PI / 12; const r2 = q % 3 === 0 ? r + 6 : r + 3.5; ctx.moveTo(bx + r * Math.cos(a), by - r * Math.sin(a)); ctx.lineTo(bx + r2 * Math.cos(a), by - r2 * Math.sin(a)); }
        ctx.stroke();
        ctx.globalAlpha = 0.85; ctx.fillStyle = TH.cut; ctx.font = `10px ${TH.mono}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        for (let q = 0; q < 8; q++) { const a = q * Math.PI / 4; ctx.fillText(`${q * 45}`, bx + (r + 14) * Math.cos(a), by - (r + 14) * Math.sin(a)); }
        ctx.restore();
      }
      ctx.fillStyle = TH.halo; ctx.strokeStyle = TH.cut; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(hd.x, hd.y, hot ? 7 : 6, 0, TAU); ctx.fill(); ctx.stroke();
      chip(ctx, hd.x + 14, hd.y, `θ ${CX.fmtNum(hd.deg, 1).replace('-', '−')}°`, TH.cut, TH.cut);
    }
  }
  // ---- zeros and poles of a 'zp' step, dragged in its input plane (notes/ui-design/zeros-poles.md) ----
  // A zero is a filled dot in the zero ink with a pip, a pole a cross in the pole colour, labelled ζ₁, ζ₂, … and p₁, p₂, …
  // as on the card (shape handles are white squares and circles; target roots are rings in the target's colour).
  const ZP_KINDS = ['zeros', 'poles'];
  const zpSym = (kind, i) => (kind === 'zeros' ? 'ζ' : 'p') + sub(i + 1);
  // (the marks are drawn with every overlay frame: a field's text is parsed once)
  const zpParsed = new Map();
  const zpParse = (s) => {
    if (zpParsed.has(s)) return zpParsed.get(s);
    let v = null;
    try { v = Expr.constValue(s); if (!CX.isFin(v)) v = null; } catch (e) { v = null; }
    if (zpParsed.size > 512) zpParsed.clear();
    zpParsed.set(s, v);
    return v;
  };
  const zpSame = (a, k, kind, i) => !!a && a.k === k && a.kind === kind && a.i === i;
  const zpItems = (st, kind) => Funcs.splitList(st.params[kind]);
  // the zeros-and-poles step that acts on the plane X shows (its input plane): step 1 at the whole chain, step k when
  // k is focused. {k, st, items: {zeros, poles}} (values; null where a field does not parse) or null
  function zpStep() {
    if (!S || !paneL || solo() === 'R' || !lFlat()) return null;
    const j = leftStage(), st = S.steps[j];
    if (!st || st.type !== 'zp' || st.on === false) return null;
    const items = {};
    for (const kind of ZP_KINDS) items[kind] = zpItems(st, kind).map(zpParse);
    return { k: j + 1, st, items };
  }
  // (a finger gets a larger target)
  // (handles on one spot, a zero snapped onto a pole: a press takes the one not selected, so repeated clicks cycle)
  function zpHit(x, y, r = 11) {
    const near = zpHandlesL.map((hd) => ({ hd, d: Math.hypot(hd.x - x, hd.y - y) })).filter((q) => q.d < r).sort((a, b) => a.d - b.d);
    if (!near.length) return null;
    const tie = near.filter((q) => q.d - near[0].d < 1);
    const i = tie.findIndex((q) => zpSame(zpSel, q.hd.k, q.hd.kind, q.hd.i));
    return i >= 0 ? tie[(i + 1) % tie.length].hd : near[0].hd;
  }
  function drawZpHandles(pane) {
    const zs = zpStep();
    if (!zs) return;
    const ctx = pane.octx;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const kind of ZP_KINDS) zs.items[kind].forEach((z, i) => {
      if (!z) return;
      const dr = drag && drag.mode === 'zp' && zpSame(drag, zs.k, kind, i) ? drag : null;
      let [x, y] = pane.w2s(z);
      // dragged off the plane: shown faded at the edge where the pointer is, with what a release does
      if (dr && dr.off) { x = Math.max(12, Math.min(pane.w - 12, dr.x)); y = Math.max(12, Math.min(pane.h - 12, dr.y)); }
      zpHandlesL.push({ x, y, k: zs.k, kind, i });
      if (x < -16 || y < -16 || x > pane.w + 16 || y > pane.h + 16) return;
      const hot = !!dr || zpSame(zpHover, zs.k, kind, i), sel = zpSame(zpSel, zs.k, kind, i);
      const col = kind === 'zeros' ? TH.zero : TH.pole, r = hot ? 6 : 5;
      ctx.globalAlpha = dr && dr.off ? 0.45 : 1;
      if (kind === 'zeros') {
        ctx.fillStyle = col; ctx.strokeStyle = TH.halo; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke(); ctx.fill();
        ctx.fillStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, 1.75, 0, TAU); ctx.fill();
      } else {
        const cross = () => { ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); };
        ctx.strokeStyle = TH.halo; ctx.lineWidth = 6; cross();
        ctx.strokeStyle = col; ctx.lineWidth = 2.5; cross();
      }
      if (hot || sel) { ctx.strokeStyle = col; ctx.lineWidth = sel ? 1.5 : 1; ctx.beginPath(); ctx.arc(x, y, 10.5, 0, TAU); ctx.stroke(); }
      const t = zpSym(kind, i);
      // (no label where handles crowd: closer than 18 px to one drawn before, unless it is held or selected)
      const crowd = !hot && !sel && zpHandlesL.slice(0, -1).some((q) => Math.hypot(q.x - x, q.y - y) < 18);
      ctx.font = `italic 500 13px ${TH.math}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (!crowd) {
        ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.strokeText(t, x + 9, y - 8);
        ctx.fillStyle = kind === 'zeros' ? TH.ink : TH.pole; ctx.fillText(t, x + 9, y - 8);
      }
      if (dr && dr.off) {
        ctx.globalAlpha = 1;
        const msg = `Release to remove ${t}`;
        ctx.font = `11px ${TH.mono}`;
        const cw = ctx.measureText(msg).width + 12;
        chip(ctx, x + 14 + cw > pane.w - 4 ? x - 14 - cw : x + 14, Math.min(pane.h - 14, y + 18), msg, TH.error, TH.error);
      }
    });
    ctx.restore();
  }
  // a dragged value: to the decade below a pixel (never more than a pixel off; a snapped value stays as snapped)
  function zpRound(pane, z) {
    const q = Math.pow(10, Math.floor(Math.log10(1 / pane.view.s)));
    const r = (x) => +(Math.round(x / q) * q).toPrecision(12);
    return C(r(z.re), r(z.im));
  }
  function zpWrite(st, kind, list) { st.params[kind] = list.join(', '); }
  // the card fields of step k (its card and its compact popover) show the values of the step (a field being typed in
  // keeps its text)
  function syncZpFields(k) {
    const st = S.steps[k - 1];
    if (!st || st.type !== 'zp') return;
    const lists = { zeros: zpItems(st, 'zeros'), poles: zpItems(st, 'poles') };
    // (two columns while every value fits one, as zpFields lays them out)
    const wide = ZP_KINDS.some((kind) => lists[kind].some((raw) => raw.length > 8));
    for (const el of document.querySelectorAll(`#pipeline .card[data-k="${k}"] input[data-zp], .card-pop[data-k="${k}"] input[data-zp]`)) {
      const row = el.closest('.zp-item');
      if (row) row.classList.toggle('wide1', wide);
      if (document.activeElement === el) continue;
      const [kind, i] = el.dataset.zp.split(':');
      const v = lists[kind][+i];
      if (v != null && el.value !== v) { el.value = v; el.classList.remove('bad'); }
    }
  }
  // the card's parameter fields again (after a zero or pole was added or removed), keeping the field list's scroll
  function refreshZpCard(k) {
    const st = S.steps[k - 1];
    if (!st || st.type !== 'zp') return;
    for (const [sel, pre] of [[`#pipeline .card[data-k="${k}"] .params`, 'p'], [`.card-pop[data-k="${k}"] .params`, 'pp']]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const top = el.scrollTop;
      el.innerHTML = '';
      el.append(zpFields(st, k, pre));
      el.scrollTop = top;
    }
  }
  function zpSet(k, kind, i, v) {
    const st = S.steps[k - 1];
    if (!st) return;
    const list = zpItems(st, kind);
    if (i >= list.length) return;
    const item = Funcs.zpItem(v);
    if (list[i] === item) return;
    list[i] = item;
    zpWrite(st, kind, list);
    chainChanged(false);
    syncZpFields(k);
  }
  // a free spot for a new zero or pole: the grid node nearest the centre of X's view (a 1-2-5 step of at least
  // 40 px) that is at least 22 px from every zero and pole, nearest first
  function zpFreeSpot(k) {
    const st = S.steps[k - 1];
    paneL.setView(leftView());
    const v = leftView(), d0 = Math.pow(10, Math.floor(Math.log10(40 / v.s)));
    const step = [1, 2, 5, 10].map((m) => m * d0).find((x) => x * v.s >= 40) || 10 * d0;
    const have = ZP_KINDS.flatMap((kind) => zpItems(st, kind).map(zpParse)).filter(Boolean);
    const cx = Math.round(v.cx / step), cy = Math.round(v.cy / step), cands = [];
    for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) cands.push([cx + i, cy + j]);
    const r = (x) => +(x * step).toPrecision(12);
    cands.sort((p, q) => Math.hypot(p[0] * step - v.cx, p[1] * step - v.cy) - Math.hypot(q[0] * step - v.cx, q[1] * step - v.cy));
    for (const [i, j] of cands) {
      const z = C(r(i), r(j));
      if (have.every((q) => CX.abs(CX.sub(q, z)) * v.s > 22)) return z;
    }
    return zpRound(paneL, C(v.cx, v.cy));
  }
  // add a zero or a pole to step k (at v, else a free spot): its index. Not committed (the caller commits).
  function zpAdd(k, kind, v) {
    const st = S.steps[k - 1];
    if (!st || st.type !== 'zp') return -1;
    const list = zpItems(st, kind);
    if (list.length >= Funcs.ZP_MAX) { toast(`At most ${Funcs.ZP_MAX} ${kind} (degree ${Funcs.ZP_MAX}, as Write by zeros and poles allows).`); return -1; }
    const z = v || zpFreeSpot(k);
    list.push(Funcs.zpItem(z));
    zpWrite(st, kind, list);
    zpSel = { k, kind, i: list.length - 1 };
    if (selected) { selected = null; buildShapeList(); }
    chainChanged(false);
    refreshZpCard(k);
    return list.length - 1;
  }
  // the card's + buttons: a new zero or pole in view; the step is focused so that its input plane shows it
  function zpAddFromCard(k, kind) {
    if (!zpStep() || zpStep().k !== k) setFocus(k);
    const i = zpAdd(k, kind);
    if (i < 0) return;
    commit();
    requestRender('OL');
    const inp = document.querySelector(`#pipeline .card[data-k="${k}"] input[data-zp="${kind}:${i}"]`);
    if (inp) inp.scrollIntoView({ block: 'nearest' });
  }
  function zpRemove(k, kind, i) {
    const st = S.steps[k - 1];
    if (!st || st.type !== 'zp') return;
    const list = zpItems(st, kind);
    if (i < 0 || i >= list.length) return;
    list.splice(i, 1);
    zpWrite(st, kind, list);
    if (zpSame(zpSel, k, kind, i)) zpSel = null;
    else if (zpSel && zpSel.k === k && zpSel.kind === kind && zpSel.i > i) zpSel.i--;
    zpHover = null;
    chainChanged(false);
    refreshZpCard(k);
    commit();
    requestRender('OL');
  }
  // the parameter fields of a 'zp' card: a, the + zero / + pole buttons, then one field per zero and per pole
  function zpFields(st, k, pre) {
    const d = Funcs.DEFS.zp;
    const frag = document.createDocumentFragment();
    frag.append(paramField(st, k, d.params[0], pre));
    const n = { zeros: zpItems(st, 'zeros').length, poles: zpItems(st, 'poles').length }, MAX = Funcs.ZP_MAX;
    const addBtn = (kind) => {
      const full = n[kind] >= MAX, one = kind === 'zeros' ? 'zero' : 'pole';
      const b = h('button', { class: 'zp-add ' + kind, type: 'button',
        'data-tip': full ? `At most ${MAX} ${kind}` : kind === 'zeros' ? 'Add a zero (or Shift-click in the input plane)' : 'Add a pole (or Shift-⌘-click in the input plane)',
        'aria-label': `Add a ${one} to f${sub(k)} (${n[kind]} now)`,
        onclick: (e) => { e.stopPropagation(); zpAddFromCard(k, kind); } },
      h('span', { class: 'zp-mark', 'aria-hidden': 'true' }), one, h('span', { class: 'zp-n', 'aria-hidden': 'true' }, String(n[kind])));
      if (full) b.disabled = true;
      return b;
    };
    frag.append(h('div', { class: 'pf zp-adds' }, addBtn('zeros'), addBtn('poles')));
    // two columns while every value fits one (8 characters), else one per row at full width
    const wide = ZP_KINDS.some((kind) => zpItems(st, kind).some((raw) => raw.length > 8));
    for (const kind of ZP_KINDS) zpItems(st, kind).forEach((raw, i) => { const el = zpItemField(st, k, kind, i, raw, pre); if (wide) el.classList.add('wide1'); frag.append(el); });
    return frag;
  }
  function zpItemField(st, k, kind, i, raw, pre) {
    const id = `${pre}${k}_${kind}${i}`, sym = zpSym(kind, i), what = kind === 'zeros' ? 'zero' : 'pole';
    const input = h('input', { class: 'inp', id, value: raw, spellcheck: 'false', autocomplete: 'off' });
    input.dataset.zp = `${kind}:${i}`;
    // the list is rebuilt from this field set's own fields (an emptied field drops out until it is left)
    const fields = () => [...input.closest('.params').querySelectorAll(`input[data-zp^="${kind}:"]`)];
    input.addEventListener('input', () => {
      input.classList.toggle('bad', !zpParse(input.value));
      st.params[kind] = fields().map((el) => el.value.trim()).filter((x) => x).join(', ');
      chainChanged(false);
      requestRender('OL');
    });
    // (a field emptied, or holding a list '0.5, 0.5i': the card again, one field per item, so fields and handles
    // keep their indices)
    input.addEventListener('change', () => {
      if (Funcs.splitList(input.value).filter((x) => x.trim()).length !== 1) { refreshZpCard(k); syncZpFields(k); }
      commit();
    });
    input.addEventListener('paste', () => setTimeout(() => { if (Funcs.splitList(input.value).filter((x) => x.trim()).length > 1) { input.blur(); } }, 0));
    const del = h('button', { class: 'icon-btn zp-del', type: 'button', 'data-tip': `Remove ${sym}`, 'aria-label': `Remove ${what} ${i + 1} of f${sub(k)}`, html: ICONS.close,
      onclick: (e) => { e.stopPropagation(); zpRemove(k, kind, i); } });
    const lab = h('label', { class: 'pl zp-sym ' + kind, for: id, 'data-tip': `${kind === 'zeros' ? 'Zero' : 'Pole'} ${sym}: drag it in the input plane` }, sym);
    return h('div', { class: 'pf zp-item' }, lab, h('div', { class: 'pair' }, input, del));
  }
  // "Write by zeros and poles" (a polynomial, rational or rational custom step) and back ("Write by coefficients")
  function convertZp(k, to) {
    const st = S.steps[k - 1];
    if (!st) return null;
    let r;
    try { r = to ? Funcs.toZerosPoles(st) : Funcs.fromZerosPoles(st); } catch (e) { r = { error: e.message || String(e) }; }
    if (!r || r.error || !r.step) { toast(((r && r.error) || 'This step cannot be rewritten.').replace(/\.?$/, '.')); return null; }
    S.steps[k - 1] = { type: r.step.type, params: Object.assign(Funcs.defaults(r.step.type), r.step.params), on: st.on !== false };
    zpSel = null;
    chainChanged(true);
    setFocus(k);
    commit();
    undoToast(to ? `f${sub(k)} is now given by its zeros and poles (${r.note}): drag them in its input plane.` : `f${sub(k)} is now given by its coefficients.`);
    return cardButton(k);
  }
  function drawHandles(pane, list) {
    const s = (list || S.shapes).find((x) => x.id === selected);
    if (!s) return;
    const ctx = pane.octx;
    const k = shapeInk(s).edge;
    for (const [key, z] of Region.handlesOf(s)) {
      const [x, y] = pane.w2s(z);
      ctx.fillStyle = TH.surface; ctx.strokeStyle = k; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (key === 'c' || key === 'm') ctx.arc(x, y, 3.5, 0, TAU); else ctx.rect(x - 3.5, y - 3.5, 7, 7);
      ctx.fill(); ctx.stroke();
    }
  }
  function drawProbe(pane, z, color, casing) {
    if (!z || !CX.isFin(z)) return;
    const [x, y] = pane.w2s(z);
    if (x < -10 || y < -10 || x > pane.w + 10 || y > pane.h + 10) return;
    const ctx = pane.octx;
    const arms = () => { ctx.beginPath(); ctx.moveTo(x - 11, y); ctx.lineTo(x - 4, y); ctx.moveTo(x + 4, y); ctx.lineTo(x + 11, y); ctx.moveTo(x, y - 11); ctx.lineTo(x, y - 4); ctx.moveTo(x, y + 4); ctx.lineTo(x, y + 11); ctx.stroke(); };
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineWidth = 3; ctx.strokeStyle = casing || TH.halo; arms();
    ctx.lineWidth = 1.25; ctx.strokeStyle = color; arms();
    ctx.restore();
  }
  // derivative gauge: a small circle and tick around the probe, and their images under the map
  function drawGauge(paneDom, paneImg, z, F) {
    const rho = 10 / paneDom.view.s;
    const ctxD = paneDom.octx, ctxI = paneImg.octx;
    const [x, y] = paneDom.w2s(z);
    ctxD.save();
    ctxD.strokeStyle = TH.probe; ctxD.globalAlpha = 0.6; ctxD.lineWidth = 1;
    ctxD.beginPath(); ctxD.arc(x, y, 10, 0, TAU); ctxD.stroke();
    ctxD.globalAlpha = 1; ctxD.strokeStyle = TH.accent; ctxD.lineWidth = 1.5;
    ctxD.beginPath(); ctxD.moveTo(x + 10, y); ctxD.lineTo(x + 16, y); ctxD.stroke();
    ctxD.restore();
    const w0 = F(z);
    if (!CX.isFin(w0)) return null;
    const h = rho * 1e-3;
    const d = CX.scale(CX.sub(F(C(z.re + h, z.im)), F(C(z.re - h, z.im))), 1 / (2 * h));
    if (!CX.isFin(d)) return null;
    let r = rho, factor = 1;
    const rimg = CX.abs(d) * rho * paneImg.view.s;
    if (rimg > 120) { factor = 120 / rimg; } else if (rimg < 3 && rimg > 0) { factor = 3 / rimg; }
    r = rho * factor;
    ctxI.save();
    ctxI.strokeStyle = TH.probe; ctxI.globalAlpha = 0.6; ctxI.lineWidth = 1;
    ctxI.beginPath();
    let pen = false;
    for (let i = 0; i <= 48; i++) {
      const a = TAU * i / 48;
      const w = F(C(z.re + r * Math.cos(a), z.im + r * Math.sin(a)));
      if (!CX.isFin(w)) { pen = false; continue; }
      const [px, py] = paneImg.w2s(w);
      if (pen) ctxI.lineTo(px, py); else ctxI.moveTo(px, py);
      pen = true;
    }
    ctxI.stroke();
    ctxI.globalAlpha = 1; ctxI.strokeStyle = TH.accent; ctxI.lineWidth = 1.5;
    const t0 = F(C(z.re + r, z.im)), t1 = F(C(z.re + r * 1.6, z.im));
    if (CX.isFin(t0) && CX.isFin(t1)) { ctxI.beginPath(); ctxI.moveTo(...paneImg.w2s(t0)); ctxI.lineTo(...paneImg.w2s(t1)); ctxI.stroke(); }
    ctxI.restore();
    return { d, factor };
  }
  function drawDraft(pane) {
    if (!draft) return;
    const ctx = pane.octx;
    const color = draft.shape ? shapeInk(draft.shape).edge : TH.c[S.shapes.length % 8].edge;
    ctx.save();
    if (draft.kind === 'polygon' && draft.pts) {
      ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]);
      ctx.beginPath();
      draft.pts.forEach((p, i) => { const [x, y] = pane.w2sxy(p[0], p[1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
      if (draft.hover) ctx.lineTo(...pane.w2s(draft.hover));
      ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color;
      for (const p of draft.pts) { const [x, y] = pane.w2sxy(p[0], p[1]); ctx.fillRect(x - 3, y - 3, 6, 6); }
      ctx.restore();
      return;
    }
    const s = draft.shape;
    if (!s) { ctx.restore(); return; }
    let curves = [];
    try { curves = Region.curvesOf(s, pane.box()); } catch (e) { curves = []; }
    const area = kindType(s) === 'area';
    ctx.beginPath();
    for (const c of curves) {
      const n = Math.max(48, Math.min(400, c.n0 || 64));
      for (let i = 0; i <= n; i++) { const z = c.f(i / n); const [x, y] = pane.w2s(z); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
    }
    if (area && !s.complement && s.kind !== 'halfplane' && !(s.kind === 'sector' && !(s.r > 0))) {
      ctx.globalAlpha = 0.35; ctx.fillStyle = shapeInk(s).c0; ctx.fill('evenodd'); ctx.globalAlpha = 1;
    }
    ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.stroke(); ctx.setLineDash([]);
    // dimension chip
    if (draft.cursor) {
      let t = '';
      const P = (a) => C(a[0], a[1]);
      if (s.r != null && s.kind !== 'sector') t = `r = ${CX.fmtNum(s.r, 4)}`;
      if (s.kind === 'rect' || s.kind === 'cgrid') t = `${CX.fmtNum(Math.abs(s.b[0] - s.a[0]), 4)} × ${CX.fmtNum(Math.abs(s.b[1] - s.a[1]), 4)}`;
      if (['segment', 'line', 'ray', 'halfplane', 'arc'].includes(s.kind)) { const d = CX.sub(P(s.b), P(s.a)); t = `${CX.fmtNum(CX.abs(d), 4)} ∠ ${CX.fmtNum(Math.atan2(d.im, d.re) / DEG, 2)}°`; }
      if (s.kind === 'sector') t = `θ ${CX.fmtNum(s.t1, 1)}° → ${CX.fmtNum(s.t2, 1)}°`;
      if (s.kind === 'annulus') t = `r₁ ${CX.fmtNum(s.r1, 3)}  r₂ ${CX.fmtNum(s.r2, 3)}`;
      if (t) { const [x, y] = pane.w2s(draft.cursor); chip(ctx, x + 14, y + 14, t.replace(/-/g, '−')); }
    }
    ctx.restore();
  }
  // drawing crosshair while a drawing tool is active
  function drawCrosshair(pane, z) {
    if (!z) return;
    const ctx = pane.octx;
    const [x, y] = pane.w2s(z);
    ctx.save();
    ctx.strokeStyle = TH.accent; ctx.globalAlpha = TH.cursorA; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, pane.h); ctx.moveTo(0, Math.round(y) + 0.5); ctx.lineTo(pane.w, Math.round(y) + 0.5); ctx.stroke();
    ctx.restore();
  }

  // ---------------- view fitting ----------------
  function robustBox(xs, ys) {
    if (xs.length < 2) return null;
    const q = (arr, p) => arr[Math.min(arr.length - 1, Math.max(0, Math.floor(p * (arr.length - 1))))];
    const sx = Float64Array.from(xs).sort(), sy = Float64Array.from(ys).sort();
    const full = { x0: sx[0], x1: sx[sx.length - 1], y0: sy[0], y1: sy[sy.length - 1] };
    const rob = { x0: q(sx, 0.01), x1: q(sx, 0.99), y0: q(sy, 0.01), y1: q(sy, 0.99) };
    const pick = (a0, a1, b0, b1) => ((a1 - a0) <= 2.5 * Math.max(b1 - b0, 1e-12) ? [a0, a1] : [b0, b1]);
    const [x0, x1] = pick(full.x0, full.x1, rob.x0, rob.x1);
    const [y0, y1] = pick(full.y0, full.y1, rob.y0, rob.y1);
    let b = { x0, x1, y0, y1 };
    const w = b.x1 - b.x0, hh = b.y1 - b.y0, m = Math.max(w, hh, 1e-9);
    if (w < m * 0.05) { b.x0 -= m * 0.1; b.x1 += m * 0.1; }
    if (hh < m * 0.05) { b.y0 -= m * 0.1; b.y1 += m * 0.1; }
    if (m < 1e-9) b = { x0: b.x0 - 1, x1: b.x1 + 1, y0: b.y0 - 1, y1: b.y1 + 1 };
    return b;
  }
  // CPU samples of what a stage shows, restricted to the part that comes from the visible z-window
  function stageSamples(F, xs, ys) {
    const core = Region.expandBox(clipWin, 1.05);
    const inCore = (x, y) => x >= core.x0 && x <= core.x1 && y >= core.y0 && y <= core.y1;
    const push = (w) => { if (CX.isFin(w) && Math.abs(w.re) < 1e9 && Math.abs(w.im) < 1e9) { xs.push(w.re); ys.push(w.im); } };
    for (const s of S.shapes) {
      if (s.visible === false) continue;
      const t = kindType(s);
      if (t === 'point') { push(F(C(s.p[0], s.p[1]))); continue; }
      const r = shapeGPU(s);
      if (t === 'area' && r.mesh) {
        const src = r.mesh.src, nv = src.length / 2;
        const stride = Math.max(1, Math.floor(nv / 2500));
        for (let i = 0; i < nv; i += stride) {
          const x = src[2 * i], y = src[2 * i + 1];
          if (r.mesh.stretched && !inCore(x, y)) continue;
          push(F(C(x, y)));
        }
      }
      // (a traced curve formula, like a formula area, counts by its part in the meshing window: its tails run out to
      // the far box)
      let unbounded = s.kind === 'line' || s.kind === 'ray' || s.kind === 'fcurve';
      if (t === 'area') { try { unbounded = !Region.bboxOf(s); } catch (e) { unbounded = true; } }
      for (const p of r.polys || []) {
        const n = p.length / 2, stride = Math.max(1, Math.floor(n / 400));
        for (let i = 0; i < n; i += stride) { const x = p[2 * i], y = p[2 * i + 1]; if (!unbounded || inCore(x, y)) push(F(C(x, y))); }
      }
    }
  }
  function fitPane(pane, k, extraKs = [], F) {
    const xs = [], ys = [];
    stageSamples(F || stageF(k), xs, ys);
    for (const k2 of extraKs) stageSamples(stageF(k2), xs, ys);
    const b = robustBox(xs, ys);
    if (b) pane.fitBox(b, 0.07);
    else pane.fitBox({ x0: -2, x1: 2, y0: -2, y1: 2 });
  }

  // ---------------- panes ----------------
  let paneL, paneR;
  let cutHandlesL = [];
  let hoverCut = 0;
  // the zeros and poles of a 'zp' step in its input plane (drawZpHandles): screen positions, the hovered one and the
  // selected one (Delete removes it); {k, kind: 'zeros' | 'poles', i}
  let zpHandlesL = [], zpHover = null, zpSel = null;
  let gaugeInfo = null;
  function leftView() { return leftStage() === 0 ? S.srcView : V.left; }
  // a lost context (GPU reset) usually comes back: say so, and keep the unsupported message for a failed init
  function noGL(pane) {
    paneNote(pane, GLR.lost ? 'The graphics card was reset. Restoring the view…' : 'This view needs WebGL2, which this browser does not provide.');
  }
  // graph paper: the GL grid when available, otherwise 2D lines
  function paper(pane) {
    pane.begin(TH.plane);
    if (!GLR.drawGrid || !GLR.ok) Axes.draw(pane, TH, { unitCircle: S.unit, labels: false });
  }
  function renderLeft() {
    const pane = paneL;
    pane.setView(leftView());
    // X Plane + Phase: the phase portrait of the map in focus (U-b; earlier the right pane's Phase view)
    // (its shapes outlined, the target preimages, the points and the editable cuts drawn over it, as in X Plane)
    if (lColor()) { leftSphereInfo = null; cutHandlesL = renderColor(pane) || []; if (hasTargets()) { updateRoots(); drawRoots(pane); } return; }
    // X Landscape: the relief of the height over X
    if (lLand()) {
      cutHandlesL = []; leftSphereInfo = null; render3D(pane);
      // the relief has no place for the target preimages (they show in X Plane and Sphere): said, not dropped silently
      if (hasTargets() && GLR.ok) sphereCaption(pane, 'Target preimages show in X → Y and Phase (1, 2)');
      return;
    }
    // X Sphere: this plane on the Riemann sphere, with its shapes or (Phase) the phase portrait (orbit only; drawing on
    // the globes is P3b)
    if (lGlobe()) {
      cutHandlesL = [];
      let info = null;
      if (typeof renderSphereLeft === 'function') info = renderSphereLeft(pane);
      else { paper(pane); paneNote(pane, 'The sphere view of this plane is not available in this build.'); }
      leftSphereInfo = info;
      // the targets' roots (solved over the flat view's window) are lifted to the globe; renderSphereLeft paints
      // the pulled-back target regions on it
      if (hasTargets()) {
        updateRoots();
        if (info) drawRoots(pane, sphereProj(pane, info));
      }
      return;
    }
    leftSphereInfo = null;
    paper(pane);
    const k = leftStage();
    const F = stageF(k);
    if (GLR.ok) drawScene(pane, stageMap(k), 'L', { domain: k === 0 }); else noGL(pane);
    // the w-plane targets pulled back by the focused map, in every view
    if (hasTargets()) drawPullback(pane, endMap(), preimageTargets(false));
    drawChevrons(pane, F);
    cutHandlesL = drawCuts(pane, k, true, false);
    drawPoints(pane, F, { primes: k, domain: k === 0 });
    if (hasTargets()) { updateRoots(); drawRoots(pane); }
    drawRulers(paneL, 'L');
    // overlays are drawn once per frame, after both planes (frame)
  }
  // probes, handles, drafts, gauges: the only things redrawn on hover
  // the one gesture that needs a word while it is in progress: an open polygon draft names how to close it
  // (a level-2 chip at the top centre of the pane it is drawn in; it goes with the draft)
  // the left plane's 'No shapes yet.' note; it gives way to the draft chip (the right plane's does by CSS)
  function syncEmptyState() {
    const empty = $('emptyState'), cl = $('draftChipL');
    if (!empty) return;
    const show = !S.shapes.length && leftStage() === 0 && lFlat() && !hasTargets() && !(cl && !cl.hidden);
    if (empty.hidden === show) empty.hidden = !show;
    // an empty plane only suggests drawing (examples are in the header)
    if (show && !empty.firstChild) empty.append(h('div', null, h('div', { class: 'lbl' }, 'No shapes yet.')));
  }
  function updateDraftChips() {
    const poly = !!(draft && draft.kind === 'polygon' && draft.pts && draft.pts.length);
    const cl = $('draftChipL'), cr = $('draftChipR');
    if (cl) { const on = poly && !draft.target; if (cl.hidden === on) cl.hidden = !on; }
    if (cr) { const on = poly && !!draft.target; if (cr.hidden === on) cr.hidden = !on; }
    syncEmptyState();
    // P3b: the globes take drawing (panels.md 9). What still draws nothing says so: the landscape, a planar-centred
    // tool on a globe (Annulus, Sector, Polar grid: 'Draw in Plane'), the z-globe at a focused stage (P4)
    const sc = $('sphereChipL');
    if (sc) {
      const drawing = tool !== 'select' && solo() !== 'R';
      const where = lLand() ? 'the landscape' : 'the Riemann sphere';
      const toolName = (TOOLS.find((t) => t[0] === tool) || [])[1] || '';
      let msg = '';
      if (drawing && lLand()) msg = `Drawing is off on ${where}; choose X → Y (1) to draw.`;
      else if (drawing && lGlobe() && GLOBE_OFF.has(tool)) msg = `${toolName} draws in Plane, not on the sphere.`;
      else if (drawing && lGlobe() && leftStage() > 0) msg = 'Shapes are drawn in the z-plane; choose Whole chain to draw.';
      const on = !!msg;
      if (sc.firstChild.textContent !== msg) sc.firstChild.textContent = msg;
      if (sc.hidden === on) sc.hidden = !on;
    }
    const sr = $('sphereChipR');
    if (sr) {
      const toolName = (TOOLS.find((t) => t[0] === tool) || [])[1] || '';
      // (the merged deformation plane or globe draws nothing: said, merged-views review)
      const on = tool !== 'select' && solo() !== 'L' && (morphOn() || (rGlobe() && GLOBE_OFF.has(tool)));
      const msg = !on ? '' : morphOn() ? 'Drawing is off in the deformation: press M to turn it off.' : `${toolName} draws in Plane (⇧3), not on the sphere.`;
      if (sr.firstChild.textContent !== msg) sr.firstChild.textContent = msg;
      if (sr.hidden === on) sr.hidden = !on;
    }
    syncGlobeTools();
  }
  // Annulus, Sector and Polar grid are dimmed while X shows its globe (panels.md 9.2: tooltip 'Draw in Plane')
  // and every draw tool while X → Y shows the merged deformation, where X's pane is hidden (merged-views review)
  let globeToolsOff = null;
  function syncGlobeTools() {
    const merged = S.view.main === 'xy' && morphOn(), off = lGlobe();
    const k = `${merged}|${off}`;
    if (k === globeToolsOff) return;
    globeToolsOff = k;
    for (const b of document.querySelectorAll('.tool[data-tool]')) {
      if (b.dataset.tool === 'select') continue;
      const g = merged || (off && GLOBE_OFF.has(b.dataset.tool));
      b.classList.toggle('globe-off', g);
      const base = b.dataset.tipBase || (b.dataset.tipBase = b.dataset.tip || '');
      b.dataset.tip = merged ? `${base} · Turn off Deformation (M) to draw` : g ? `${base} · Draw in Plane` : base;
    }
  }
  function renderOverlays() {
    const showL = solo() !== 'R', showR = solo() !== 'L';
    updateDraftChips();
    if (showL) { paneL.setView(leftView()); paneL.beginOverlay(); }
    if (showR) {
      paneR.setView(V.right);
      paneR.beginOverlay();
    }
    gaugeInfo = null;
    const sphL = !lFlat(); // the sphere and landscape views of X have no flat overlays
    const projL = lGlobe() && leftSphereInfo ? sphereProj(paneL, leftSphereInfo) : null;
    zpHandlesL = [];
    if (showL && !sphL) {
      drawCutHandles(paneL, cutHandlesL);
      drawZpHandles(paneL);
      if (leftStage() === 0) { drawHandles(paneL); if (!draft || !draft.target) drawDraft(paneL); if (tool !== 'select' && probe) drawCrosshair(paneL, draft && !draft.target && draft.cursor || probe); }
      // (over the phase portrait the probe is white on a dark casing, as the portrait's own lines)
      // (not over a zero or pole under the pointer, or one being dragged: the handle is what the pointer holds)
      if (probe && !zpHover && !(drag && drag.mode === 'zp')) { if (lColor()) drawProbe(paneL, probe, '#FFFFFF', TH.dcCasing); else drawProbe(paneL, probe, TH.probe); }
    }
    // the curve of an open integral popover, with its direction (X: its plane or its globe)
    if (intPop && showL && !lLand()) drawIntHighlight(paneL, projL);
    if (intPop && showR && rImage() && !morphOn() && !trans.k) { paneR.setView(V.right); drawIntHighlight(paneR, null, rangeF(leftStage(), rightStage())); }
    // the preimages of the hovered point of the right plane
    if (showL && hov.w && hov.list && !lLand()) drawHoverPreimages(paneL, projL);
    // Image: the w-plane targets are drawn and edited in the right plane like shapes in the domain
    // the globes' handles, polygon vertices and snap ring (P3b)
    if (showL && lGlobe() && globeEdit('L')) drawGlobeEdit('L');
    if (showR && rGlobe() && globeEdit('R')) drawGlobeEdit('R');
    if (showR && rImage() && targetsEditable()) {
      paneR.setView(V.right);
      drawHandles(paneR, S.targets);
      if (draft && draft.target) drawDraft(paneR);
      if (tool !== 'select' && rHover) drawCrosshair(paneR, rHover);
    }
    if (showR && rHover && !drag && rImage()) { paneR.setView(V.right); drawProbe(paneR, rHover, TH.probe); }
    if (showR && rHover && !drag && rGlobe()) drawSphereMark(paneR, rHover);
    if (probe && showR) {
      if (rImage() && !trans.k && !morphOn()) {
        paneR.setView(V.right);
        const F = focusF();
        if (showL && !sphL && tool === 'select') gaugeInfo = drawGauge(paneL, paneR, probe, F);
        drawProbe(paneR, F(probe), TH.probe);
      }
    }
    if (showL && !sphL) drawRulers(paneL, 'L', true);
    if (showR && rImage()) drawRulers(paneR, 'R', true);
  }
  // ---- rulers: ticks and labels along the bottom and left edges, plus cursor markers ----
  // Ruler sizes come from a ResizeObserver, never from a layout read per frame, and the static layer (ticks and
  // labels) lives in an offscreen canvas, so a probe move costs one blit plus the two markers.
  const rulerCache = { L: null, R: null };
  const rulerOff = { L: null, R: null };
  const rulerSize = new Map(); // ruler canvas -> [w, h] of its content box in CSS px (the CSS border is the edge line)
  const rulerSeen = { L: { vis: null, corner: null }, R: { vis: null, corner: null } };
  let rulerRO = null;
  function rulerDims(cv) {
    let s = rulerSize.get(cv);
    if (!s) {
      if (!rulerRO && window.ResizeObserver) {
        rulerRO = new ResizeObserver((es) => {
          let changed = false;
          for (const e of es) {
            const o = rulerSize.get(e.target), w = e.contentRect.width, hh = e.contentRect.height;
            if (!o || o[0] !== w || o[1] !== hh) { rulerSize.set(e.target, [w, hh]); changed = true; }
          }
          if (changed) requestRender('L', 'R');
        });
      }
      s = [cv.clientWidth, cv.clientHeight]; // first sight only
      rulerSize.set(cv, s);
      if (rulerRO) rulerRO.observe(cv);
    }
    return s;
  }
  // the 1-2-5 step at or above raw (labels never closer than asked for)
  function ceilStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m <= 1 + 1e-9 ? 1 : m <= 2 + 1e-9 ? 2 : m <= 5 + 1e-9 ? 5 : 10) * p;
  }
  function drawRulers(pane, side, markersOnly) {
    const rx = $(side === 'L' ? 'rulerLX' : 'rulerRX'), ry = $(side === 'L' ? 'rulerLY' : 'rulerRY');
    if (!rx || !ry) return;
    const seen = rulerSeen[side];
    const show = side === 'R' ? rImage() : lFlat();
    if (seen.vis !== show) { rx.style.visibility = ry.style.visibility = show ? '' : 'hidden'; seen.vis = show; }
    const corner = $(side === 'L' ? 'cornerL' : 'cornerR');
    // write the corner only when it changes: a write followed by a layout read forced a layout every frame
    const cornerHtml = !show ? '' : side === 'L' ? wHtml(leftStage()) : (S.focus === 0 ? '<i>w</i>' : wHtml(rightStage()));
    if (corner && seen.corner !== cornerHtml) { corner.innerHTML = cornerHtml; seen.corner = cornerHtml; }
    if (!show) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const [xw, xh] = rulerDims(rx), [yw, yh] = rulerDims(ry);
    if (!(xw >= 1 && xh >= 1 && yw >= 1 && yh >= 1)) return;
    const fit = (cv, w, hh) => { const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(hh * dpr)); if (cv.width !== pw || cv.height !== ph) { cv.width = pw; cv.height = ph; } };
    const v = pane.view;
    const draw = (cv, W, Hh, horiz) => {
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = TH.panel; ctx.fillRect(0, 0, W, Hh);
      // tick and label sizes follow the ruler thickness: 18px rulers (17 inside the edge) or 14px on phones
      const th = horiz ? Hh : W, small = th < 16;
      const tiers = small ? [2, 3, 4] : [3, 5, 7], tmax = tiers[2];
      const len = horiz ? W : Hh;
      const toPx = (val) => (horiz ? pane.w / 2 + (val - v.cx) * v.s : pane.h / 2 - (val - v.cy) * v.s);
      const lo = horiz ? v.cx - pane.w / 2 / v.s : v.cy - pane.h / 2 / v.s, hi = horiz ? v.cx + pane.w / 2 / v.s : v.cy + pane.h / 2 / v.s;
      ctx.font = `${small ? 9 : 10}px ${TH.mono}`;
      // labels at the 1-2-5 step that keeps them >= 72px (bottom) or 48px (left) apart, rounded up, and further up
      // when the widest label would not fit its slot
      let major = ceilStep((horiz ? 72 : 48) / v.s);
      // as many digits as the tick step needs to tell neighbouring labels apart (deep zoom away from 0 included)
      const fmt = (x) => {
        if (Math.abs(x) < major * 1e-6) return '0';
        const ax = Math.abs(x), em = Math.floor(Math.log10(major) + 1e-9);
        if (ax >= 1e5 || (ax < 1e-3 && major < 1e-4)) {
          const sig = Math.min(15, Math.max(1, Math.floor(Math.log10(ax)) - em + 1));
          let [m, e] = x.toExponential(sig - 1).split('e');
          if (m.includes('.')) m = m.replace(/\.?0+$/, '');
          return `${m}×10${String(+e).split('').map((d) => (d === '-' ? '⁻' : SUP[+d])).join('')}`.replace('-', '−');
        }
        let t = x.toFixed(Math.min(Math.max(0, -em), 14));
        if (t.includes('.')) t = t.replace(/\.?0+$/, ''); // minimum decimals: 2, 1.5, 0.25
        return t.replace('-', '−');
      };
      // imaginary labels read 2i, i, −i, −0.5i (decided from the value, not the formatted text)
      const label = (val) => {
        const t = fmt(val);
        if (horiz || t === '0') return t;
        if (Math.abs(val - 1) < major * 1e-6) return 'i';
        if (Math.abs(val + 1) < major * 1e-6) return '−i';
        return t + 'i';
      };
      for (let guard = 0; guard < 12; guard++) {
        const ends = [Math.ceil(lo / major) * major, Math.floor(hi / major) * major];
        const wmax = Math.max(...ends.map((x) => ctx.measureText(label(x)).width));
        if (major * v.s >= wmax + 12) break;
        major = ceilStep(major * 1.5);
      }
      const medium = major / 2, minor = major / 10;
      ctx.strokeStyle = TH.rulerTick; ctx.lineWidth = 1;
      ctx.beginPath();
      for (const [step, size] of [[minor, tiers[0]], [medium, tiers[1]], [major, tiers[2]]]) {
        if (step * v.s < 6) continue;
        const i0 = Math.ceil(lo / step), i1 = Math.floor(hi / step);
        if (i1 - i0 > 800) continue;
        for (let i = i0; i <= i1; i++) {
          const p = Math.round(toPx(i * step) * dpr) / dpr + 0.5 / dpr;
          if (horiz) { ctx.moveTo(p, 0); ctx.lineTo(p, size); } else { ctx.moveTo(W, p); ctx.lineTo(W - size, p); }
        }
      }
      ctx.lineWidth = 1 / dpr; // ticks are 1 device px
      ctx.stroke();
      ctx.fillStyle = TH.label;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      // bottom: baseline 1px above the outer edge; left (rotated −90°, glyph tops face outward): the baseline
      // sits just outside the longest tick, so the ink stays inside [0, W]
      const base = horiz ? Hh - 1 : W - tmax - 1.5;
      const i0 = Math.ceil(lo / major), i1 = Math.floor(hi / major);
      if (i1 - i0 < 200) for (let i = i0; i <= i1; i++) {
        const p = toPx(i * major);
        if (p < 12 || p > len - 12) continue;
        const t = label(i * major), hw = ctx.measureText(t).width / 2;
        if (p - hw < 1 || p + hw > len - 1) continue;
        if (horiz) ctx.fillText(t, p, base);
        else { ctx.save(); ctx.translate(base, p); ctx.rotate(-Math.PI / 2); ctx.fillText(t, 0, 0); ctx.restore(); }
      }
    };
    // the static part is drawn once per view into offscreen canvases; every call then blits it
    const fontsOk = document.fonts ? document.fonts.status : '';
    const key = `${v.cx},${v.cy},${v.s},${pane.w},${pane.h},${xw},${yw},${xh},${yh},${dpr},${TH.panel},${TH.label},${fontsOk}`;
    let off = rulerOff[side];
    if (!off) off = rulerOff[side] = { x: document.createElement('canvas'), y: document.createElement('canvas') };
    if (!rulerCache[side] || rulerCache[side].key !== key) {
      fit(off.x, xw, xh); fit(off.y, yw, yh);
      draw(off.x, xw, xh, true); draw(off.y, yw, yh, false);
      rulerCache[side] = { key };
    }
    fit(rx, xw, xh); fit(ry, yw, yh);
    const cx = rx.getContext('2d'), cy = ry.getContext('2d');
    cx.setTransform(1, 0, 0, 1, 0, 0); cy.setTransform(1, 0, 0, 1, 0, 0);
    cx.drawImage(off.x, 0, 0); cy.drawImage(off.y, 0, 0);
    // cursor markers: the probe in the left plane, its image in the right
    let mk = null;
    if (probe) {
      if (side === 'L') mk = probe;
      else if (rImage()) { const w = focusF()(probe); if (CX.isFin(w)) mk = w; }
    }
    if (mk) {
      const px = pane.w / 2 + (mk.re - v.cx) * v.s, py = pane.h / 2 - (mk.im - v.cy) * v.s;
      cx.setTransform(dpr, 0, 0, dpr, 0, 0); cy.setTransform(dpr, 0, 0, dpr, 0, 0);
      cx.fillStyle = TH.accent; cy.fillStyle = TH.accent;
      // a 5×4 triangle pointing into the plot
      if (px >= 0 && px <= xw) { cx.beginPath(); cx.moveTo(px - 2.5, 4); cx.lineTo(px + 2.5, 4); cx.lineTo(px, 0); cx.fill(); }
      if (py >= 0 && py <= yh) { cy.beginPath(); cy.moveTo(yw - 4, py - 2.5); cy.lineTo(yw - 4, py + 2.5); cy.lineTo(yw, py); cy.fill(); }
    }
  }
  function setLed(side, state, tip) {
    const el = $(side === 'L' ? 'leftLed' : 'rightLed');
    if (!el) return;
    el.className = 'led ' + state;
    el.setAttribute('data-tip', tip || { ok: 'Up to date', busy: 'Refining near cuts and poles', err: 'Evaluation failed' }[state]);
    el.setAttribute('aria-label', el.getAttribute('data-tip'));
    el.removeAttribute('title');
  }
  // a hairline runs along the top of the plots when work takes longer than 300 ms
  let hairTimer = 0;
  function setHairline(on) {
    if (on) {
      if (!hairTimer) hairTimer = setTimeout(() => { $('hairL').hidden = false; $('hairR').hidden = false; }, 300);
    } else {
      clearTimeout(hairTimer); hairTimer = 0;
      $('hairL').hidden = true; $('hairR').hidden = true;
    }
  }
  function updateLeds() {
    const errStep = S.steps.findIndex((st, i) => st.on !== false && built[i] && built[i].error);
    const busy = fixJob.running || !!lineJob.running || sm.running;
    setHairline(!!busy);
    const errTip = errStep >= 0 ? `f${sub(errStep + 1)}: ${built[errStep].error}` : '';
    // without WebGL2 neither plane can show its regions: both LEDs report the failure (spec 5.14)
    if (!GLR.ok) { setLed('L', 'err', 'WebGL2 is unavailable, so regions cannot be drawn'); setLed('R', 'err', 'WebGL2 is unavailable, so regions cannot be drawn'); return; }
    setLed('L', busy ? 'busy' : 'ok');
    setLed('R', errStep >= 0 ? 'err' : busy ? 'busy' : 'ok', errTip || undefined);
  }
  function renderColor(pane) {
    pane.setView(leftView());
    if (!GLR.ok) { pane.begin(TH.plane); noGL(pane); return; }
    pane.begin(TH.plane);
    GLR.begin(pane.pw, pane.ph);
    // the Cauchy style (st.cauchy: the nodes of the selected closed curve, F inside, 0 outside); with the Morph
    // transport open (homView: the homotopy at its time t), the phase portrait of H_t (the Cauchy style then shows H_t)
    const hv = typeof homView === 'function' ? homView() : null;
    const cz = !hv && S.dc === 'cauchy' && typeof cauchyPlot === 'function' ? cauchyPlot() : null;
    GLR.drawColorPlot({ map: hv ? hv.map : focusMap(), view: pane.view, dpr: pane.dpr, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(pane), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark, cauchy: cz });
    const cauchyIdle = S.dc === 'cauchy' && !cz && !hv;
    if (S.outline) {
      const map = stageMap(leftStage());
      for (const s of S.shapes) {
        if (s.visible === false || kindType(s) === 'point') continue;
        const r = shapeGPU(s);
        if (!r.lineRes) continue;
        // open sets dashed (spec 6.8)
        const dash = r.open ? { dash: [5, 3.5], arc: arcOf(r, stageF(leftStage()), mapKeyOf(map)) } : null;
        GLR.drawLines(r.lineRes, Object.assign({ map, view: pane.view, dpr: pane.dpr, M: 8, width: 1.3 * pane.dpr, color: GLR.hexRGB(TH.dcCasing), alpha: 0.9, casing: { color: [1, 1, 1], alpha: 0.95, width: 3 * pane.dpr }, cacheKey: `${r.lineKey}|${mapKeyOf(map)}` }, dash));
      }
    }
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    glStatusNote(pane);
    // major grid and axes in white over the colors
    const ctx = pane.ctx, b = pane.box(), st = Axes.niceStep(110 / pane.view.s);
    ctx.save();
    ctx.strokeStyle = TH.dcLine; ctx.globalAlpha = TH.dcLineA; ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = Math.ceil(b.x0 / st); i <= Math.floor(b.x1 / st) && i - Math.ceil(b.x0 / st) < 400; i++) { const x = Math.round(pane.w2sxy(i * st, 0)[0]) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, pane.h); }
    for (let j = Math.ceil(b.y0 / st); j <= Math.floor(b.y1 / st) && j - Math.ceil(b.y0 / st) < 400; j++) { const y = Math.round(pane.w2sxy(0, j * st)[1]) + 0.5; ctx.moveTo(0, y); ctx.lineTo(pane.w, y); }
    ctx.stroke();
    const [ox, oy] = pane.w2sxy(0, 0);
    const axes = () => { ctx.beginPath(); ctx.moveTo(0, Math.round(oy) + 0.5); ctx.lineTo(pane.w, Math.round(oy) + 0.5); ctx.moveTo(Math.round(ox) + 0.5, 0); ctx.lineTo(Math.round(ox) + 0.5, pane.h); ctx.stroke(); };
    ctx.globalAlpha = 0.4; ctx.strokeStyle = TH.dcCasing; ctx.lineWidth = 2.5; axes();
    ctx.globalAlpha = TH.dcAxisA; ctx.strokeStyle = TH.dcLine; ctx.lineWidth = 1.25; axes();
    ctx.restore();
    // as in X Plane (panels.md 1, target preimages in every X view): the w-plane targets pulled back by the focused
    // map (area fills at half strength, so the portrait reads through them; their edges as drawn), the points, and
    // the cuts with their handles
    const k = leftStage();
    if (hasTargets()) drawPullback(pane, endMap(), preimageTargets(false).map((t) => (t.alpha < 1 ? Object.assign(t, { alpha: t.alpha * 0.5 }) : t)));
    const handles = drawCuts(pane, k, true, false);
    drawPoints(pane, stageF(k), { primes: k, domain: k === 0 });
    if (cauchyIdle) paneNote(pane, 'Cauchy style: select a closed curve or a bounded region to see its Cauchy integral.');
    drawRulers(pane, pane === paneL ? 'L' : 'R');
    return handles;
  }
  function dcGridStep() { return S.dcGrid || 0.5; }
  // backdrop for 3D views (spec 6.9): vertical gradient --land-top -> --land-bottom, times a vignette 1 - 0.06 r^2
  // (r = 1 at the corners)
  function backdrop(pane) {
    const ctx = pane.ctx;
    if (figMode) { ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, pane.w, pane.h); return; } // print: plain paper
    const g = ctx.createLinearGradient(0, 0, 0, pane.h);
    g.addColorStop(0, TH.landTop); g.addColorStop(1, TH.landBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, pane.w, pane.h);
    const r = Math.hypot(pane.w, pane.h) / 2;
    const vg = ctx.createRadialGradient(pane.w / 2, pane.h / 2, 0, pane.w / 2, pane.h / 2, r);
    for (let i = 0; i <= 8; i++) { const t = i / 8, v = Math.round(255 * (1 - 0.06 * t * t)); vg.addColorStop(t, `rgb(${v},${v},${v})`); }
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, pane.w, pane.h);
    ctx.restore();
  }
  // median |F| over the box (used to scale |F|, Re F and Im F heights)
  let muCache = { key: '', mu: 1 };
  function medianAbs(box) {
    const key = `${chainSig[nSteps()]}|${S.focus}|${box.x0},${box.x1},${box.y0},${box.y1}|${S.height}`;
    if (muCache.key === key) return muCache.mu;
    const F = typeof plotF === 'function' ? plotF() : focusF(), vals = [];   // the focused map at t = end (a steady scale while morphing)
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
      const w = F(C(box.x0 + (i + 0.5) / 32 * (box.x1 - box.x0), box.y0 + (j + 0.5) / 32 * (box.y1 - box.y0)));
      const v = S.height === 're' ? Math.abs(w.re) : S.height === 'im' ? Math.abs(w.im) : CX.abs(w);
      if (Number.isFinite(v)) vals.push(v);
    }
    vals.sort((a, b) => a - b);
    const mu = vals.length ? Math.max(1e-6, vals[Math.floor(vals.length / 2)]) : 1;
    muCache = { key, mu };
    return mu;
  }
  // the landscape's domain: the left view box, aspect preserved (spec 6.9), trimmed to at most 2:1 about its centre
  function landBox() {
    const vb = leftPaneBox();
    const mx = (vb.x0 + vb.x1) / 2, my = (vb.y0 + vb.y1) / 2;
    let w = vb.x1 - vb.x0, h = vb.y1 - vb.y0;
    if (w > 2 * h) w = 2 * h; else if (h > 2 * w) h = 2 * w;
    return { x0: mx - w / 2, x1: mx + w / 2, y0: my - h / 2, y1: my + h / 2 };
  }
  function render3D(pane) {
    pane.begin(TH.plane);
    if (!GLR.ok) { noGL(pane); return; }
    backdrop(pane);
    const box = landBox();
    // the Morph transport (homView): the surface of H_t; All sheets (S.sheets, window S.sheetW): the whole covering
    // surface of the focused map instead of its cut principal branch (not while morphing)
    const hv = typeof homView === 'function' ? homView() : null;
    const sheets = !hv && S.sheets ? { W: Math.max(1, Math.min(4, Math.round(S.sheetW) || 2)) } : null;
    let mu = S.height === 'log' ? 1 : medianAbs(box);
    // all sheets with height Re F / Im F: the scale from the 90th percentile of the values over every surface drawn
    // (the sheets of log stack 2 pi i apart: the principal branch's scale, or even the median, flattened the outer
    // ones into stacked plates), so the height is nearly linear in the value and every turn keeps its pitch; the
    // block is made taller by how far the surfaces stack (the spread of the values over all of them against the
    // principal one's, x 0.8, within 1..4.5), so a helicoid reads as one. Cached per chain, focus, box, height, window.
    let lscale = S.lscale || 1;
    render3D.linear = false;
    const fm = focusMap(), si = sheets && GLR.sheetInfo ? GLR.sheetInfo(fm, sheets.W) : null;
    if (si && S.height !== 'log' && typeof Funcs.sheetEval === 'function') {
      const lin = S.height === 're' || S.height === 'im';
      const key = `${chainSig[nSteps()]}|${S.focus}|${box.x0},${box.x1},${box.y0},${box.y1}|${S.height}|${sheets.W}|${si.K}`;
      const c = render3D.muS || (render3D.muS = { key: '', mu: 1 });
      if (c.key !== key) {
        const vals = [], sv = [], sv0 = [];
        for (let k = 0; k < si.K; k++) for (let j = 0; j < 12; j++) for (let i = 0; i < 12; i++) {
          const z = C(box.x0 + (i + 0.5) / 12 * (box.x1 - box.x0), box.y0 + (j + 0.5) / 12 * (box.y1 - box.y0));
          let w = null;
          try { w = Funcs.sheetEval(S.steps, built, fm.b, z, z, k, sheets.W, { a: fm.a || 0 }); } catch (e) { w = null; }
          const x = w ? (S.height === 're' ? w.re : S.height === 'im' ? w.im : CX.abs(w)) : NaN;
          if (!Number.isFinite(x)) continue;
          vals.push(Math.abs(x)); sv.push(x);
          if (k === 0) sv0.push(x);
        }
        const q = (a, f) => a[Math.min(a.length - 1, Math.max(0, Math.floor(f * a.length)))];
        for (const a of [vals, sv, sv0]) a.sort((x, y) => x - y);
        // linear heights over all sheets: the scale is (nearly) the largest value, so the surfaces fill the block
        c.key = key; c.mu = vals.length ? Math.max(1e-6, q(vals, lin ? 0.98 : 0.5)) : mu;
        const s0 = sv0.length ? q(sv0, 0.95) - q(sv0, 0.05) : 0, s1 = sv.length ? q(sv, 0.95) - q(sv, 0.05) : 0;
        c.boost = lin && s0 > 0 && s1 > 0 ? Math.max(1, Math.min(4.5, 0.8 * s1 / s0)) : 1;
      }
      mu = c.mu;
      lscale *= c.boost || 1;
      if (lin) render3D.linear = true;
    }
    // 28 degree camera fitted to the bounding sphere of the block and its plate at this pane's aspect
    const geo = GLR.landGeom(box, lscale);
    refitCam(cam, CAM3, GLR.fitDist(geo.radius, CAM3.fov, pane.w, pane.h, 1.05));
    const view = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist, tx: cam.tx, ty: cam.ty, tz: geo.center[2], fov: CAM3.fov };
    GLR.begin(pane.pw, pane.ph);
    const cells = S.meshN >= 1920 ? 512 : S.meshN >= 480 ? 384 : 256;   // spec 6.9: 256² vertices, 384² at Fine and above, 512² at Max
    // source outlines printed on the floor, in the plane the landscape is built on (stage focus - 1)
    const outlines = [];
    const omap = stageMap(leftStage()), omk = mapKeyOf(omap);
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point') continue;
      const r = shapeGPU(s);
      if (r.lineRes) outlines.push({ res: r.lineRes, color: GLR.hexRGB(shapeInk(s).edge), map: omap, cacheKey: `${r.lineKey}|${omk}` });
    }
    const info = GLR.drawLandscape({
      map: hv ? hv.map : focusMap(), box, cam: view, heightMode: render3D.linear ? `${S.height}Lin` : S.height, scale: lscale, mu, material: landMaterial(), unitLevel: !!S.unitLevel, sectors: S.sectors || 12,
      cells, sheets, outlines, probe: probe ? { x: probe.re, y: probe.im } : null, bg: GLR.hexRGB(TH.landBottom),
      colors: {
        floor: GLR.hexRGB(TH.landFloor), box: GLR.hexRGB(TH.landBox), modLine: GLR.hexRGB(TH.landMod), argLine: GLR.hexRGB(TH.landArg), plaster: GLR.hexRGB(TH.plaster),
        shadow: GLR.hexRGB(TH.landShadow), shadowA: TH.landShadowA, hemiSky: GLR.hexRGB(TH.hemiSky), hemiGround: GLR.hexRGB(TH.hemiGround), accent: GLR.hexRGB(TH.accent),
        minor: GLR.hexRGB(TH.gridMinor), medium: GLR.hexRGB(TH.gridMedium), major: GLR.hexRGB(TH.gridMajor), landBottom: GLR.hexRGB(TH.landBottom),
        cut: GLR.hexRGB(TH.cut), probe: GLR.hexRGB(TH.probe),
      },
    });
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    if (info) draw3DLabels(pane, info, box);
    // what pickLand needs to find the point of X under the pointer (the last frame's camera, block and heights)
    render3D.pick = info && !figMode ? { cam: view, box, info, w: pane.w, h: pane.h, F: hv ? hv.F : focusF() } : render3D.pick;
    glStatusNote(pane);
  }
  // the point of X under pane pixel (x, y) of the landscape (its probe: the needle from the floor to (z, h(z)) and the
  // readout): the first crossing of the pointer's ray with the relief (the principal branch, marched then bisected),
  // else the floor of the block; null off the block
  function pickLand(x, y) {
    const pk = render3D.pick;
    if (!pk || !(pk.w > 0 && pk.h > 0) || !pk.info || !pk.info.heightOf) return null;
    const c = pk.cam, info = pk.info, box = pk.box, [ax, ay] = info.aspect || [1, 1];
    const e = [c.tx + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw), c.ty + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), c.tz + c.dist * Math.sin(c.pitch)];
    const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((t) => t / l); };
    const f = nrm([c.tx - e[0], c.ty - e[1], c.tz - e[2]]);
    const r = nrm([f[1], -f[0], 0]);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const th = Math.tan((c.fov || 28 * DEG) / 2), nx = (2 * x / pk.w - 1) * th * pk.w / pk.h, ny = (1 - 2 * y / pk.h) * th;
    const d = nrm([0, 1, 2].map((k) => f[k] + nx * r[k] + ny * u[k]));
    const at = (t) => [e[0] + t * d[0], e[1] + t * d[1], e[2] + t * d[2]];
    const toZ = (p) => C(box.x0 + (p[0] / ax / 2 + 0.5) * (box.x1 - box.x0), box.y0 + (p[1] / ay / 2 + 0.5) * (box.y1 - box.y0));
    const top = Math.abs(info.top || 1) * 1.3, z0 = info.floorZ;
    const hAt = (p) => {
      const w = pk.F(toZ(p));
      if (!CX.isFin(w)) return top;
      const hh = info.heightOf(S.height === 're' ? w.re : S.height === 'im' ? w.im : CX.abs(w));
      return Number.isFinite(hh) ? hh : top;
    };
    // the ray's segment inside the block |x| <= ax, |y| <= ay, floor <= z <= top
    let t0 = 0, t1 = Infinity;
    for (const [k, lo, hi] of [[0, -ax, ax], [1, -ay, ay], [2, z0, top]]) {
      if (Math.abs(d[k]) < 1e-12) { if (e[k] < lo || e[k] > hi) return null; continue; }
      let a = (lo - e[k]) / d[k], b = (hi - e[k]) / d[k];
      if (a > b) [a, b] = [b, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    }
    if (!(t1 > t0)) return null;
    const N = 160;
    let tp = t0;
    for (let i = 0; i <= N; i++) {
      const t = t0 + (t1 - t0) * i / N, p = at(t);
      if (p[2] - hAt(p) > 0) { tp = t; continue; }
      if (i === 0) return toZ(p);
      let a = tp, b = t;
      for (let j = 0; j < 14; j++) { const m = (a + b) / 2, q = at(m); if (q[2] - hAt(q) > 0) a = m; else b = m; }
      return toZ(at(b));
    }
    const p = at(t1);
    return Math.abs(p[2] - z0) < 1e-6 * Math.max(1, Math.abs(z0)) + 1e-9 ? toZ(p) : null;
  }
  function project(pane, MVP, p) {
    const c = GLR.M4.apply(MVP, p);
    if (c[3] <= 1e-6) return null;
    return [(c[0] / c[3] * 0.5 + 0.5) * pane.w, (1 - (c[1] / c[3] * 0.5 + 0.5)) * pane.h];
  }
  // leaves the context's stroke state as it found it, so ticks drawn after a label keep --ruler-tick
  function haloText(ctx, t, x, y, halo) { ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = halo || TH.landTop; ctx.strokeText(t, x, y); ctx.restore(); ctx.fillText(t, x, y); }
  // Labels of the landscape (spec 6.9), projected each frame: ticks on the two floor edges facing the camera, the
  // axis names, and a height ruler (values of the plotted quantity through the height map) on the back corner
  // that sits on the block's silhouette, so its labels never cover the relief.
  function draw3DLabels(pane, info, box) {
    const ctx = pane.ctx;
    const [ax, ay] = info.aspect || [1, 1];
    const z0 = info.floorZ, eye = info.eye;
    const P = (p) => project(pane, info.MVP, p);
    const unit = (a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy); return l > 1e-6 ? [dx / l, dy / l] : [0, 1]; };
    const hexMix = (a, b, t) => { const A = GLR.hexRGB(a), B = GLR.hexRGB(b); return `rgb(${A.map((x, k) => Math.round(255 * (x + (B[k] - x) * t))).join(',')})`; };
    const bgAt = (y) => hexMix(TH.landTop, TH.landBottom, Math.min(1, Math.max(0, y / pane.h)));
    const taken = [];
    const free = (r) => r[0] > 1 && r[1] > 1 && r[0] + r[2] < pane.w - 1 && r[1] + r[3] < pane.h - 1 && !taken.some((q) => r[0] < q[0] + q[2] && q[0] < r[0] + r[2] && r[1] < q[1] + q[3] && q[1] < r[1] + r[3]);
    // seen from below the floor, the relief hangs over the floor's edges: a floor label inside the block's outline
    // on screen would print over the surface, so it is left out (floor: true)
    const below = eye[2] < z0;
    let hull = null;
    if (below) {
      const pts = [];
      for (const zz of [z0, info.top]) for (const [cx0, cy0] of [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]]) { const q = P([cx0, cy0, zz]); if (q) pts.push(q); }
      if (pts.length === 8) {
        // convex hull (monotone chain)
        pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
        const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
        const lo = [], up = [];
        for (const p of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
        for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
        hull = lo.slice(0, -1).concat(up.slice(0, -1));
      }
    }
    const inHull = (x, y) => { if (!hull) return false; for (let i = 0; i < hull.length; i++) { const a = hull[i], b = hull[(i + 1) % hull.length]; if ((b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]) < 0) return false; } return true; };
    const overRelief = (r) => below && (!hull || [[r[0], r[1]], [r[0] + r[2], r[1]], [r[0], r[1] + r[3]], [r[0] + r[2], r[1] + r[3]], [r[0] + r[2] / 2, r[1] + r[3] / 2]].some(([x, y]) => inHull(x, y)));
    // runs: [[text, italic], ...] set as one label, pushed from anchor a along the screen direction d by gap px
    const label = (runs, a, d, gap, font, halo, color, floor) => {
      const fontOf = (it) => (it ? `italic ${font}` : font);
      const ws = runs.map(([t, it]) => { ctx.font = fontOf(it); return ctx.measureText(t).width; });
      const w = ws.reduce((s, x) => s + x, 0), hh = 12;
      const ext = Math.abs(d[0]) * w / 2 + Math.abs(d[1]) * hh / 2;
      const cx = a[0] + d[0] * (gap + ext), cy = a[1] + d[1] * (gap + ext);
      // 3px clear of every other label (the ruler title never touches a tick label)
      const r = [cx - w / 2 - 3, cy - hh / 2 - 2, w + 6, hh + 4];
      if (!free(r) || (floor && overRelief(r))) return false;
      taken.push(r);
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = color;
      let x = cx - w / 2;
      runs.forEach(([t, it], i) => { ctx.font = fontOf(it); haloText(ctx, t, x, cy, halo || bgAt(cy)); x += ws[i]; });
      return true;
    };
    const micro = `400 10px ${TH.mono}`, math12 = `500 12px ${TH.math}`;
    const minus = (s) => s.replace(/-/g, '−');
    const ticks = (a0, a1) => { const st = Axes.niceStep((a1 - a0) / 4); const out = []; for (let k = Math.ceil(a0 / st - 1e-9); k * st <= a1 + 1e-9 * st; k++) out.push(+(k * st).toPrecision(10)); return out; };
    // the two floor edges facing the camera: y = sy·ay (carries Re z) and x = sx·ax (carries Im z)
    const sx = eye[0] < 0 ? -1 : 1, sy = eye[1] < 0 ? -1 : 1;
    ctx.save();
    ctx.lineWidth = 1; ctx.strokeStyle = TH.rulerTick; ctx.lineCap = 'butt';
    // an edge seen end-on (front or side views) carries no labels: they would only pile up
    const seen = (p0, p1) => { const a = P(p0), b = P(p1); return a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0; };
    const edge = (vals, at, out, text) => {
      for (const v of vals) {
        const p = at(v), a = P(p), b = P([p[0] + out[0] * 0.06, p[1] + out[1] * 0.06, z0]);
        if (!a || !b) continue;
        const d = unit(a, b);
        if (!label([[text(v), false]], a, d, 6, micro, TH.landFloor, TH.label, true)) continue;
        ctx.globalAlpha = 0.7;
        ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + d[0] * 4, a[1] + d[1] * 4); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    };
    const X = (x) => ((x - box.x0) / (box.x1 - box.x0) - 0.5) * 2 * ax, Y = (y) => ((y - box.y0) / (box.y1 - box.y0) - 0.5) * 2 * ay;
    const reVals = ticks(box.x0, box.x1), imVals = ticks(box.y0, box.y1);
    // a plate seen edge-on (the camera level with it, in side views of the open surface) carries none: its two
    // edges would stack their ticks on one line
    const q0 = P([-ax, -ay, z0]), q1 = P([ax, -ay, z0]), q2 = P([ax, ay, z0]), q3 = P([-ax, ay, z0]);
    const plateArea = q0 && q1 && q2 && q3 ? 0.5 * Math.abs((q2[0] - q0[0]) * (q3[1] - q1[1]) - (q2[1] - q0[1]) * (q3[0] - q1[0])) : 0;
    const plateExt = q0 && q1 && q2 && q3 ? Math.max(Math.hypot(q2[0] - q0[0], q2[1] - q0[1]), Math.hypot(q3[0] - q1[0], q3[1] - q1[1])) : 0;
    const flatOn = plateArea > 0.05 * plateExt * plateExt;
    const reOn = flatOn && seen([-ax, sy * ay, z0], [ax, sy * ay, z0]) > 70, imOn = flatOn && seen([sx * ax, -ay, z0], [sx * ax, ay, z0]) > 70;
    if (reOn) edge(reVals, (x) => [X(x), sy * ay, z0], [0, sy], (x) => minus(CX.fmtNum(x, 3)));
    if (imOn) edge(imVals, (y) => [sx * ax, Y(y), z0], [sx, 0], (y) => minus(CX.fmtNum(y, 3) + 'i').replace(/^1i$/, 'i').replace(/^−1i$/, '−i').replace(/^0i$/, '0'));
    // axis names beyond the tick labels, at the middle of each edge
    const title = (p, out, runs) => {
      const a = P(p), b = P([p[0] + out[0] * 0.06, p[1] + out[1] * 0.06, z0]);
      if (a && b) for (const gap of [24, 34, 46]) if (label(runs, a, unit(a, b), gap, math12, TH.landFloor, TH.ink2, true)) break;
    };
    const vz = leftStage() === 0 ? 'z' : `w${sub(leftStage())}`;
    if (reOn) title([0, sy * ay, z0], [0, sy], [['Re ', false], [vz, true]]);
    if (imOn) title([sx * ax, 0, z0], [sx, 0], [['Im ', false], [vz, true]]);
    // height ruler: of the two corners on the block's silhouette, the one farther from the camera
    const corners = [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]];
    const far = corners.reduce((m, c, i) => (Math.hypot(c[0] - eye[0], c[1] - eye[1]) > Math.hypot(corners[m][0] - eye[0], corners[m][1] - eye[1]) ? i : m), 0);
    const side = [corners[(far + 1) % 4], corners[(far + 3) % 4]];
    const rc = Math.hypot(side[0][0] - eye[0], side[0][1] - eye[1]) >= Math.hypot(side[1][0] - eye[0], side[1][1] - eye[1]) ? side[0] : side[1];
    const top = info.top;
    const r0 = P([rc[0], rc[1], z0]), r1 = P([rc[0], rc[1], top]), cc = P([0, 0, z0]);
    if (!r0 || !r1 || !cc) { ctx.restore(); return; }
    const dir = r0[0] < cc[0] ? -1 : 1;           // labels go outward, away from the block
    ctx.globalAlpha = 0.85; ctx.strokeStyle = TH.landBox; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(r0[0], r0[1]); ctx.lineTo(r1[0], r1[1]); ctx.stroke();
    ctx.globalAlpha = 1;
    const hOf = info.heightOf || ((v) => v);
    const fmt = (v) => minus(CX.fmtNum(v, 3));
    let vals;                                     // [value, label], in order of priority
    if (S.height === 'log' || !S.height) vals = [1, 10, 0.1, 100, 0.01].map((m) => [m, fmt(m)]);
    else {
      const b = Axes.niceStep(medianAbs(box));
      vals = (S.height === 'abs' ? [1, 0, 4, 2, 10, 0.5] : [0, 1, -1, 4, -4, 2, -2]).map((m) => [m * b, fmt(m * b)]);
    }
    ctx.strokeStyle = TH.rulerTick;
    for (const [v, lab] of vals) {
      const hz = hOf(v);
      if (!Number.isFinite(hz) || hz > top - 0.01 || hz < z0 + 0.01) continue;
      const a = P([rc[0], rc[1], hz]);
      if (!a) continue;
      if (!label([[lab, false]], a, [dir, 0], 8, micro, null, TH.label)) continue;
      ctx.globalAlpha = 0.7;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(a[0] + dir * 5, a[1]); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // a focused d/dz step plots its stage w_k (a function of z), any other step its own map f_k
    const Fn = S.focus === 0 ? 'F' : (typeof isDeriv === 'function' && isDeriv(S.focus) ? `w${sub(S.focus)}` : `f${sub(S.focus)}`);
    const tl = { log: [['|', false], [Fn, true], ['|', false]], abs: [['|', false], [Fn, true], ['|', false]], re: [['Re ', false], [Fn, true]], im: [['Im ', false], [Fn, true]] }[S.height || 'log'];
    // above the ruler; if a tick label is there, further up, then beside the top of the ruler
    // (from below the floor the relief hangs over the top of the ruler: beside it first, never over the surface)
    const up = (k) => [r1[0], r1[1] - k];
    // the block's outline on screen at the height of y, on the ruler's side (where a label clears the relief)
    const rim = (y) => {
      let x = r1[0];
      if (hull) for (let i = 0; i < hull.length; i++) {
        const a = hull[i], b = hull[(i + 1) % hull.length];
        if ((a[1] - y) * (b[1] - y) > 0 || a[1] === b[1]) continue;
        const xi = a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]);
        if (dir < 0 ? xi < x : xi > x) x = xi;
      }
      return [x, y];
    };
    const tries = below ? [[r1, [dir, 0], 10], [rim(r1[1]), [dir, 0], 6], [rim(r1[1] - 16), [dir, 0], 6], [up(16), [dir, 0], 10], [r1, [0, -1], 6], [r1, [0, -1], 16]]
      : [[r1, [0, -1], 6], [r1, [0, -1], 16], [r1, [dir, 0], 10], [up(16), [dir, 0], 10]];
    for (const [a, d, gap] of tries) if (label(tl, a, d, gap, math12, null, TH.ink2, below)) break;
    ctx.restore();
  }
  // Y Sphere: the images on the w-globe (U-b; the phase globe is X Sphere + Phase, renderSphereLeft)
  function renderSphere(pane) {
    // the Morph transport (homView): the regions under H_t
    const hv = typeof homView === 'function' ? homView() : null;
    // the w-plane targets on the globe (P3b): fills and outlines exactly per pixel (the preimage pass through the identity
    // map, as in Y Plane), points as marks; a target draft over them
    const edit = !hv && globeEdit('R');
    const post = [];
    if (edit && hasTargets()) post.push({ map: IDENT, targets: preimageTargets(false), halo: GLR.hexRGB(TH.halo) });
    const dp = edit ? globeDraftPass('R') : null;
    if (dp) post.push(dp);
    sphereView(pane, camS, CAMS, {
      imageMode: true, stage: rightStage(), plane: !!S.view.R.eq, role: 'R',
      probeW: probe ? (hv ? hv.F : focusF())(probe) : null, hom: hv,
      post, net: edit ? globeNet() : 'plain', targetPts: edit,
    });
  }
  // the conjugate lift of z = x + iy onto the Riemann sphere (panels.md 9.0; the GLSL lift in gl.js): 0 at the south
  // pole, infinity at the north pole, and seen from outside the globe keeps the plane's orientation
  function liftC(x, y) {
    const q2 = x * x + y * y;
    if (q2 > 1) { const iq = 1 / q2; return [2 * x * iq / (1 + iq), -2 * y * iq / (1 + iq), (1 - iq) / (1 + iq)]; }
    return [2 * x / (q2 + 1), -2 * y / (q2 + 1), (q2 - 1) / (q2 + 1)];
  }
  // the number of longitude sectors of the spherical checker (SPEC 6.3): 16 at pattern scale 1, even, 4 to 64
  const sphN = () => Math.max(4, Math.min(64, 2 * Math.round(8 / (S.patternScale || 1))));
  // the outcome of a globe's inverse pass (GLR.drawSphere onResult), as drawScene records a flat one
  function globeResult(role, s, res, live) {
    if (live) notePath(role, s.id, res === 'drawn' ? 'inverse' : res === 'pending' ? 'pending' : 'forward');
    if (res === 'pending') { if (live) invWaiting.add(role); else thumbNotFinal = true; }
    else if (res === 'drawn' && invWaiting.size) { const w = [...invWaiting].filter((x) => x !== role || !live); invWaiting.clear(); requestRender(...w, 'T'); }
    if (res === 'error' && GLR.inverseStatus(S.alpha, 'globe') === 'error') {
      const k = (GLR.inverseInfo || {}).key || '';
      if (k !== invFailKey) { invFailKey = k; scheduleFix(); }
    }
  }
  // A plane on the Riemann sphere, orbited by camera c (base: its fitted defaults). o.imageMode: the shapes of stage
  // o.stage lifted onto a plain globe with its graticule; otherwise the globe carries the phase portrait of the
  // focused map (or H_t with the Morph transport, o.hom) and the shapes are outlined. o.plane: the equatorial plane with the projection ray
  // of o.probeW; without it the probe is a dot on the globe. Returns the frame's {MVP, eye} or null.
  function sphereView(pane, c, base, o) {
    pane.begin(TH.plane);
    if (!GLR.ok) { noGL(pane); return null; }
    backdrop(pane);
    // 28 degree camera fitted to the globe and its labels at this pane's aspect (spec 6.10)
    // (with the equatorial plane on, frame more of the disc; its rim fades out, so the pane never cuts it hard)
    refitCam(c, base, GLR.fitDist(o.plane ? 1.75 : 1.16, base.fov, pane.w, pane.h, 1.05));
    // contact shadow (spec 6.10): an elliptical radial gradient, aspect 1.6 : 0.35, on the ground under the globe,
    // placed and sized from the globe's projection; it fades out as the camera drops below the ground
    const ctx = pane.ctx;
    {
      const pc = GLR.camera(c, pane.w, pane.h);
      const D = Math.hypot(...pc.eye);
      const c0 = project(pane, pc.MVP, [0, 0, 0]), cb = project(pane, pc.MVP, [0, 0, -1.03]);
      const k = Math.max(0, Math.min(1, (Math.sin(c.pitch) - 0.02) / 0.2));
      if (c0 && cb && D > 1 && k > 0) {
        const R = Math.tan(Math.asin(1 / D)) / Math.tan(base.fov / 2) * pane.h / 2;   // silhouette radius, px
        const flat = Math.max(0.6, Math.min(2.2, Math.sin(c.pitch) / Math.sin(18 * DEG)));
        const rr = 0.62 * R;
        ctx.save(); ctx.translate(cb[0], cb[1] + 0.04 * R); ctx.scale(1.6, 0.35 * flat);
        const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, rr);
        const a = (TH.dark ? 0.28 : 0.18) * k;
        sg.addColorStop(0, withAlpha(TH.landShadow, a)); sg.addColorStop(0.45, withAlpha(TH.landShadow, a * 0.55)); sg.addColorStop(1, withAlpha(TH.landShadow, 0));
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, rr, 0, TAU); ctx.fill(); ctx.restore();
      }
    }
    GLR.begin(pane.pw, pane.ph);
    const imageMode = o.imageMode;
    const regions = [], lines = [];
    // o.hom: the homotopy at time t (Morph transport): image mode lifts the shapes under H_t, phase mode paints H_t
    const hom = o.hom || null;
    const map = hom && imageMode ? (hom.imageMap || hom.map) : stageMap(o.stage);   // shapes live in the z-plane
    const cell = patternCell();
    const halo = GLR.hexRGB(TH.halo);
    // the same map cache keys as drawScene: orbiting the globe re-evaluates nothing (spec 8.1); homotopy frames go
    // to GLR's per-resource scratch evaluation instead (no cache entry per t)
    const cache = map.mode === 0, mk = mapKeyOf(map);
    // exact images on the globe (SPEC 4.6, 10.3): each area shape takes its path in list order, the inverse pass over
    // the globe's own triangles (every fragment exact, the poles ordinary pixels) or the lifted mesh; the frame's shape
    // records are packed once. o.role: 'R' the w-globe (Y Sphere), 'L' the z-globe (X Sphere, at stage 0 too)
    const role = o.role === 'L' ? 'L' : 'R', live = !offRender;
    const stretch = { shrink: GLR.hexRGB(TH.stretchShrink), grow: GLR.hexRGB(TH.stretchGrow), mid: GLR.hexRGB(TH.stretchMid) };
    const smR = imageMode ? globeRpx(pane, c, base) : 0;   // the globe's radius, device px (SphereMesh's view)
    let recs = null;
    if (imageMode && GLR.packShapes && GLR.drawInverse && typeof Inverse !== 'undefined' && S.exactImages !== false && PHASE[role].globe
      && S.shapes.some((s) => s.visible !== false && kindType(s) === 'area')) {
      const m0 = normalizeMap(map);
      if ((m0.mode || 0) === 0 && invPlan(m0.a || 0, m0.b || 0).ok) {
        recs = GLR.packShapes(S.shapes.filter((s) => s.visible !== false)).recs;
        if (!sideDraw) lastRecs = recs;
        if (live) prepDeferred = false;
      }
    }
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point') continue;
      const r = shapeGPU(s);
      const ink = shapeInk(s);
      const pf = imageMode && kindType(s) === 'area' && !hom ? pairFor(s, r, role) : { p: r, fx: null };   // fix-ups refine the static map
      if (imageMode && kindType(s) === 'area') {
        const fwd = [];
        // SPEC 8: a published SphereMesh of the globe (valid while the globe's radius is within 2x) replaces the lifted
        // mesh and its fix-ups; during a rebuild the old one is drawn (it covers the whole sphere)
        const pth = recs ? pathOf(s, map, role, 'globe', { recs, budget: live, status: true }).path : 'forward';
        const smd = !hom && (live || offRender) ? smFor(s, r, role, 'globe', map, pane, smR, live && pth === 'forward') : null;
        const sme = smd && (smd.e || smd.old);
        if (sme && !sme.data.n) { /* nothing of it shows on the globe */ } else if (sme && smRes(sme)) fwd.push({ pre: sme.res, st: Object.assign(smLook(s, pane, S.alpha), { view: null }) });
        else if (pf.p.meshRes) {
          const fx = pf.fx, pm = pf.p;
          const st = { map, dpr: pane.dpr, L: MESH_L, color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), skip: fx ? fx.skip : null, stretch,
            cacheKey: cache ? `${pm.meshKey}|${mk}` : null };
          fwd.push({ res: pm.meshRes, st });
          if (fx && fx.extraRes) fwd.push({ res: fx.extraRes, st: Object.assign({}, st, { skip: null, L: 1, cacheKey: cache ? `x|${fx.mapKey}|${mk}` : null }) });
        }
        const p = recs ? pathOf(s, map, role, 'globe', { recs, budget: live }) : null;
        if (p && p.path === 'inverse') {
          // a bounded shape's image box (in w; the shape's own box at stage 0) scissors its pass (gl.js globeScissorOf)
          let gbox = null;
          if (shapeBounded(s)) {
            if (p.plan.ops.length) gbox = invBox(p.e, p.plan, s, live);
            else { try { gbox = Region.bboxOf(s); } catch (err) { gbox = null; } }
          }
          regions.push({
            inv: { map: p.m, plan: p.plan, prep: p.prep, shape: s, dpr: pane.dpr, motion: live && interacting(), coldOk: offRender, globeBox: gbox,
              look: { color: GLR.hexRGB(ink.c0), color2: GLR.hexRGB(ink.alt), edge: GLR.hexRGB(ink.edge), ink: TH.inkRGB, alpha: S.alpha, alphaOwn: S.alpha, pattern: S.pattern, cell, lines: S.lines, sphN: sphN(), stretch } },
            fwd, onResult: (res) => globeResult(role, s, res, live),
          });
        } else {
          regions.push(...fwd);
          if (live && recs) notePath(role, s.id, p ? p.path : 'forward');
        }
      }
      const rl = linesOf(r, pf.p);
      if (rl.lineRes) {
        const area = kindType(s) === 'area';
        lines.push({ res: rl.lineRes, st: { map, dpr: pane.dpr, M: 8, width: (area ? 1.5 : 2) * pane.dpr, color: imageMode ? GLR.hexRGB(ink.edge) : GLR.hexRGB(TH.dcCasing), alpha: 1, casing: { color: imageMode ? halo : [1, 1, 1], alpha: 0.85, width: (area ? 3.5 : 4) * pane.dpr }, cacheKey: cache ? `${rl.lineKey}|${mk}` : null } });
      }
    }
    // the deformation on Y's globe (merged-views.md: one globe): X's outline in grey under H_t(X), where the paths start
    // (at a focused step, the image of X at the step's input stage)
    if (hom && imageMode && role === 'R') {
      const base = S.focus > 0 ? S.focus - 1 : 0, bm = stageMap(base), bk = mapKeyOf(bm);
      for (const s of S.shapes) {
        if (s.visible === false || kindType(s) === 'point') continue;
        const r = shapeGPU(s), rl = linesOf(r, r);
        if (rl.lineRes) lines.unshift({ res: rl.lineRes, st: { map: bm, dpr: pane.dpr, M: 8, width: 1 * pane.dpr, color: GLR.hexRGB(TH.faint), alpha: 0.9, cacheKey: `${rl.lineKey}|${bk}` } });
      }
    }
    const info = GLR.drawSphere({
      map: hom ? hom.map : focusMap(), mode: imageMode ? 'image' : 'color', cam: c, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(),
      colors: { plane: TH.planeRGB, gridMajor: GLR.hexRGB(TH.gridMajor), axis: TH.axisRGB, ink: TH.inkRGB },
      shell: TH.planeRGB, ink: TH.dark ? [0.75, 0.8, 0.88] : [0.25, 0.3, 0.38],
      regions, lines, plane: !!o.plane, probe: o.plane && o.probeW ? { w: o.probeW } : null, pre: o.pre || null,
      post: (o.post || []).filter(Boolean), net: o.net || 'plain',
    });
    // a program that waits for its first draw is warmed at a quiet moment (as drawScene); a deferred preparation draws
    // inverse on the next frame
    if (recs && live && GLR.inverseColdWaiting) scheduleWarm(interacting() ? 100 : 0);
    if (recs && live && prepDeferred) { prepDeferred = false; requestRender(role); }
    GLR.blit(pane.ctx);
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    glStatusNote(pane);
    if (!info) return null;
    const lift = liftC;
    const facing = (p) => { const tv = [info.eye[0] - p[0], info.eye[1] - p[1], info.eye[2] - p[2]]; const l = Math.hypot(...tv) || 1; return (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / l; };
    // the region's points, lifted to the sphere
    const Fp = hom && imageMode ? (hom.imageF || hom.F) : stageF(o.stage);
    let pi = 0;
    const labels = [];
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) !== 'point') continue;
      const idx = pi++;
      const w = Fp(C(s.p[0], s.p[1]));
      const p = CX.isFin(w) ? lift(w.re, w.im) : [0, 0, 1];
      if (facing(p) <= 0) continue;
      const q = project(pane, info.MVP, p.map((v) => v * 1.01));
      if (!q) continue;
      ctx.fillStyle = shapeInk(s).edge; ctx.strokeStyle = TH.halo; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, TAU); ctx.stroke(); ctx.fill();
      // (under the deformation the primes count the steps begun, as on the merged plane: z₀′ for 0 < t <= 1)
      labels.push({ x: q[0], y: q[1], text: pointLabel(s, idx, hom && imageMode ? morphPrimes() : o.stage) });
    }
    // the w-plane's point targets on the w-globe (P3b), marked and labelled as in Y Plane
    if (o.targetPts) {
      let ti = 0;
      for (const s of S.targets || []) {
        if (kindType(s) !== 'point') continue;
        const idx = ti++;
        if (s.visible === false) continue;
        const p = lift(s.p[0], s.p[1]);
        if (facing(p) <= 0) continue;
        const q = project(pane, info.MVP, p.map((v) => v * 1.01));
        if (!q) continue;
        ctx.fillStyle = shapeInk(s).edge; ctx.strokeStyle = TH.halo; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(q[0], q[1], 4, 0, TAU); ctx.stroke(); ctx.fill();
        labels.push({ x: q[0], y: q[1], text: targetLabel(s, idx) });
      }
    }
    // the deformation's live paths t -> H_t(z) on the merged globe, over the sphere's front side
    if (hom && imageMode && role === 'R' && !figMode && S.morphPaths !== false && !morphHasDeriv()) {
      try {
        const Pg = (w) => { if (!w || !CX.isFin(w)) return null; const p = lift(w.re, w.im); return facing(p) > 0.02 ? project(pane, info.MVP, p.map((v) => v * 1.01)) : null; };
        drawMorphPaths(pane, morphSelGlobe(pane), hom.imageF || hom.F, Pg);
      } catch (e) { console.error('deformation paths', e); }
    }
    if (labels.length) placeLabels(ctx, pane, labels);
    // without the plane, the probe is a ring on the globe
    if (!o.plane && o.probeW && CX.isFin(o.probeW)) {
      const p = lift(o.probeW.re, o.probeW.im);
      const q = facing(p) > 0 ? project(pane, info.MVP, p.map((v) => v * 1.01)) : null;
      if (q) {
        ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = TH.probe; ctx.beginPath(); ctx.arc(q[0], q[1], 5, 0, TAU); ctx.stroke();
      }
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `italic 500 13px ${TH.math}`;
    const pts = [['0', [0, 0, -1]], ['∞', [0, 0, 1]], ['1', lift(1, 0)], ['i', lift(0, 1)], ['−1', lift(-1, 0)], ['−i', lift(0, -1)]];
    for (const [lab, p] of pts) {
      const f = facing(p);
      const u = Math.max(0, Math.min(1, (f - 0.05) / 0.25)), a = u * u * (3 - 2 * u);   // smoothstep(0.05, 0.3, n·v)
      if (a <= 0) continue;
      // poles: just beyond the globe; equator points: just above the |z| = 1 line, so the label never sits on it
      const q = project(pane, info.MVP, p[2] === 0 ? [p[0] * 1.06, p[1] * 1.06, 0.1] : p.map((v) => v * 1.1));
      if (!q) continue;
      ctx.globalAlpha = a;
      ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.strokeText(lab, q[0], q[1]);
      ctx.fillStyle = TH.label; ctx.fillText(lab, q[0], q[1]);
      if (a > 0.3) labelReg(pane).marks.push([q[0], q[1], 9]);   // point labels (placed after the frame) keep clear
    }
    ctx.globalAlpha = 1;
    return info;
  }
  // ---- X Sphere (S.view.L.surf 'sphere'): the left plane on the Riemann sphere, its shapes or its phase portrait ----
  // camL orbits it like camS (the app's drag, zoom and reset act on camL / CAML); sphereView keeps it fitted.
  // It starts below the equator, looking up at the south pole: the domain's shapes usually sit near 0.
  const CAML = { yaw: -60 * DEG, pitch: -24 * DEG, dist: 1.16 / Math.sin(14 * DEG) * 1.05, tx: 0, ty: 0, tz: 0, fov: 28 * DEG };
  const camL = Object.assign({ vyaw: 0, vpitch: 0 }, CAML);
  function renderSphereLeft(pane) {
    // X Sphere + Phase: the phase portrait of the map in focus on the globe (or of H_t with the transport open), the
    // shapes outlined (earlier the right pane's Sphere > Phase)
    // the w-plane targets pulled back by the focused map, painted on the globe (GLR.drawSphere st.pre) as in the flat
    // view, in both paints (over the portrait, area fills at half strength)
    const pre = typeof hasTargets === 'function' && hasTargets() && typeof preimageTargets === 'function'
      ? { map: endMap(), targets: preimageTargets(false), halo: GLR.hexRGB(TH.halo) } : null;
    if (lPhase()) {
      const hv = typeof homView === 'function' ? homView() : null;
      if (pre) pre.targets = pre.targets.map((t) => (t.alpha < 1 ? Object.assign(t, { alpha: t.alpha * 0.5 }) : t));
      return sphereView(pane, camL, CAML, { imageMode: false, stage: leftStage(), plane: !!xView().eq, probeW: probe || null, hom: hv, pre: pre && pre.targets.length ? pre : null, role: 'L', post: [globeDraftPass('L')], net: globeEdit('L') ? globeNet() : 'plain' });
    }
    // the left plane's point under the probe: the probe itself (it is kept in this plane's coordinates); a shape draft
    // drawn on the globe (P3b) over the shapes
    return sphereView(pane, camL, CAML, { imageMode: true, stage: leftStage(), plane: !!xView().eq, probeW: probe || null, pre: pre && pre.targets.length ? pre : null, role: 'L', post: [globeDraftPass('L')], net: globeEdit('L') ? globeNet() : 'plain' });
  }
  // a one-line note at the top of a sphere view, on a halo (what the globe leaves out)
  function sphereCaption(pane, text) {
    const ctx = pane.ctx;
    ctx.save();
    ctx.font = `12px ${TH.ui}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const y = pane.h - 14;   // at the foot of the pane (the readout sits at the top, the zoom buttons at the right)
    ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = TH.halo; ctx.strokeText(text, pane.w / 2, y);
    ctx.fillStyle = TH.muted; ctx.fillText(text, pane.w / 2, y);
    ctx.restore();
  }
  // the point of the left plane under pane pixel (x, y) (CSS px) of the sphere view: the ray from the eye through
  // the pixel meets the globe, and the stereographic projection from the north pole takes the hit to the plane.
  // null off the globe or at the north pole (infinity).
  function pickSphereLeft(x, y) { return pickSphere(paneL, camL, x, y); }
  let leftSphereInfo = null;   // the left globe's last frame {MVP, eye}: overlays lift their marks onto it
  function leftPaneBox() {
    const v = leftView(), P = solo() === 'R' ? paneR : paneL;
    return { x0: v.cx - P.w / 2 / v.s, x1: v.cx + P.w / 2 / v.s, y0: v.cy - P.h / 2 / v.s, y1: v.cy + P.h / 2 / v.s };
  }
  // ---------------- the deformation as one picture (notes/ui-design/morph-figure.md 3-6) ----------------
  // One plane holds X (neutral grey), its image (the carried pattern) and the paths t -> H_t(z) of sample points, from a
  // dot at z to an arrowhead at F(z). With the user's change (README, decisions 2026-10-20): samples are a well-spread
  // set of boundary AND interior points, the cap is 20 at a single column and 40 at a double column (or a pane of that
  // width), and an arrow is dropped only for real clutter: through infinity or a cut, fixed, off the panel, hidden along
  // an axis or an edge, its head on another start dot (or a path over a start dot), start dots or heads crowding, running
  // alongside another path, or more than MF.maxCross crossings. One rule for the screen and the figure; px are the
  // drawing's own (CSS px on screen, figure px = 1/96 in in the export).
  const MF = {
    perInch: 5.8, minN: 20, maxN: 40,
    margin: 3, fixedPx: 7, gap: 10, headGap: 6, headCrowd: 9, dotClear: 3.5, along: 2.5, alongPx: 16, alongFrac: 0.3, maxCross: 2, headSpread: 2.5,
    // the figure (morph-figure.md 5, table)
    pathW: 0.65, pathColor: '#1B252C', haloW: 2.0, haloA: 0.85, headL: 4.6, headW: 1.75, headNotch: 0.7, dotR: 1.4, dotRing: 2.1,
    srcFillA: 0.07, srcEdgeW: 0.6, dash: '3.2 2.2',
    // the figure is printed in the light theme whatever the screen's theme: fixed inks (the light theme's ink-2 and ink)
    outlineInk: '#3E4C56', labelInk: '#121A20',
  };
  const mfBudget = (widthIn) => Math.max(MF.minN, Math.min(MF.maxN, Math.round(MF.perInch * widthIn)));
  const morphHasDeriv = () => morphRange().steps.some((k) => isDeriv(k));
  // the largest 1-2-5 step not above raw
  const niceFloor = (raw) => { const p = 10 ** Math.floor(Math.log10(raw)); const m = raw / p; return (m >= 5 ? 5 : m >= 2 ? 2 : 1) * p; };
  const mDist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const segD = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    const t = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const orient3 = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const segX = (a, b, c, d) => { const d1 = orient3(c, d, a), d2 = orient3(c, d, b), d3 = orient3(a, b, c), d4 = orient3(a, b, d); return d1 * d2 < 0 && d3 * d4 < 0; };
  // Liang-Barsky: does segment ab meet rectangle R?
  function segInRect(a, b, R) {
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
    const p = [-dx, dx, -dy, dy], q = [a[0] - R.x0, R.x1 - a[0], a[1] - R.y0, R.y1 - a[1]];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; continue; }
      const r = q[i] / p[i];
      if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
    }
    return true;
  }
  // a uniform grid of segments (px) for distance, crossing and rectangle queries; tag: the path the segment belongs to
  // B (optional): px bounds that hold every segment; the cells are then a flat array (no hashing: the selection's
  // distance queries were most of its time), with a Map for anything outside
  function SegGrid(cell = 8, B = null) {
    const m = new Map();
    const key = (i, j) => i * 73856093 ^ j * 19349663;
    let arr = null, gx0 = 0, gy0 = 0, nx = 0, ny = 0;
    if (B) { gx0 = Math.floor(B.x0 / cell); gy0 = Math.floor(B.y0 / cell); nx = Math.floor(B.x1 / cell) - gx0 + 1; ny = Math.floor(B.y1 / cell) - gy0 + 1; if (nx > 0 && ny > 0 && nx * ny <= 1 << 20) arr = new Array(nx * ny); }
    const get = (i, j) => { if (arr) { const a = i - gx0, b = j - gy0; if (a >= 0 && a < nx && b >= 0 && b < ny) return arr[a * ny + b]; } return m.size ? m.get(key(i, j)) : undefined; };
    const put = (i, j, sgm) => {
      let l;
      if (arr) { const a = i - gx0, b = j - gy0; if (a >= 0 && a < nx && b >= 0 && b < ny) { l = arr[a * ny + b]; if (!l) arr[a * ny + b] = l = []; l.push(sgm); return; } }
      const k = key(i, j); l = m.get(k); if (!l) m.set(k, l = []); l.push(sgm);
    };
    // the cell range to visit: clipped to the array when nothing lies outside it
    const rng = (i0, i1, j0, j1) => (arr && !m.size ? [Math.max(i0, gx0), Math.min(i1, gx0 + nx - 1), Math.max(j0, gy0), Math.min(j1, gy0 + ny - 1)] : [i0, i1, j0, j1]);
    const add = (a, b, tag) => {
      const i0 = Math.floor(Math.min(a[0], b[0]) / cell), i1 = Math.floor(Math.max(a[0], b[0]) / cell);
      const j0 = Math.floor(Math.min(a[1], b[1]) / cell), j1 = Math.floor(Math.max(a[1], b[1]) / cell);
      if ((i1 - i0 + 1) * (j1 - j0 + 1) > 4096) return;
      const sgm = [a, b, tag];
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) put(i, j, sgm);
    };
    return {
      add,
      addLine(l, tag) { for (let i = 1; i < l.length; i++) add(l[i - 1], l[i], tag); if (l.length === 1) add(l[0], l[0], tag); },
      // the distance from p to the nearest segment within r (Infinity beyond r); skip(tag) leaves a path out
      near(p, r, skip) {
        let d = Infinity;
        const [i0, i1, j0, j1] = rng(Math.floor((p[0] - r) / cell), Math.floor((p[0] + r) / cell), Math.floor((p[1] - r) / cell), Math.floor((p[1] + r) / cell));
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = get(i, j); if (l) for (const s of l) if (!skip || s[2] !== skip) { const q = segD(p, s[0], s[1]); if (q < d) d = q; } }
        return d <= r ? d : Infinity;
      },
      // the tags of the segments segment ab crosses
      crossTags(a, b, out) {
        const [i0, i1, j0, j1] = rng(Math.floor(Math.min(a[0], b[0]) / cell), Math.floor(Math.max(a[0], b[0]) / cell), Math.floor(Math.min(a[1], b[1]) / cell), Math.floor(Math.max(a[1], b[1]) / cell));
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = get(i, j); if (l) for (const s of l) if (segX(a, b, s[0], s[1])) out.add(s[2]); }
      },
      hitsRect(R) {
        const [i0, i1, j0, j1] = rng(Math.floor(R.x0 / cell), Math.floor(R.x1 / cell), Math.floor(R.y0 / cell), Math.floor(R.y1 / cell));
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const l = get(i, j); if (l) for (const s of l) if (segInRect(s[0], s[1], R)) return true; }
        return false;
      },
    };
  }
  const resamplePx = (l, step = 1.5) => {
    const out = [l[0]];
    for (let i = 1; i < l.length; i++) { const a = l[i - 1], b = l[i], n = Math.ceil(mDist(a, b) / step); for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); }
    return out;
  };
  const lenPx = (l) => { let s = 0; for (let i = 1; i < l.length; i++) s += mDist(l[i], l[i - 1]); return s; };
  // the path t -> H_t(z) traced adaptively in px (a chord under 1.2 px, or a midpoint within 0.04 px of it), as samples
  // {T, w, p}; broken where H_T(z) is not finite or jumps (a pole or a cut on the way). Fat(T): H_T, shared (cached) by
  // every candidate, since all paths subdivide [0, Tend] at the same dyadic times.
  function tracePath(z, Fat, Tend, P, N) {
    const ev = (T) => { const w = Fat(T)(z); if (!w || !CX.isFin(w)) return null; const p = P(w); return Math.abs(p[0]) < 2e4 && Math.abs(p[1]) < 2e4 ? { T, w, p } : null; };
    const out = [];
    let broken = false;
    const rec = (a, b, d) => {
      if (!a || !b) { broken = true; return; }
      const L = mDist(a.p, b.p);
      if (d >= 16) { if (L > 25) broken = true; out.push(b); return; }
      const m = ev(0.5 * (a.T + b.T));
      if (!m) { broken = true; return; }
      const dev = Math.hypot(m.p[0] - 0.5 * (a.p[0] + b.p[0]), m.p[1] - 0.5 * (a.p[1] + b.p[1]));
      if ((L < 1.2 && dev < 0.12) || (dev < 0.04 && d >= 2)) { out.push(b); return; }
      rec(a, m, d + 1); if (broken) return; rec(m, b, d + 1);
    };
    let a = ev(0);
    if (!a) return { broken: true, s: [] };
    out.push(a);
    for (let i = 1; i <= N && !broken; i++) { const b = ev(Tend * i / N); rec(a, b, 0); a = b; }
    return { broken, s: out };
  }
  // X: the visible area shapes (and curve shapes) of the z-plane; inside(z): z lies in one of the areas
  function morphX() {
    const vis = S.shapes.filter((s) => s.visible !== false);
    const areas = vis.filter((s) => kindType(s) === 'area');
    const levels = areas.map((s) => { try { return Region.levelOf(s); } catch (e) { return null; } }).filter(Boolean);
    const inside = (z) => levels.some((L) => { try { return L(z) > 0; } catch (e) { return false; } });
    let bounded = true;
    for (const s of areas) { try { if (!Region.bboxOf(s)) bounded = false; } catch (e) { bounded = false; } }
    const open = areas.some((s) => Region.isOpen(s));
    return { vis, areas, inside, bounded, open };
  }
  // X's boundary (and curve shapes) inside win, as world polylines [[re, im], ...]
  function morphOutline(X, win) {
    const out = [];
    for (const s of X.vis) {
      if (kindType(s) === 'point') continue;
      let cs = [];
      try { cs = Region.curvesOf(s, win); } catch (e) { cs = []; }
      for (const c of cs) {
        const p = Region.sampleCurve(c, win);
        const l = [];
        for (let i = 0; i + 1 < p.length; i += 2) l.push([p[i], p[i + 1]]);
        if (c.closed && l.length) l.push(l[0]);
        if (l.length > 1) out.push({ l, c, s });
      }
    }
    return out;
  }
  // morph-figure.md 4, with the user's change: candidates are the corners, the boundary's crossings with the lattice
  // lines of step h (arcs and other curves: equal arc length h), the points the user drew, and the nodes of a lattice of
  // step hi inside X (at least 0.4 hi and 6 px from the boundary). h and hi are 1-2-5 steps chosen so each family
  // offers somewhat more candidates than the budget; the selection then keeps a well-spread subset.
  function morphCandidates(X, outline, win, pxPerUnit, budget) {
    const inWin = (z) => z.re >= win.x0 && z.re <= win.x1 && z.im >= win.y0 && z.im <= win.y1;
    let L = 0;
    for (const o of outline) for (let i = 1; i < o.l.length; i++) { const a = o.l[i - 1], b = o.l[i]; if (inWin(C(a[0], a[1])) || inWin(C(b[0], b[1]))) L += Math.hypot(b[0] - a[0], b[1] - a[1]); }
    const out = [];
    const minPx = 9 / pxPerUnit;
    const h = Math.max(L > 0 ? niceFloor(L / (1.3 * budget)) : 1, niceFloor(Math.max(minPx, 1e-12)) * 2);
    const far = (z, d) => !out.some((q) => Math.hypot(q.z.re - z.re, q.z.im - z.im) < d);
    const push = (z, kind, s) => { if (CX.isFin(z) && inWin(z) && far(z, 0.45 * h)) out.push({ z, kind, s }); };
    for (const s of X.vis) if (kindType(s) === 'point') { const z = C(s.p[0], s.p[1]); if (inWin(z)) out.push({ z, kind: 'point', s }); }
    const latticeOnSeg = (a, b) => {
      const dx = b.re - a.re, dy = b.im - a.im, useX = Math.abs(dx) >= Math.abs(dy);
      const c0 = useX ? a.re : a.im, c1 = useX ? b.re : b.im;
      if (Math.abs(c1 - c0) < 1e-15) return;
      const lo = Math.max(Math.min(c0, c1), useX ? win.x0 : win.y0), hi = Math.min(Math.max(c0, c1), useX ? win.x1 : win.y1);
      if (!(hi >= lo) || (hi - lo) / h > 4000) return;
      for (let k = Math.ceil(lo / h - 1e-9); k * h <= hi + 1e-9 * h; k++) { const u = (k * h - c0) / (c1 - c0); push(C(a.re + dx * u, a.im + dy * u), 'edge', null); }
    };
    // corners first
    for (const o of outline) {
      const c = o.c;
      if (c.pts) for (const q of c.pts) push(q, 'corner', null);
      else if (c.a && c.b && !c.long) { push(c.a, 'corner', null); push(c.b, 'corner', null); }
      else if (!c.closed && !c.long && c.f) { push(c.f(0), 'corner', null); push(c.f(1), 'corner', null); }
    }
    for (const o of outline) {
      const c = o.c;
      if (c.pts) { for (let i = 1; i < c.pts.length; i++) latticeOnSeg(c.pts[i - 1], c.pts[i]); continue; }
      if (c.a && c.b) { latticeOnSeg(c.a, c.b); continue; }
      // any other curve: equal arc length about h along its samples
      let acc = 0;
      const l = o.l;
      push(C(l[0][0], l[0][1]), 'edge', null);
      for (let i = 1; i < l.length; i++) {
        const sl = Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]);
        acc += sl;
        if (acc >= h) { acc = 0; push(C(l[i][0], l[i][1]), 'edge', null); }
      }
    }
    // interior nodes: the area of X in the window, by a 64 x 64 sample
    if (X.areas.length) {
      let nIn = 0;
      const G = 64;
      for (let i = 0; i < G; i++) for (let j = 0; j < G; j++) if (X.inside(C(win.x0 + (i + 0.5) / G * (win.x1 - win.x0), win.y0 + (j + 0.5) / G * (win.y1 - win.y0)))) nIn++;
      const A = nIn / (G * G) * (win.x1 - win.x0) * (win.y1 - win.y0);
      if (A > 0) {
        const hi = Math.max(niceFloor(Math.sqrt(A / (1.3 * budget))), niceFloor(14 / pxPerUnit));
        const dense = [];
        for (const o of outline) for (const p of o.l) dense.push(p);
        const clear = Math.max(0.4 * hi, 6 / pxPerUnit);
        const nx = (win.x1 - win.x0) / hi, ny = (win.y1 - win.y0) / hi;
        if (nx * ny < 40000) {
          for (let i = Math.ceil(win.x0 / hi); i * hi <= win.x1; i++) {
            for (let j = Math.ceil(win.y0 / hi); j * hi <= win.y1; j++) {
              const z = C(i * hi, j * hi);
              if (!X.inside(z)) continue;
              let ok = true;
              for (const p of dense) if (Math.abs(p[0] - z.re) < clear && Math.abs(p[1] - z.im) < clear && Math.hypot(p[0] - z.re, p[1] - z.im) < clear) { ok = false; break; }
              if (ok && far(z, 0.45 * Math.min(h, hi))) out.push({ z, kind: 'node', s: null });
            }
          }
        }
      }
    }
    return { cands: out, h };
  }
  // the selection (morph-figure.md 4, revised for more arrows): hard prunes, then a greedy farthest-point choice of
  // start points (boundary points slightly preferred, then the clearance to the kept paths and the length as tie-breaks),
  // updated incrementally as each path is kept; a candidate dies only for clutter. ctx: {box (px), budget, ink: SegGrid
  // of the static ink (X's outline, the image's edge), axes: [x, y] px of the origin}
  // (a generator: it yields between candidates so the work can run in slices off the frame; runGen / runGenSliced)
  const bboxPx = (l, e = 0) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const p of l) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; } return { x0: x0 - e, x1: x1 + e, y0: y0 - e, y1: y1 + e }; };
  const boxD = (A, B) => Math.hypot(Math.max(0, A.x0 - B.x1, B.x0 - A.x1), Math.max(0, A.y0 - B.y1, B.y0 - A.y1));
  const inBoxE = (p, B, e) => p[0] >= B.x0 - e && p[0] <= B.x1 + e && p[1] >= B.y0 - e && p[1] <= B.y1 + e;
  function* morphSelectGen(cands, ctx) {
    const { box, budget, ink, axes } = ctx;
    const m = MF.margin;
    const inner = { x0: box.x + m, x1: box.x + box.w - m, y0: box.y + m, y1: box.y + box.h - (ctx.footPx || 0) - m };
    const nogo = ctx.nogo || [];
    const inBox = (p) => p[0] >= inner.x0 && p[0] <= inner.x1 && p[1] >= inner.y0 && p[1] <= inner.y1 && !nogo.some((R) => p[0] >= R.x0 && p[0] <= R.x1 && p[1] >= R.y0 && p[1] <= R.y1);
    const fixedPx = Math.max(MF.fixedPx, ctx.fixedPx || 0);
    const log = [];
    const ok = [];
    for (const c of cands) {
      if (c.broken) { log.push([c, 'through ∞ or a cut']); continue; }
      if (c.len < fixedPx) { log.push([c, 'fixed']); continue; }
      if (!c.l.every(inBox)) { log.push([c, 'leaves the panel']); continue; }
      if (ctx.excursion && !c.l.every((p) => inBoxE(p, ctx.excursion, 0))) { log.push([c, 'a far excursion']); continue; }
      const hidden = c.rs.every((p) => Math.abs(p[1] - axes[1]) <= 1.5 || Math.abs(p[0] - axes[0]) <= 1.5 || ink.near(p, 1.5) <= 1.5);
      if (hidden) { log.push([c, 'hidden along an axis or an edge']); continue; }
      c.dS = Infinity; c.dH = Infinity; c.dB = Infinity; c.nX = 0; c.alongN = 0; c.dead = null; c.kept = false;
      c.bb = bboxPx(c.l);
      ok.push(c);
    }
    const kept = [];
    const R30 = 30;
    // keep k: update every live candidate against it. Pairs whose boxes are farther apart than every radius used
    // below (30 px) only get the point tests; points of c farther than the radius from k's box are not queried, and
    // the distance query shrinks to the nearest distance found so far (exact: the same values as a full search).
    function* keep(k) {
      kept.push(k); k.kept = true;
      const kb = k.bb || bboxPx(k.l);
      const g = SegGrid(6, { x0: kb.x0 - 1, y0: kb.y0 - 1, x1: kb.x1 + 1, y1: kb.y1 + 1 });
      g.addLine(k.l, k);
      const s1 = k.l[0], e1 = k.l[k.l.length - 1];
      let n = 0;
      for (const c of ok) {
        if (c.dead || c.kept) continue;
        if (++n % 4 === 0) yield;
        const s0 = c.l[0], e0 = c.l[c.l.length - 1];
        let bad = null;
        // heads that meet are kept only when the images are the same point (z and -z under z^2: M3)
        const wa = c.s[c.s.length - 1].w, wb = k.s[k.s.length - 1].w;
        const same = Math.hypot(wa.re - wb.re, wa.im - wb.im) <= 1e-9 * Math.max(1, Math.hypot(wa.re, wa.im));
        const ee = same ? 0 : Math.max(2, mDist(e0, e1));
        const near = boxD(c.bb, kb) <= R30;
        if (mDist(e0, s1) < MF.headGap || mDist(s0, e1) < MF.headGap) bad = 'its head lands on a start dot';
        else if (mDist(s0, s1) < MF.gap) bad = 'start dots crowd';
        else if (ee >= 2 && ee < (ctx.headCrowd || MF.headCrowd)) bad = 'heads crowd';
        else if (near && g.near(s0, MF.dotClear) < MF.dotClear) bad = 'a path runs over its start dot';
        else if (near && ee >= 2 && g.near(e0, MF.dotClear) < MF.dotClear) bad = 'its head lies on a path';
        else if (near) {
          // its body over k's start dot or head
          let d1 = Infinity, d2 = Infinity;
          const t1 = inBoxE(s1, c.bb, MF.dotClear), t2 = ee >= 2 && inBoxE(e1, c.bb, MF.dotClear);
          if (t1 || t2) for (let i = 1; i < c.l.length; i++) { if (t1) d1 = Math.min(d1, segD(s1, c.l[i - 1], c.l[i])); if (t2) d2 = Math.min(d2, segD(e1, c.l[i - 1], c.l[i])); }
          if (d1 < MF.dotClear) bad = 'it runs over a start dot';
          else if (d2 < MF.dotClear) bad = 'a head lies on it';
        }
        if (!bad && near) {
          let nNear = 0, dmin = Infinity;
          for (const p of c.rs) {
            const r = Math.max(MF.along, Math.min(R30, dmin));
            if (!inBoxE(p, kb, r)) continue;
            const d = g.near(p, r);
            if (d < dmin) dmin = d;
            if (d <= MF.along) nNear++;
          }
          c.dB = Math.min(c.dB, dmin);
          c.alongN += nNear;
          const crossed = new Set();
          for (let i = 1; i < c.l.length && !crossed.size; i++) g.crossTags(c.l[i - 1], c.l[i], crossed);
          if (crossed.size) c.nX++;
          if (c.alongN * 1.5 > Math.max(MF.alongPx, MF.alongFrac * c.len)) bad = 'runs alongside a kept path';
          else if (c.nX > MF.maxCross) bad = `crosses more than ${MF.maxCross} kept paths`;
        }
        if (bad) { c.dead = bad; log.push([c, bad]); continue; }
        c.dS = Math.min(c.dS, mDist(s0, s1), mDist(s0, e1) * 1.5);
        // (heads at the same image point, z and -z under z^2, do not crowd each other)
        if (!same) c.dH = Math.min(c.dH, ee);
      }
    }
    // the points the user drew always get a path (when it can be drawn at all)
    for (const c of ok) if (c.sp.kind === 'point' && !c.dead) yield* keep(c);
    while (kept.length < budget) {
      let best = null, bestScore = -Infinity;
      for (const c of ok) {
        if (c.dead || c.kept) continue;
        const bonus = c.sp.kind === 'corner' ? 10 : c.sp.kind === 'edge' ? 5 : 0;
        // spread in both planes: the start dots and the heads (an image much smaller than X, the strip's disc, would
        // otherwise get heads that crowd and kill most candidates)
        const score = Math.min(c.dS, MF.headSpread * c.dH, 90) + 0.3 * Math.min(c.dB, 30) + 0.02 * c.len + bonus;
        if (score > bestScore) { bestScore = score; best = c; }
      }
      if (!best) break;
      yield* keep(best);
    }
    for (const c of ok) if (!c.kept && !c.dead) log.push([c, 'over the budget']);
    // non-injective maps (M3): heads that meet stop 1.5 px short, both visible
    for (const a of kept) for (const b of kept) {
      if (a === b) continue;
      const wa = a.s[a.s.length - 1].w, wb = b.s[b.s.length - 1].w;
      if (Math.hypot(wa.re - wb.re, wa.im - wb.im) <= 1e-9 * Math.max(1, Math.hypot(wa.re, wa.im))) { a.meet = true; b.meet = true; }
    }
    return { kept, log };
  }
  // run a generator to its end (synchronously), or in slices of about `slice` ms between which the event loop runs
  // (frames, input); alive() false stops it (null)
  const runGen = (g) => { let r; do r = g.next(); while (!r.done); return r.value; };
  // (a macrotask through a MessageChannel: unlike setTimeout(0) it is not clamped to 4 ms when nested)
  const mfChan = new MessageChannel(), mfQ = [];
  mfChan.port1.onmessage = () => { const f = mfQ.shift(); if (f) f(); };
  const nextMacrotask = () => new Promise((res) => { mfQ.push(res); mfChan.port2.postMessage(0); });
  async function runGenSliced(g, alive = () => true, slice = 5) {
    let t0 = performance.now();
    for (;;) {
      const r = g.next();
      if (r.done) return r.value;
      if (performance.now() - t0 > slice) {
        await nextMacrotask();
        if (!alive()) return null;
        t0 = performance.now();
      }
    }
  }
  // the whole selection for a drawing: P maps the plane to px, box is the panel (px), win its world window. A generator
  // (yields between candidates); morphPathsFor runs it to the end. opt: footPx, headCrowd, headL (the drawing's
  // arrowhead length: a path shorter than 3 heads reads as a bead and is 'fixed'), nogo (px rectangles to keep clear)
  function* morphPathsGen(P, box, win, widthIn, Tend, opt = {}) {
    const X = morphX();
    const outline = morphOutline(X, win);
    yield;
    const pxPerUnit = box.w / (win.x1 - win.x0);
    const budget = opt.budget || mfBudget(widthIn);
    const Fc = new Map();
    const Fat = (T) => { let f = Fc.get(T); if (!f) { f = morphAt(T); Fc.set(T, f); } return f; };
    // the static ink: X's outline and the image's edge at Tend, in px
    const pxLines = [], endLines = [];
    for (const o of outline) pxLines.push(o.l.map((q) => P(C(q[0], q[1]))));
    const Fe = Fat(Tend);
    for (const o of outline) {
      let cur = [];
      for (const q of o.l) {
        const w = Fe(C(q[0], q[1]));
        const p = w && CX.isFin(w) ? P(w) : null;
        if (!p || Math.abs(p[0]) > 2e4 || Math.abs(p[1]) > 2e4 || (cur.length && mDist(p, cur[cur.length - 1]) > 40)) { if (cur.length > 1) endLines.push(cur); cur = p ? [p] : []; continue; }
        cur.push(p);
      }
      if (cur.length > 1) endLines.push(cur);
    }
    yield;
    const inPanel = (p) => p[0] >= box.x && p[0] <= box.x + box.w && p[1] >= box.y && p[1] <= box.y + box.h;
    const boxOf = (lines) => { let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const l of lines) for (const p of l) if (inPanel(p)) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return x1 >= x0 && y1 >= y0 ? { x0, x1, y0, y1 } : null; };
    const toW = (px, py) => C(win.x0 + (px - box.x) / box.w * (win.x1 - win.x0), win.y1 - (py - box.y) / box.h * (win.y1 - win.y0));
    // An unbounded X is sampled near its image and its own visible boundary: the union of 2.5 half-sizes of the
    // visible image's box and the box of X's boundary in view (the Joukowski circle's top and bottom, which become the
    // airfoil's two surfaces), so far points do not make giant loops across the panel. A bounded X is sampled whole.
    let swin = win;
    const imgB = boxOf(endLines), xB = boxOf(pxLines);
    if (!X.bounded) {
      let U = null;
      if (imgB) {
        const cx = (imgB.x0 + imgB.x1) / 2, cy = (imgB.y0 + imgB.y1) / 2, hw = Math.max(40, 2.5 * (imgB.x1 - imgB.x0) / 2), hh = Math.max(40, 2.5 * (imgB.y1 - imgB.y0) / 2);
        U = { x0: cx - hw, x1: cx + hw, y0: cy - hh, y1: cy + hh };
      }
      if (xB && U) U = { x0: Math.min(U.x0, xB.x0 - 24), x1: Math.max(U.x1, xB.x1 + 24), y0: Math.min(U.y0, xB.y0 - 24), y1: Math.max(U.y1, xB.y1 + 24) };
      if (U && U.x1 > U.x0 && U.y1 > U.y0) {
        const a = toW(U.x0, U.y1), b = toW(U.x1, U.y0);
        swin = { x0: Math.max(win.x0, a.re), x1: Math.min(win.x1, b.re), y0: Math.max(win.y0, a.im), y1: Math.min(win.y1, b.im) };
        if (!(swin.x1 > swin.x0 && swin.y1 > swin.y0)) swin = win;
      }
    }
    // a path is drawn only when it stays near X and its image: within the box of X's visible part and F(X) grown by
    // a quarter of its size (a multi-step chain can send a point far out and back: a needle loop across the panel)
    let exc = null;
    if (Math.ceil(Tend - 1e-9) > 1) {
      const sb = (() => { const a = P(C(swin.x0, swin.y1)), b = P(C(swin.x1, swin.y0)); return { x0: a[0], x1: b[0], y0: a[1], y1: b[1] }; })();
      const parts = [imgB, X.bounded ? xB : (xB ? { x0: Math.max(sb.x0, box.x), x1: Math.min(sb.x1, box.x + box.w), y0: Math.max(sb.y0, box.y), y1: Math.min(sb.y1, box.y + box.h) } : null)].filter(Boolean);
      if (parts.length) {
        const U = parts.reduce((A, B) => ({ x0: Math.min(A.x0, B.x0), x1: Math.max(A.x1, B.x1), y0: Math.min(A.y0, B.y0), y1: Math.max(A.y1, B.y1) }));
        const ex = Math.max(24, 0.25 * (U.x1 - U.x0)), ey = Math.max(24, 0.25 * (U.y1 - U.y0));
        exc = { x0: U.x0 - ex, x1: U.x1 + ex, y0: U.y0 - ey, y1: U.y1 + ey };
      }
    }
    const tm0 = performance.now();
    const { cands: sps, h } = morphCandidates(X, outline, swin, pxPerUnit, budget);
    if (budget > MF.minN) {
      const more = morphCandidates(X, outline, swin, pxPerUnit, MF.minN).cands;
      const tol = 0.25 * h;
      for (const c of more) if (!sps.some((q) => Math.abs(q.z.re - c.z.re) < tol && Math.abs(q.z.im - c.z.im) < tol)) sps.push(c);
    }
    const tm1 = performance.now();
    yield;
    const N = Math.max(24, 24 * Math.ceil(Tend));
    const cands = [];
    for (const sp of sps) {
      const tr = tracePath(sp.z, Fat, Tend, P, N);
      const l = tr.s.map((q) => q.p);
      const c = { sp, s: tr.s, broken: tr.broken || l.length < 2, l: l.length ? l : [[0, 0]] };
      c.len = lenPx(c.l); c.rs = resamplePx(c.l);
      cands.push(c);
      yield;
    }
    // Heads where the image is sparse (an image much smaller than X: the strip's disc, where a z-grid sends the heads
    // into crowds near ±1 and leaves the rest empty): a grid of the image's box in px, spaced a little over the head
    // crowding distance, each point with no candidate head near it pulled back by Newton's method on F(z) = w from
    // the candidate whose head is nearest; kept when z lies in X (inside swin) and F(z) = w to 1e-9.
    // (the heads of the paths that can be drawn at all: inside the panel and the excursion box all along)
    const drawable = (c) => !c.broken && c.l.every((p) => inPanel(p) && (!exc || inBoxE(p, exc, 0)));
    // (the image's box in px: the candidates' heads, the image of X's outline and of a 48 x 48 sample of X in the
    // window; a formula area has no outline)
    const imgPts = [];
    if (X.areas.length) {
      const G = 48, Fe1 = Fat(Tend);
      for (let i = 0; i < G; i++) {
        for (let j = 0; j < G; j++) {
          const z = C(win.x0 + (i + 0.5) / G * (win.x1 - win.x0), win.y0 + (j + 0.5) / G * (win.y1 - win.y0));
          if (!X.inside(z)) continue;
          const w = Fe1(z);
          if (w && CX.isFin(w)) imgPts.push(P(w));
        }
        if (i % 4 === 3) yield;
      }
    }
    const hB = boxOf([cands.filter((c) => !c.broken).map((c) => c.l[c.l.length - 1]), imgPts, ...endLines]);
    const heads = cands.filter(drawable).map((c) => [c.l[c.l.length - 1], c]);
    const starts = cands.filter((c) => !c.broken).map((c) => [c.l[c.l.length - 1], c]);
    if (X.areas.length && hB && starts.length) {
      const crowd = opt.headCrowd || MF.headCrowd, Fe2 = Fat(Tend), imgB = hB;
      const bw = imgB.x1 - imgB.x0, bh = imgB.y1 - imgB.y0;
      const sp = Math.max(crowd, Math.sqrt(bw * bh / 300));
      const near = (g, r) => heads.some(([e]) => Math.abs(e[0] - g[0]) < r && Math.abs(e[1] - g[1]) < r && mDist(e, g) < r);
      const tol = 0.25 * h;
      let added = 0;
      for (let gy = imgB.y0 + sp / 2; gy < imgB.y1 && added < 120; gy += sp) {
        for (let gx = imgB.x0 + sp / 2; gx < imgB.x1 && added < 120; gx += sp) {
          const g = [gx, gy];
          if (near(g, 0.5 * sp)) continue;
          yield;
          const w = toW(gx, gy);
          let best = null, bd = Infinity;
          for (const [e, c] of starts) { const d = mDist(e, g); if (d < bd) { bd = d; best = c; } }
          let z = best.sp.z, okN = false;
          for (let it = 0; it < 30; it++) {
            const f = Fe2(z);
            if (!f || !CX.isFin(f)) break;
            const r = CX.sub(f, w);
            if (CX.abs(r) <= 1e-9 * Math.max(1, CX.abs(w))) { okN = true; break; }
            const e = 1e-6 * Math.max(1, CX.abs(z)), fp = Fe2(C(z.re + e, z.im)), fm = Fe2(C(z.re - e, z.im));
            if (!fp || !fm || !CX.isFin(fp) || !CX.isFin(fm)) break;
            const d = CX.scale(CX.sub(fp, fm), 1 / (2 * e));
            if (!(CX.abs(d) > 0)) break;
            let st = CX.div(r, d);
            const L = CX.abs(st), cap = 0.5 * Math.max(swin.x1 - swin.x0, swin.y1 - swin.y0);
            if (L > cap) st = CX.scale(st, cap / L);
            z = CX.sub(z, st);
          }
          if (!okN || !X.inside(z) || z.re < win.x0 || z.re > win.x1 || z.im < win.y0 || z.im > win.y1) continue;
          if (sps.some((q) => Math.abs(q.z.re - z.re) < tol && Math.abs(q.z.im - z.im) < tol)) continue;
          const sp2 = { z, kind: 'node', s: null };
          sps.push(sp2);
          const tr = tracePath(z, Fat, Tend, P, N);
          const l = tr.s.map((q) => q.p);
          const c = { sp: sp2, s: tr.s, broken: tr.broken || l.length < 2, l: l.length ? l : [[0, 0]] };
          c.len = lenPx(c.l); c.rs = resamplePx(c.l);
          cands.push(c);
          if (drawable(c)) heads.push([c.l[c.l.length - 1], c]);
          added++;
          yield;
        }
      }
    }
    const ink = SegGrid(8);
    for (const l of pxLines) ink.addLine(l, 'X');
    for (const l of endLines) ink.addLine(l, 'FX');
    const tm2 = performance.now();
    const sel = yield* morphSelectGen(cands, { box, budget, ink, axes: P(C(0, 0)), footPx: opt.footPx || 0, headCrowd: opt.headCrowd, fixedPx: 3 * (opt.headL || MF.headL), nogo: opt.nogo, excursion: exc });
    const tm3 = performance.now();
    return { kept: sel.kept, log: sel.log, budget, h, X, outline, pxLines, endLines, Tend, nCands: cands.length, ms: { cand: tm1 - tm0, trace: tm2 - tm1, select: tm3 - tm2, nT: Fc.size } };
  }
  const morphPathsFor = (...a) => runGen(morphPathsGen(...a));
  // the screen's selection. Choosing is never done inside a frame: a frame draws the last finished selection (its
  // paths re-traced under the current chain and shapes when those changed, re-projected when the view changed) and asks
  // for a new one, which runs in slices off the frame once the chain, the shapes and the view have been still for
  // 150 ms (a scrub, a shape drag, a pan or a zoom never re-choose per frame) and requests a render when it is done.
  // The first selection after opening starts at once.
  const MF_SCREEN_HL = 6.5;
  const mfCache = { key: '', vkey: '', v0: null, sel: null, rkey: '', rsel: null, job: null, want: '', timer: 0 };
  // The kept start points are points of the plane, not of the screen (merged-views review: a 60 px pan swapped the
  // whole set once the job ran, and during play the paths popped between sets): a selection stays while the view is
  // within a pan of 30 % of the panel and a zoom of 1.5x of the view it was chosen in, at the same panel size; the
  // frame re-projects its paths. A larger pan or zoom chooses again.
  function mfViewOk(pane) {
    const a = mfCache.v0, v = pane.view;
    if (!a || a.w !== pane.w || a.h !== pane.h || !(v.s > 0)) return false;
    const r = v.s / a.s;
    return r < 1.5 && r > 1 / 1.5 && Math.abs(v.cx - a.cx) * v.s <= 0.3 * pane.w && Math.abs(v.cy - a.cy) * v.s <= 0.3 * pane.h;
  }
  function mfScreenKey(pane) {
    const m = morphLen();
    const key = JSON.stringify([chainSig[nSteps()], S.focus, !!S.homAll, m, S.shapes.filter((s) => s.visible !== false)]);
    const v = pane.view, vkey = [v.cx, v.cy, v.s, pane.w, pane.h].join('|');
    return { key, vkey, m };
  }
  // no-go rectangles on the right plane (px of its overlay): the transport bar and the Pattern legend
  function mfNogo(pane) {
    const out = [];
    try {
      const r = pane.ocanvas.getBoundingClientRect();
      for (const id of ['rightFoot', 'rightLegend']) {
        const el = $(id);
        if (!el || el.hidden || el.offsetParent === null) continue;
        const q = el.getBoundingClientRect();
        if (q.width > 0 && q.height > 0) out.push({ x0: q.left - r.left - 4, x1: q.right - r.left + 4, y0: q.top - r.top - 4, y1: q.bottom - r.top + 4 });
      }
    } catch (e) { /* no layout: no rectangles */ }
    return out;
  }
  function mfStartJob(pane, key, vkey, m) {
    const want = key + '\n' + vkey;
    if (mfCache.job && mfCache.job.want === want) return;
    const job = { want, alive: true };
    if (mfCache.job) mfCache.job.alive = false;
    mfCache.job = job;
    const v = Object.assign({}, pane.view), W = pane.w, Hh = pane.h;
    const P = (w) => [W / 2 + (w.re - v.cx) * v.s, Hh / 2 - (w.im - v.cy) * v.s];
    const win = pane.box();
    const alive = () => job.alive && morph.open;
    // (nothing of it runs in the frame that asked: the first slice, the layout read of the no-go boxes included, is a
    // task of its own)
    job.run = nextMacrotask().then(() => (alive() ? runGenSliced(morphPathsGen(P, { x: 0, y: 0, w: W, h: Hh }, win, W / 96, m, { footPx: 8, headCrowd: 12, headL: MF_SCREEN_HL, nogo: mfNogo(pane) }), alive) : null)).then((sel) => {
      if (mfCache.job === job) mfCache.job = null;
      if (!sel || !job.alive) return;
      mfCache.key = key; mfCache.vkey = vkey; mfCache.v0 = { cx: v.cx, cy: v.cy, s: v.s, w: W, h: Hh }; mfCache.sel = sel; mfCache.rkey = ''; mfCache.rsel = null;
      requestRender('R');
    }).catch((e) => { if (mfCache.job === job) mfCache.job = null; console.error('deformation paths', e); });
  }
  function morphSelScreen(pane) {
    const { key, vkey, m } = mfScreenKey(pane);
    if (mfCache.sel && mfCache.key === key && (mfCache.vkey === vkey || mfViewOk(pane))) {
      // (a pending re-choice for a view that has come back within reach is dropped)
      if (mfCache.timer) { clearTimeout(mfCache.timer); mfCache.timer = 0; mfCache.want = ''; }
      if (mfCache.job) { mfCache.job.alive = false; mfCache.job = null; }
      return mfCache.sel;
    }
    const want = key + '\n' + vkey;
    if (!(mfCache.job && mfCache.job.want === want)) {
      if (mfCache.job) { mfCache.job.alive = false; mfCache.job = null; }
      if (!mfCache.sel && !tweens.length && !drag) { clearTimeout(mfCache.timer); mfCache.timer = 0; mfCache.want = ''; mfStartJob(pane, key, vkey, m); }
      // the 150 ms of stillness count from the last change of what is wanted, not from the last frame: a frame that
      // wants the same (a settle redraw after a scrub or a pan) must not restart the wait (it did: a scrub's settle
      // frames at +90 / +145 ms pushed the paths job, and the scene's settle, from ~150 to ~300 ms)
      else if (!(mfCache.timer && mfCache.want === want)) {
        clearTimeout(mfCache.timer);
        mfCache.want = want;
        mfCache.timer = setTimeout(() => { mfCache.timer = 0; mfCache.want = ''; const k2 = mfScreenKey(pane); if (k2.key === key && k2.vkey === vkey && morphOn() && !(mfCache.sel && mfCache.key === key && mfViewOk(pane))) mfStartJob(pane, key, vkey, m); }, 150);
      }
    }
    if (!mfCache.sel) return null;
    if (mfCache.key === key) return mfCache.sel;
    // the chain or the shapes changed: the kept start points, re-traced under the current homotopy (cheap)
    if (mfCache.rkey !== key) {
      const Fc = new Map();
      const Fat = (T) => { let f = Fc.get(T); if (!f) { f = morphAt(T); Fc.set(T, f); } return f; };
      const P = (w) => pane.w2s(w);
      const N = Math.max(24, 24 * Math.ceil(m));
      const kept = [];
      for (const k of mfCache.sel.kept) { const tr = tracePath(k.sp.z, Fat, m, P, N); if (!tr.broken && tr.s.length > 1) kept.push({ sp: k.sp, s: tr.s, meet: false }); }
      mfCache.rkey = key; mfCache.rsel = Object.assign({}, mfCache.sel, { kept, Tend: m });
    }
    return mfCache.rsel;
  }
  // The merged globe's live paths (merged-views review: the design's "one plane (or one globe)" both carry them): the
  // same selection, chosen off the frame in the deformation's own flat frame at the globe pane's size (defFitView,
  // fixed per chain, focus, path, shapes and pane size, so orbiting never re-chooses), drawn lifted to the sphere
  const mfGlobe = { key: '', vp: null };
  function morphSelGlobe(pane) {
    const k = mfScreenKey(pane).key + `|${pane.w}x${pane.h}`;
    if (mfGlobe.key !== k || !mfGlobe.vp) {
      const vp = Object.create(Pane.prototype);
      vp.view = { cx: V.right.cx, cy: V.right.cy, s: V.right.s }; vp.w = pane.w; vp.h = pane.h; vp.dpr = pane.dpr; vp.ocanvas = null;
      vp.view = defFitView(vp, false);
      mfGlobe.key = k; mfGlobe.vp = vp;
    }
    return morphSelScreen(mfGlobe.vp);
  }
  // the screen's selection, finished now (a test hook): waits for (or starts) the job
  async function morphSelScreenNow(pane, force) {
    if (force) { mfCache.sel = null; mfCache.key = ''; if (mfCache.job) { mfCache.job.alive = false; mfCache.job = null; } }
    const { key, vkey, m } = mfScreenKey(pane);
    if (mfCache.sel && mfCache.key === key && (mfCache.vkey === vkey || mfViewOk(pane))) return mfCache.sel;
    clearTimeout(mfCache.timer); mfCache.timer = 0; mfCache.want = '';
    mfStartJob(pane, key, vkey, m);
    await mfCache.job.run;
    return mfCache.sel;
  }
  // an arrowhead at the end of polyline l: tip on the last point (or `short` px before it), along the chord over ~L px
  function arrowHead(l, L, Wd, short = 0, notch = MF.headNotch) {
    const last = l[l.length - 1];
    let i = l.length - 2;
    while (i > 0 && mDist(last, l[i]) < L * 0.9) i--;
    const q = l[Math.max(0, i)], dx = last[0] - q[0], dy = last[1] - q[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
    const tip = [last[0] - short * ux, last[1] - short * uy];
    const bx = tip[0] - L * ux, by = tip[1] - L * uy, nx = -uy, ny = ux;
    const nt = [tip[0] - L * notch * ux, tip[1] - L * notch * uy];
    return { poly: [tip, [bx + Wd * nx, by + Wd * ny], nt, [bx - Wd * nx, by - Wd * ny]], u: [ux, uy] };
  }
  const trimEndPx = (l, d) => {
    const out = l.slice();
    let rem = d;
    while (out.length > 2) {
      const a = out[out.length - 2], b = out[out.length - 1], sl = mDist(a, b);
      if (sl > rem) { const u = (sl - rem) / sl; out[out.length - 1] = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; return out; }
      rem -= sl; out.pop();
    }
    return out;
  };
  // on screen (morph-figure.md 3): rails (the whole path, faint, with its arrowhead), the travelled part 0 -> T (ink on a
  // halo casing) and the start dots; the moving head at H_T(z) is an ink arrowhead along the path's current direction,
  // so at t = end it covers the rail's arrowhead and the screen shows the figure (arrowheads, no head dots), and a
  // motion frame reads like the rest frame. Thin: 40 arrows must stay readable. sel null: no paths yet (being chosen).
  // P: the projection of the plane to the pane's px (the w-globe's: null on its far side, where a path is not drawn)
  function drawMorphPaths(pane, sel, F, P = (w) => pane.w2s(w)) {
    if (!sel || !sel.kept.length) return;
    const ctx = pane.ctx;
    const T = morph.T, atEnd = T >= (sel.Tend || morphLen()) - 1e-9;
    const HL = MF_SCREEN_HL, HW = 2.3;
    const items = sel.kept.map((k) => {
      let ss = k.s, l = ss.map((q) => P(q.w));
      // (on the globe, the longest run of samples on its front side; a path cut there has no start dot or end head)
      let cut0 = false, cut1 = false;
      if (l.some((p) => !p)) {
        let b0 = 0, b1 = -1, i0 = -1;
        for (let i = 0; i <= l.length; i++) {
          if (i < l.length && l[i]) { if (i0 < 0) i0 = i; continue; }
          if (i0 >= 0 && i - 1 - i0 > b1 - b0) { b0 = i0; b1 = i - 1; }
          i0 = -1;
        }
        if (b1 - b0 < 1) return null;
        cut0 = b0 > 0; cut1 = b1 < l.length - 1;
        ss = ss.slice(b0, b1 + 1); l = l.slice(b0, b1 + 1);
      }
      if (l.length < 2) return null;
      const up = [];
      if (!cut0 || ss[0].T <= T) for (const q of ss) { if (q.T <= T) up.push(P(q.w)); else break; }
      const wT = F(k.sp.z);
      let head = CX.isFin(wT) ? P(wT) : null;
      // (the moving point drawn only on the run it belongs to)
      if (head && (cut0 && T < ss[0].T || cut1 && T > ss[ss.length - 1].T)) head = null;
      if (head && up.length) up.push(head);
      const short = k.meet && atEnd ? 1.5 : 0;
      // the moving head's direction: back along the travelled part, or (near the start) ahead along the rail
      let hd = null;
      if (head) {
        if (lenPx(up) >= HL * 0.9) hd = arrowHead(up, HL, HW, short);
        else {
          let q = null;
          for (const r of l) if (mDist(r, head) >= HL * 0.9 && (r[0] - head[0]) * (l[l.length - 1][0] - head[0]) + (r[1] - head[1]) * (l[l.length - 1][1] - head[1]) > 0) { q = r; break; }
          if (q) {
            const d = mDist(q, head), u = [(q[0] - head[0]) / d, (q[1] - head[1]) / d];
            hd = arrowHead([[head[0] - u[0] * HL, head[1] - u[1] * HL], head], HL, HW, 0);
          }
        }
      }
      return { k, l, up, head, hd, short, cut0, cut1 };
    }).filter(Boolean);
    if (!items.length) return;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    // rails
    ctx.strokeStyle = TH.faint; ctx.fillStyle = TH.faint; ctx.globalAlpha = 0.75; ctx.lineWidth = 1;
    ctx.beginPath();
    for (const it of items) { const b = it.cut1 ? it.l : trimEndPx(it.l, HL * 0.6 + (it.k.meet ? 1.5 : 0)); ctx.moveTo(b[0][0], b[0][1]); for (let i = 1; i < b.length; i++) ctx.lineTo(b[i][0], b[i][1]); }
    ctx.stroke();
    ctx.beginPath();
    for (const it of items) { if (it.cut1) continue; const hd = arrowHead(it.l, HL, HW, it.k.meet ? 1.5 : 0); ctx.moveTo(hd.poly[0][0], hd.poly[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(hd.poly[i][0], hd.poly[i][1]); ctx.closePath(); }
    ctx.fill();
    // travelled parts (stopping inside the moving head's notch)
    const path = () => {
      ctx.beginPath();
      for (const it of items) {
        if (it.up.length < 2) continue;
        const b = it.hd && lenPx(it.up) > HL ? trimEndPx(it.up, HL * (1 - MF.headNotch) + it.short) : it.up;
        ctx.moveTo(b[0][0], b[0][1]); for (let i = 1; i < b.length; i++) ctx.lineTo(b[i][0], b[i][1]);
      }
    };
    ctx.globalAlpha = 0.8; ctx.strokeStyle = TH.halo; ctx.lineWidth = 2.8; path(); ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = TH.ink2; ctx.lineWidth = 1.25; path(); ctx.stroke();
    // start dots
    ctx.beginPath();
    for (const it of items) { if (it.cut0) continue; const p = it.l[0]; ctx.moveTo(p[0] + 2.8, p[1]); ctx.arc(p[0], p[1], 2.8, 0, TAU); }
    ctx.fillStyle = TH.halo; ctx.globalAlpha = 0.9; ctx.fill();
    ctx.beginPath();
    for (const it of items) { if (it.cut0) continue; const p = it.l[0]; ctx.moveTo(p[0] + 1.8, p[1]); ctx.arc(p[0], p[1], 1.8, 0, TAU); }
    ctx.fillStyle = TH.ink2; ctx.globalAlpha = 1; ctx.fill();
    // the moving heads: ink arrowheads on a halo casing (a dot while the path has barely begun to move)
    const headsPath = () => { ctx.beginPath(); for (const it of items) { if (!it.hd) continue; const q = it.hd.poly; ctx.moveTo(q[0][0], q[0][1]); for (let i = 1; i < 4; i++) ctx.lineTo(q[i][0], q[i][1]); ctx.closePath(); } };
    headsPath(); ctx.strokeStyle = TH.halo; ctx.lineWidth = 2; ctx.globalAlpha = 0.9; ctx.stroke();
    headsPath(); ctx.fillStyle = TH.ink2; ctx.globalAlpha = 1; ctx.fill();
    ctx.beginPath();
    for (const it of items) { if (it.hd || !it.head) continue; ctx.moveTo(it.head[0] + 2.2, it.head[1]); ctx.arc(it.head[0], it.head[1], 2.2, 0, TAU); }
    ctx.fill();
    ctx.restore();
  }
  // X's outline over the moving image (so X never disappears under it): 1 px faint, dashed 4/3 when the set is open
  const mfOutlineCache = { skey: '', wkey: '', val: null, timer: 0 };
  function drawMorphOutline(pane, X, Fbase) {
    const ctx = pane.ctx, win = pane.box();
    // (X's boundary curves are sampled once per shapes and view, not per frame of the transport; while the view moves
    // (a pan, a zoom, the auto-fit of a scrub) the last sampling, the same curves in the plane, is re-projected, and
    // the settled view is sampled anew)
    const skey = JSON.stringify(X.vis), wkey = [win.x0, win.x1, win.y0, win.y1].join('|');
    const moving = !!(drag || tweens.length || performance.now() - motionInT < 150);
    if (mfOutlineCache.skey !== skey || !mfOutlineCache.val || (mfOutlineCache.wkey !== wkey && !moving)) { mfOutlineCache.skey = skey; mfOutlineCache.wkey = wkey; mfOutlineCache.val = morphOutline(X, win); }
    else if (mfOutlineCache.wkey !== wkey) { clearTimeout(mfOutlineCache.timer); mfOutlineCache.timer = setTimeout(() => requestRender('R'), 170); }
    const outline = mfOutlineCache.val;
    ctx.save();
    ctx.strokeStyle = TH.faint; ctx.lineWidth = 1; ctx.globalAlpha = 0.9;
    if (X.open) ctx.setLineDash([4, 3]);
    ctx.beginPath();
    for (const o of outline) {
      let pen = false, last = null;
      for (const q of o.l) {
        const w = Fbase ? Fbase(C(q[0], q[1])) : C(q[0], q[1]);
        if (!CX.isFin(w)) { pen = false; continue; }
        const p = pane.w2s(w);
        if (pen && last && mDist(p, last) > 60) pen = false;
        if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
        pen = true; last = p;
      }
    }
    ctx.stroke();
    ctx.restore();
  }
  // X's neutral tint (ink at 7 %) under the image, as a pass of the preimage shader with the identity map (z-plane X)
  function drawXTint(pane, X) {
    if (!GLR.drawPreimage || !X.areas.length) return;
    const ink = GLR.hexRGB(TH.ink);
    const targets = X.areas.map((s) => Object.assign({}, s, { color: ink, edge: ink, alpha: MF.srcFillA, width: 0 }));
    try { GLR.drawPreimage({ map: IDENT, view: pane.view, dpr: pane.dpr, targets, ink: TH.inkRGB, halo: GLR.hexRGB(TH.halo), haloA: 0 }); } catch (e) { console.error('X tint', e); }
  }
  // the figure's vector layers of the deformation panel (morph-figure.md 5), in figure px: X's outline, the paths on
  // their casing, the arrowheads, the start dots, and the labels z and F(z) on one path when a clear place exists
  function morphFigureLayers(sel, P, box, clipId) {
    const f2 = (v) => (Math.round(v * 100) / 100).toString();
    const dP = (l) => 'M' + l.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L');
    let s = `<defs><clipPath id="${clipId}"><rect x="${f2(box.x)}" y="${f2(box.y)}" width="${f2(box.w)}" height="${f2(box.h)}"/></clipPath></defs><g clip-path="url(#${clipId})">`;
    // X's outline over the image
    const ol = sel.pxLines.filter((l) => l.length > 1);
    if (ol.length) s += `<path d="${ol.map(dP).join('')}" fill="none" stroke="${MF.outlineInk}" stroke-width="${MF.srcEdgeW}"${sel.X.open ? ` stroke-dasharray="${MF.dash}"` : ''}/>`;
    let halo = '', lines = '', heads = '', dots = '', rings = '';
    const inkHeads = [];
    for (const k of sel.kept) {
      const short = k.meet ? 1.5 : 0;
      const hd = arrowHead(k.l, MF.headL, MF.headW, short);
      k.head = hd;
      inkHeads.push(hd.poly);
      const body = trimEndPx(k.l, MF.headL * (1 - MF.headNotch) + 0.3 + short);
      k.body = body;
      halo += `<path d="${dP(body)}"/>`;
      lines += `<path d="${dP(body)}"/>`;
      heads += `<path d="M${hd.poly.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}Z"/>`;
      dots += `<circle cx="${f2(k.l[0][0])}" cy="${f2(k.l[0][1])}" r="${MF.dotR}"/>`;
      rings += `<circle cx="${f2(k.l[0][0])}" cy="${f2(k.l[0][1])}" r="${MF.dotRing}"/>`;
    }
    s += `<g fill="none" stroke="#FFFFFF" stroke-opacity="${MF.haloA}" stroke-width="${MF.haloW}" stroke-linecap="round" stroke-linejoin="round">${halo}</g>`;
    s += `<g fill="#FFFFFF" fill-opacity="${MF.haloA}" stroke="#FFFFFF" stroke-opacity="${MF.haloA}" stroke-width="1.3" stroke-linejoin="round">${heads}${rings}</g>`;
    s += `<g fill="none" stroke="${MF.pathColor}" stroke-width="${MF.pathW}" stroke-linecap="round" stroke-linejoin="round" class="mf-paths">${lines}</g>`;
    s += `<g fill="${MF.pathColor}" stroke="none" class="mf-heads">${heads}</g><g fill="${MF.pathColor}" stroke="none">${dots}</g>`;
    s += '</g>';
    // labels (B3.1): z beyond the dot on X's outer side, F(z) beyond the tip, both clear of every ink layer by 2.5 px
    const lz = mj('z', 9 * PT), lf = mj('F(z)', 9 * PT);
    let labelled = null;
    if (lz && lf && lz.w > 0) {
      const PAD = 2.5;
      const g = SegGrid(8);
      for (const k of sel.kept) { g.addLine(k.body, 1); const hp = k.head.poly; g.addLine([...hp, hp[0]], 1); const c = k.l[0], r = MF.dotRing; g.add([c[0] - r, c[1]], [c[0] + r, c[1]], 1); g.add([c[0], c[1] - r], [c[0], c[1] + r], 1); }
      for (const l of sel.pxLines) g.addLine(l, 1);
      for (const l of sel.endLines) g.addLine(l, 1);
      const o = P(C(0, 0));
      g.add([box.x, o[1]], [box.x + box.w, o[1]], 1); g.add([o[0], box.y], [o[0], box.y + box.h], 1);
      const frameIn = { x0: box.x + 5, y0: box.y + 5, x1: box.x + box.w - 5, y1: box.y + box.h - 5 };
      const rectOf = (it, c) => ({ x0: c[0] - it.w / 2 - PAD, x1: c[0] + it.w / 2 + PAD, y0: c[1] - it.h / 2 - PAD, y1: c[1] + it.h / 2 + PAD });
      const grow = (R, e) => ({ x0: R.x0 - e, x1: R.x1 + e, y0: R.y0 - e, y1: R.y1 + e });
      const clear = (R) => !(R.x0 < frameIn.x0 || R.x1 > frameIn.x1 || R.y0 < frameIn.y0 || R.y1 > frameIn.y1) && !g.hitsRect(R);
      const room = (R) => { let best = -1; for (const e of [0, 1.5, 3.5, 5.5]) { if (clear(grow(R, e))) best = e; else break; } return best; };
      const ext = (it, u) => Math.min((it.w / 2 + PAD) / Math.max(Math.abs(u[0]), 1e-9), (it.h / 2 + PAD) / Math.max(Math.abs(u[1]), 1e-9));
      const dirs = Array.from({ length: 24 }, (_, k) => [Math.cos(k * Math.PI / 12), Math.sin(k * Math.PI / 12)]);
      const ang = (u, v) => Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
      const toW = (p) => C(box.wx0 + (p[0] - box.x) / box.w * (box.wx1 - box.wx0), box.wy1 - (p[1] - box.y) / box.h * (box.wy1 - box.wy0));
      const placeZ = (k) => {
        const a = k.l[0];
        const out = dirs.filter((u) => !sel.X.inside(toW([a[0] + 4 * u[0], a[1] + 4 * u[1]])));
        let n;
        if (out.length && out.length < dirs.length) { n = out.reduce((s2, u) => [s2[0] + u[0], s2[1] + u[1]], [0, 0]); const q = Math.hypot(n[0], n[1]) || 1; n = [n[0] / q, n[1] / q]; }
        else { const a2 = k.l[Math.min(k.l.length - 1, 4)], q = mDist(a, a2) || 1; n = [(a[0] - a2[0]) / q, (a[1] - a2[1]) / q]; }
        let best = null;
        for (const u of dirs.filter((u2) => ang(u2, n) <= 75 * Math.PI / 180)) {
          const d = MF.dotRing + 1.2 + ext(lz, u), c = [a[0] + d * u[0], a[1] + d * u[1]];
          if (k.sp.kind !== 'node' && sel.X.areas.length && sel.X.inside(toW(c))) continue;
          // unambiguous: no other start dot as near the label as its own (by a third)
          const dOwn = mDist(c, a);
          if (sel.kept.some((q) => q !== k && mDist(c, q.l[0]) < 1.2 * dOwn)) continue;
          const R = rectOf(lz, c), r = room(R);
          // (among the clear places, the one whose own dot is nearest by the widest margin, then the most room)
          const ratio = Math.min(2, Math.min(...sel.kept.filter((q) => q !== k).map((q) => mDist(c, q.l[0])), 1e9) / dOwn);
          if (r >= 0 && (!best || ratio > best.ratio + 0.05 || (ratio > best.ratio - 0.05 && r > best.r))) best = { c, R, r, ratio };
        }
        return best;
      };
      const placeF = (k, Rz) => {
        const e = k.l[k.l.length - 1], ue = k.head.u;
        let best = null;
        for (const u of dirs.filter((u2) => ang(u2, ue) <= 100 * Math.PI / 180)) {
          const d = 1.5 + ext(lf, u), c = [e[0] + d * u[0], e[1] + d * u[1]];
          const dOwn = mDist(c, e);
          if (sel.kept.some((q) => q !== k && mDist(c, q.l[q.l.length - 1]) < 1.2 * dOwn)) continue;
          const R = rectOf(lf, c);
          if (Rz && !(R.x1 < Rz.x0 || Rz.x1 < R.x0 || R.y1 < Rz.y0 || Rz.y1 < R.y0)) continue;
          const r = room(R);
          if (r >= 0 && (!best || r > best.r)) best = { c, R, r };
        }
        return best;
      };
      let pick = null;
      // a boundary path first; an interior one when no boundary path has room
      for (const nodes of [false, true]) {
        for (const k of sel.kept.filter((q) => q.sp.kind !== 'point' && (q.sp.kind === 'node') === nodes).sort((x, y) => y.len - x.len)) {
          const zp = placeZ(k); if (!zp) continue;
          const fp = placeF(k, zp.R); if (!fp) continue;
          const r = Math.min(zp.r, fp.r);
          if (!pick || r > pick.r) pick = { k, zp, fp, r };
        }
        if (pick) break;
      }
      if (pick) {
        labelled = pick.k;
        const put = (tex, c) => {
          const it = mj(tex, 9 * PT, MF.labelInk), hw = mj(tex, 9 * PT, '#FFFFFF');
          const x = c[0] - it.w / 2, y = c[1] + it.h / 2 + it.va;
          const vb = (hw.markup.match(/viewBox="([^"]+)"/) || [])[1];
          const sc = vb ? it.w / +vb.split(/\s+/)[2] : 0;
          const casing = sc > 0 ? mjAt({ markup: hw.markup.replace(/ stroke="none"/g, ` stroke="#FFFFFF" stroke-width="${(1.5 / sc).toFixed(1)}" stroke-linejoin="round"`), w: it.w, h: it.h, va: it.va }, x, y) : '';
          return `<g opacity="0.9">${casing}</g>${mjAt(it, x, y)}`;
        };
        s += put('z', pick.zp.c) + put('F(z)', pick.fp.c);
      }
    }
    return { svg: s, labelled };
  }
  // the geometry of a kept path in the plane: 'segment', 'arc' or 'other' (the caption's path clause, measured)
  function morphPathShape(z, Tend) {
    const pts = [];
    for (let i = 0; i <= 40; i++) pts.push(morphAt(Tend * i / 40)(z));
    if (!pts.every((p) => CX.isFin(p))) return 'other';
    const a = pts[0], b = pts[40], L = CX.abs(CX.sub(b, a));
    if (!(L > 0)) return 'other';
    const u = CX.scale(CX.sub(b, a), 1 / L);
    const off = (p) => { const d = CX.sub(p, a); return Math.abs(d.re * u.im - d.im * u.re); };
    if (pts.every((p) => off(p) < 1e-7 * Math.max(1, L))) return 'segment';
    const m = pts[20];
    const ax = a.re, ay = a.im, bx = m.re, by = m.im, cx = b.re, cy = b.im;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-14) return 'other';
    const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
    const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
    const R = Math.hypot(ax - ux, ay - uy);
    return pts.every((p) => Math.abs(Math.hypot(p.re - ux, p.im - uy) - R) < 1e-7 * Math.max(1, R)) ? 'arc' : 'other';
  }
  // inline TeX ($...$) in a phrase -> caption segments
  const texSegs = (str) => String(str).split('$').map((x, i) => (i % 2 ? { m: x } : { t: x })).filter((x) => (x.m != null ? x.m.length : x.t.length));
  // inline maths in a deformation caption (morph-figure.md 5: no inline \frac): \tfrac for a quotient of numbers (and
  // pi), a slash with brackets as needed for expressions: \frac{z-i}{z+i} -> (z-i)/(z+i)
  function inlineFrac(tex) {
    const group = (str, i) => { // the brace group at i: [content, index after it]
      if (str[i] !== '{') { const m = /^\\[A-Za-z]+|^./.exec(str.slice(i)); return [m ? m[0] : '', i + (m ? m[0].length : 1)]; }
      let d = 0, j = i;
      for (; j < str.length; j++) { if (str[j] === '\\') { j++; continue; } if (str[j] === '{') d++; else if (str[j] === '}' && --d === 0) break; }
      return [str.slice(i + 1, j), j + 1];
    };
    const simple = (x) => /^(?:[A-Za-z0-9.]|\\pi|\\infty)+$/.test(x) || /^[A-Za-z0-9.]*(?:\^\{?[A-Za-z0-9.]+\}?|_\{?[A-Za-z0-9.]+\}?)$/.test(x);
    const numeric = (x) => /^(?:[0-9.]+|\\pi|[0-9.]+\\pi)$/.test(x);
    let out = '', i = 0;
    while (i < tex.length) {
      const k = tex.indexOf('\\frac', i);
      if (k < 0 || /[A-Za-z]/.test(tex[k + 5] || '')) { if (k < 0) { out += tex.slice(i); break; } out += tex.slice(i, k + 5); i = k + 5; continue; }
      out += tex.slice(i, k);
      let j = k + 5;
      while (tex[j] === ' ') j++;
      const [A0, j1] = group(tex, j);
      let j2 = j1; while (tex[j2] === ' ') j2++;
      const [B0, j3] = group(tex, j2);
      const A = inlineFrac(A0), B = inlineFrac(B0);
      if (numeric(A) && numeric(B)) out += `\\tfrac{${A}}{${B}}`;
      else out += `${simple(A) ? A : `(${A})`}/${simple(B) ? B : `(${B})`}`;
      i = j3;
    }
    return out;
  }
  // the homotopy phrase of the open deformation (morph-figure.md 5, table). Tend < m ('Up to t'): the phrase states the
  // whole homotopy, and the caption says once, at sentence level, which part is shown (stop)
  function morphHomSegs(Tend) {
    const { steps } = morphRange();
    const m = steps.length, all = allAtOnce();
    const upTo = Tend < (all ? 1 : m) - 1e-9;
    const stop = upTo ? [{ t: ', shown for ' }, { m: `0\\le t\\le ${CX.fmtNum(Tend, 2)}` }] : [];
    const range = (t1) => [{ t: ', ' }, { m: `0\\le t\\le ${t1}` }];
    // (several steps: f_k, p_k, ... name step k's map and centre; all at once, every H^{(k)}_t acts on u, since its input
    // there is H^{(k-1)}_t(z), not w_{k-1})
    const phrase = (k, names) => {
      const b = built[k - 1], v = all && m > 1 ? 'u' : k === 1 ? 'z' : `w_{${k - 1}}`;
      const o = names ? { f: `f_{${k}}`, p: `p_{${k}}`, c: `c_{${k}}`, a: `a_{${k}}` } : undefined;
      const r = b && b.homTex ? b.homTex(v, o) : null;
      if (r) return r;
      return { tex: `the straight-line homotopy $H_t(${v})=(1-t)${v}+t\\,${m === 1 && S.focus === 0 ? 'F' : `f_{${k}}`}(${v})$`, segment: true };
    };
    if (m === 1) {
      const r = phrase(steps[0]);
      // (a phrase that states its own range of t does not get a second one)
      const own = /\\le\s*1|\\le t|t\\le|t</.test(r.tex);
      return { segs: [...texSegs(r.tex), ...(own ? [] : range(1))], stop, mobius: !!r.mobius, segment: !!r.segment };
    }
    // several steps all at once: H_t = H^{(n)}_t o ... o H^{(1)}_t, 0 <= t <= 1, each step's own homotopy at the same t
    if (all) {
      const own = (k, tex) => texSegs(tex).map((g) => (g.m == null ? g : { m: g.m.replace(/H_\{?([t0-9])\}?/g, (_, x) => `{H^{(${k})}_{${x}}}`) }));
      const comp = steps.map((k) => `H^{(${k})}_t`).reverse().join('\\circ ');
      const segs = [{ t: 'the homotopy ' }, { m: `H_t=${comp}` }, { t: ', ' }, { m: '0\\le t\\le 1' }, { t: ', that deforms every step at once: ' }];
      steps.forEach((k, i) => {
        if (i) segs.push({ t: '; ' });
        segs.push({ t: 'for ' }, { m: `f_{${k}}` }, { t: ', ' }, ...own(k, phrase(k, true).tex));
      });
      return { segs, stop, mobius: false };
    }
    // several steps: H_t runs the steps in turn, 0 <= t <= m; step k's own homotopy is H^{(k)}_s in its own time s,
    // H_t = H^{(k)}_{t-k+1} on k-1 <= t <= k
    const local = (k, tex) => texSegs(tex).map((g) => (g.m == null ? g : {
      m: g.m.replace(/(?<![\\A-Za-z])t/g, 's').replace(/H_\{?([s0-9])\}?/g, (_, x) => `{H^{(${k})}_{${x}}}`),
    }));
    const segs = [{ t: 'the homotopy ' }, { m: `H_t` }, { t: ', ' }, { m: `0\\le t\\le ${m}` }, { t: ', that runs the steps in turn (' }, { m: 'H_t=H^{(k)}_{t-k+1}' }, { t: ' on ' }, { m: 'k-1\\le t\\le k' }, { t: '): ' }];
    steps.forEach((k, i) => {
      if (i) segs.push({ t: '; ' });
      segs.push({ t: 'for ' }, { m: `f_{${k}}` }, { t: ', ' }, ...local(k, phrase(k, true).tex));
    });
    return { segs, stop, mobius: false };
  }
  // the deformation caption (morph-figure.md 5): generated from the shapes, the chain, the kept set and the measured
  // geometry of the paths; true of what is drawn. opt.both: the (b) part of the Both figure, after "The deformation
  // H_t, 0 <= t <= T:", which names the set of (a) instead of repeating it
  function morphCaption(sel, Tend, opt = {}) {
    const vis = S.shapes.filter((s) => s.visible !== false);
    let pi = 0;
    const lineShapes = vis.filter((s) => kindType(s) !== 'point');
    const shapeList = joinList(lineShapes.map((s) => shapePhrase(s, 0)));
    const pts = vis.filter((s) => kindType(s) === 'point').map((s) => shapePhrase(s, pi++));
    const lv = S.focus > 1 ? `w_{${S.focus - 1}}` : 'z', Fname = S.focus === 0 ? 'F' : `f_{${S.focus}}`;
    const Ftex = S.focus === 0 ? compositeTexShort() : (built[S.focus - 1] && !built[S.focus - 1].error ? built[S.focus - 1].tex({ s: lv, p: 4 }).s : null);
    const mapM = Ftex ? `${Fname}(${lv})=${Ftex}` : Fname;
    const patWord = { checker: 'checkerboard', polar: 'checkerboard', sphere: 'checkerboard', tiles: 'tiles', grid: 'lines', polargrid: 'lines' }[S.pattern] || 'coloured';
    const out = [];
    const hom = morphHomSegs(Tend);
    const nSets = lineShapes.length || pts.length;
    const setSegs = shapeList.length ? shapeList : pts.length ? joinList(pts) : [{ t: 'the plane' }];
    // how X is drawn: its outline over the image (its 7 % tint lies under the image and can be covered by it); points
    // are the start dots
    const dashed = vis.some((s) => kindType(s) === 'area' && Region.isOpen(s));
    const mark = opt.both ? (lineShapes.length ? (dashed ? `, with ${nSets > 1 ? 'dashed outlines' : 'a dashed outline'},` : ', outlined,') : pts.length ? ' (dots)' : '')
      : (lineShapes.length ? (dashed ? ' (dashed outline)' : ' (outlined)') : pts.length ? ' (dots)' : '') + (nSets > 1 ? ',' : '');
    const head = opt.both ? [{ t: nSets > 1 ? 'the sets of (a)' : 'the set of (a)' }] : S.focus > 1 ? [{ t: 'The image of ' }, ...setSegs, { t: ` after ${S.focus - 1 === 1 ? 'the first step' : `${S.focus - 1} steps`}` }] : cap1(setSegs);
    const its = nSets > 1 ? 'their image' : 'its image';
    const endName = Tend < morphLen() - 1e-9 ? [{ t: `${its} under ` }, { m: `H_{${CX.fmtNum(Tend, 2)}}` }] : [{ t: `${its} under ` }, { m: mapM }];
    out.push(...head, { t: `${mark} and ` }, ...endName, { t: ` (${patWord}), joined by ` }, ...hom.segs, ...hom.stop, { t: '.' });
    const nb = sel.kept.filter((k) => k.sp.kind === 'corner' || k.sp.kind === 'edge').length;
    const ni = sel.kept.filter((k) => k.sp.kind === 'node').length;
    const np = sel.kept.filter((k) => k.sp.kind === 'point').length;
    const num = (n, one, many) => `${n} ${n === 1 ? one : many}`;
    const parts = [];
    if (nb) parts.push(num(nb, 'boundary point', 'boundary points'));
    if (ni) parts.push(num(ni, 'interior point', 'interior points'));
    if (np) parts.push(num(np, 'marked point', 'marked points'));
    if (sel.kept.length) {
      let clause = '';
      if (hom.mobius || hom.segment) {
        const kinds = new Set(sel.kept.map((k) => morphPathShape(k.sp.z, Tend)));
        if (!kinds.has('other')) clause = kinds.size === 2 ? '; each is an arc of a circle or a segment' : kinds.has('arc') ? '; each is an arc of a circle' : '; each is a segment';
      }
      out.push({ t: ' Arrows are the paths ' }, { m: 't\\mapsto H_t(z)' }, { t: ` of ${parts.length > 1 ? parts.slice(0, -1).join(', ') + ' and ' + parts[parts.length - 1] : parts[0]}, from ` }, { m: 'z' }, { t: ' (dot) to ' }, { m: Tend < morphLen() - 1e-9 ? `H_{${CX.fmtNum(Tend, 2)}}(z)` : 'F(z)' }, { t: `${clause}.` });
      if (sel.kept.some((k) => k.meet)) out.push({ t: ' Arrows that meet show points with the same image.' });
    }
    out.push(...patternSegs(Fname));
    if (vis.some((s) => kindType(s) === 'area' && Region.isOpen(s))) out.push({ t: ' Dashed boundaries do not belong to the sets.' });
    return out.map((g) => (g.m != null ? { m: inlineFrac(g.m) } : g));
  }
  // CPU homotopy at any time T (for trails)
  function morphAt(T) {
    const saved = morph.T;
    morph.T = T;
    const ms = morphState(false);
    morph.T = saved;
    return ms.F;
  }
  // Image with the deformation transport open (morph-figure.md 3): X's neutral tint, the shapes under H_t, X's outline
  // again over them, the paths t -> H_t(z) (rails, travelled parts, heads); ghost outlines of the start (only for an
  // unbounded X, which the tint would grey over half the pane) and of the end (dotted, while t < end)
  function renderMorph(pane) {
    pane.setView(V.right);
    paper(pane);
    const ms = morphState(false);
    const X = morphX();
    const m = morphLen();
    const base = S.focus > 0 ? S.focus - 1 : 0, end = S.focus > 0 ? S.focus : nSteps();
    if (GLR.ok) {
      // the tint is X itself (z-plane): at a focused step the start is the image of X at stage base, outlined instead
      const tint = base === 0;
      const ghosts = () => {
        if (tint) drawXTint(pane, X);
        if (figMode) return;
        for (const s of S.shapes) {
          if (s.visible === false || kindType(s) === 'point') continue;
          const r = shapeGPU(s);
          if (!r.lineRes) continue;
          const list = [];
          if (!tint || !X.bounded) list.push([base, [4, 3]]);
          if (morph.T < m) list.push([end, [1, 2]]);
          for (const [k, dash] of list) {
            const mm = stageMap(k), mk = mapKeyOf(mm);
            GLR.drawLines(r.lineRes, { map: mm, view: pane.view, dpr: pane.dpr, M: 8, width: 1 * pane.dpr, color: GLR.hexRGB(TH.faint), alpha: 0.8, cacheKey: `${r.lineKey}|${mk}`, dash, arc: arcOf(r, stageF(k), mk) });
          }
        }
      };
      // (the colour key of X's portrait, when its Key switch is on, under the ghosts)
      const key = wKeyOn() && !figMode ? keyUnder(pane) : null;
      drawScene(pane, ms.map, morph.playing ? null : 'R', { noUnit: figMode, cache: !morph.playing, under: key ? () => { key(); ghosts(); } : ghosts, noGrid: !!key, arcF: ms.F, arcKey: `${ms.key}|${chainSig[nSteps()]}` });
    } else noGL(pane);
    // the morph figure draws the outline, the paths and their labels as vectors (buildFigure); a one-panel figure of
    // the merged plane (a d/dz step in the chain) draws them as on screen, with no screen-cached paths
    if (figMode && figVec) return;
    drawMorphOutline(pane, X, base > 0 ? stageF(base) : null);
    const paths = !figMode && S.morphPaths !== false && !morphHasDeriv();
    if (paths) {
      try { drawMorphPaths(pane, morphSelScreen(pane), ms.F); } catch (e) { console.error('deformation paths', e); }
    } else {
      // (Paths off: the point trails from t = 0 to now, as before)
      const ctx = pane.ctx;
      const steps = Math.max(2, Math.ceil(morph.T * 40));
      const Fs = [];
      for (let i = 0; i <= steps; i++) Fs.push(morphAt(morph.T * i / steps));
      for (const s of S.shapes) {
        if (s.visible === false || kindType(s) !== 'point') continue;
        const z = C(s.p[0], s.p[1]);
        ctx.strokeStyle = shapeInk(s).edge; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.25;
        ctx.beginPath();
        let pen = false, last = null, prev = null;
        for (const F of Fs) {
          const w = F(z);
          if (!CX.isFin(w)) { pen = false; continue; }
          const p = pane.w2s(w);
          if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]);
          pen = true; prev = last; last = p;
        }
        ctx.stroke();
        if (prev && last && Math.hypot(last[0] - prev[0], last[1] - prev[1]) > 0.1) {
          const a = Math.atan2(last[1] - prev[1], last[0] - prev[0]);
          ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(last[0] - 4 * Math.cos(a - 0.5), last[1] - 4 * Math.sin(a - 0.5)); ctx.moveTo(last[0], last[1]); ctx.lineTo(last[0] - 4 * Math.cos(a + 0.5), last[1] - 4 * Math.sin(a + 0.5)); ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    drawPoints(pane, ms.F, { primes: morphPrimes() });
    drawRulers(pane, 'R');
  }
  // the transport's readout and scrubber follow the time in every view
  function syncTransport() {
    const lab = $('morphLabel');
    if (lab) lab.textContent = `t = ${morph.T.toFixed(2)} / ${morphLen()}`;
    const sl = $('morphRange');
    if (sl && document.activeElement !== sl && +sl.value !== morph.T) { sl.value = morph.T; paintFader(sl); }
  }
  // the colour key of X's phase portrait painted under the Y plane (the Key switch in X's legend chip): the
  // portrait of the identity in the current style, so a colour in X reads off as a value in Y
  // (one predicate for the switch and the paint: on the landscape and under Cauchy the switch hides, and the key with it)
  // (merged views: the switch sits in the Phase view's legend; the key shows under Y's plane in X → Y)
  const wKeyAvail = () => S.dc !== 'cauchy';
  const wKeyOn = () => !!S.wKey && wKeyAvail() && S.view.main === 'xy' && rImage();
  function keyUnder(pane) {
    return () => GLR.drawColorPlot({ map: IDENT, view: pane.view, dpr: pane.dpr, style: S.dc, sectors: S.sectors || 12, grid: dcGridStep(pane), plane: TH.planeRGB, ink: TH.inkRGB, dark: TH.dark, cauchy: null });
  }
  function renderRight() {
    const pane = paneR;
    layoutFoot(); // re-flows the options strip only when the plot width changed
    if (rGlobe()) renderSphere(pane);
    else if (morphOn()) renderMorph(pane);
    else {
      pane.setView(V.right);
      paper(pane);
      const k = rightStage();
      const F = trans.k ? transState().F : stageF(k);
      const key = wKeyOn() && GLR.ok ? { noGrid: true, under: keyUnder(pane) } : null;
      if (GLR.ok) drawScene(pane, trans.k ? transState().map : stageMap(k), trans.k ? null : 'R', Object.assign({ cache: !trans.k }, key)); else noGL(pane);
      // a transition draws its homotopy forward; the stage it ends on is drawn inverse: its program compiles meanwhile
      // (after the chain's forward programs), so the last frame is exact instead of a forward stand-in (P2 review)
      if (trans.k && GLR.ok) requestInverseFor(stageMap(k));
      // the w-plane targets: fills (a pass of the preimage shader with the identity map), outlines, points
      if (hasTargets()) {
        const areas = preimageTargets(true);
        if (!drawPullback(pane, IDENT, areas)) fillTargets2D(pane, areas);
        strokeTargets(pane);
      }
      // (the image of X's view rectangle: only X Plane has one; the globe shows all of X, the landscape a trimmed box)
      if (S.fov !== false && !trans.k && lFlat()) drawFov(pane, focusF());
      if (!trans.k) drawCutBanks(pane, k);
      drawChevrons(pane, F);
      if (S.focus > 0) drawCuts(pane, k, false, true);
      drawPoints(pane, F, { primes: k });
      if (hasTargets()) drawPoints(pane, (z) => z, { list: S.targets, target: true });
      drawRulers(pane, 'R');
    }
    if (morph.open) syncTransport();
    const er = $('emptyRight');
    if (er) {
      const show = !S.steps.length && rImage();
      er.hidden = !show;
      if (show && !er.firstChild) er.append(h('span', null, 'Add a function to map the region'), h('button', { class: 'btn primary small', onclick: (e) => openPalette(e.currentTarget, S.steps.length, { fnOnly: true }) }, 'Add function'));
    }
    updateCalcChip();
  }

  // ---------------- preimages: targets in the w-plane, pulled back by F ----------------
  // Targets are shapes like the domain's, kept in S.targets and drawn and edited in the right plane in Image mode.
  // In every view the left plane shows where F lands in them (GLR.drawPreimage); for a point target p, the solutions
  // of F(z) = p in view are found on the CPU (Calc.zerosPoles: cells, argument principle, Newton) and marked z₁, z₂, …
  const isTarget = (s) => !!s && Array.isArray(S.targets) && S.targets.includes(s);
  const hasTargets = () => !!(S.targets && S.targets.some((s) => s.visible !== false));
  // targets are drawn and edited in the right plane of Image mode (not while it shows a deformation)
  // (and on the w-globe, P3b: panels.md 9)
  const targetsEditable = () => (rImage() || rGlobe()) && !morphOn() && solo() !== 'L';
  const findShape = (id) => S.shapes.find((x) => x.id === id) || (S.targets || []).find((x) => x.id === id) || null;
  function targetLabel(s, i) { return s.label || (i < 6 ? 'pqrstu'[i] : 'p' + sub(i + 1)); }
  const paneBox = (pane, v) => ({ x0: v.cx - pane.w / 2 / v.s, x1: v.cx + pane.w / 2 / v.s, y0: v.cy - pane.h / 2 / v.s, y1: v.cy + pane.h / 2 / v.s });
  // the window target curves are clipped and hit-tested in: the right view (lines reach far beyond it)
  function targetWin() {
    const b = paneR && paneR.w > 0 ? paneBox(paneR, V.right) : { x0: -4, x1: 4, y0: -4, y1: 4 };
    return goodWin(b) ? b : { x0: -4, x1: 4, y0: -4, y1: 4 };
  }
  const IDENT = { mode: 0, a: 0, b: 0 };
  // target shapes as GLR.drawPreimage takes them (polygon and freehand vertices at most 256 in all)
  function preimageTargets(areasOnly) {
    const list = (S.targets || []).filter((s) => s.visible !== false && kindType(s) !== 'point' && (!areasOnly || kindType(s) === 'area'));
    let nv = 0;
    for (const s of list) if (s.pts) nv += s.pts.length;
    const keep = nv > 256 ? 256 / nv : 1;
    return list.map((s) => {
      const t = Object.assign({}, s);
      if (s.pts && keep < 1) {
        const n = Math.max(s.kind === 'polygon' ? 3 : 2, Math.floor(s.pts.length * keep));
        t.pts = Array.from({ length: n }, (_, i) => s.pts[Math.round(i * (s.pts.length - 1) / Math.max(1, n - 1))]);
      }
      const ink = shapeInk(s), area = kindType(s) === 'area';
      let a = area ? 0.42 : 1;
      if (hoverShape && hoverShape !== s.id) a *= 0.5;
      t.color = GLR.hexRGB(area ? ink.c0 : ink.edge);
      t.edge = GLR.hexRGB(ink.edge);
      t.alpha = a;
      t.width = (s.id === selected ? 2.75 : 2) * (paneL ? paneL.dpr : 1);
      return t;
    });
  }
  // a second GL pass over the plane: where the map lands in each target
  function drawPullback(pane, map, targets) {
    if (!GLR.ok || typeof GLR.drawPreimage !== 'function' || !targets.length) return false;
    try {
      GLR.begin(pane.pw, pane.ph);
      GLR.drawPreimage({ map, view: pane.view, dpr: pane.dpr, targets, ink: TH.inkRGB, halo: GLR.hexRGB(TH.halo) });
      GLR.blit(pane.ctx);
    } catch (e) { console.error('drawPreimage', e); }
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    return true;
  }
  // target outlines in the w-plane (formula targets have no closed form: their fill is their outline)
  function strokeTargets(pane) {
    const ctx = pane.ctx, win = targetWin();
    for (const s of S.targets) {
      if (s.visible === false || kindType(s) === 'point') continue;
      let curves = [];
      try { curves = Region.curvesOf(s, win); } catch (e) { curves = []; }
      if (!curves.length) continue;
      const ink = shapeInk(s), area = kindType(s) === 'area';
      ctx.save();
      ctx.beginPath();
      for (const c of curves) {
        const p = Region.sampleCurve(c, win);
        for (let i = 0; i + 1 < p.length; i += 2) { const [x, y] = pane.w2sxy(p[i], p[i + 1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        if (c.closed) ctx.closePath();
      }
      let w = area ? 1.5 : 2;
      if (s.id === selected) w += 0.75;
      if (s.id === hoverShape) w += 0.5;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.globalAlpha = TH.haloA; ctx.strokeStyle = TH.halo; ctx.lineWidth = w + 2; ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = ink.edge; ctx.lineWidth = w;
      if (area && Region.isOpen(s)) ctx.setLineDash([5, 3.5]);
      ctx.stroke();
      ctx.restore();
    }
  }
  // Calc.zerosPoles bounded in time (about ms on the main thread). Its work budget counts calls of F, and one call
  // can cost hundreds of evaluations (nested d/dz steps use the circle formula), so the cost of a call is measured
  // on a few points of the box first: the budget and the starting grid are scaled to fit ms, and a hard deadline
  // (3 ms + 40) aborts the search. A search cut short finds fewer solutions, never false ones: the result then has
  // .incomplete (with nothing found when it was aborted, .stopped too), so callers say "at least" or "stopped early".
  const ZP_STOP = { stop: true };
  function zerosPolesTimed(F, box, opts, ms) {
    const b = box, t0 = performance.now();
    let n = 0;
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) { F(C(b.x0 + (b.x1 - b.x0) * (i + 0.37) / 3, b.y0 + (b.y1 - b.y0) * (j + 0.41) / 3)); n++; }
    // ms per call, plus the solver's own bookkeeping (about 0.1 µs a call)
    const per = Math.max(1e-4, (performance.now() - t0) / n) + 1e-4;
    const budget = Math.max(300, Math.min(600000, Math.floor(ms / per)));
    // the first pass costs about 3·grid² calls whatever the budget: a coarser starting grid for a costly map
    const grid = Math.max(8, Math.min(32, Math.floor(Math.sqrt(0.4 * ms / (3 * per)))));
    const hard = t0 + 3 * ms + 40;
    let k = 0;
    const G = (z) => { if ((++k & 7) === 0 && performance.now() > hard) throw ZP_STOP; return F(z); };
    let out;
    try { out = Calc.zerosPoles(G, box, Object.assign({}, opts, { budget, grid, deadline: t0 + ms })) || []; } catch (e) {
      if (e !== ZP_STOP) throw e;
      out = []; out.incomplete = true; out.stopped = true;
    }
    return out;
  }
  // ---- the preimages of the point under the pointer in the right plane (Image, the regions sphere) ----
  // Followed in real time: F is smooth, so as the pointer moves from w₀ to w₁ every known preimage z is continued
  // along the segment by Newton's method on F(z) = w (predictor: the last z; step halving when Newton fails or jumps
  // too far, so a path does not hop to another preimage). A short, time-bounded search of the whole left view runs
  // at most every 150 ms while the pointer moves (preimages that enter the view, or appear from a pole), and a
  // longer one once the pointer rests; their results are merged with the tracked ones.
  const hov = { w: null, wl: null, base: '', list: null, all: null, partial: false, lastFull: 0, timer: 0 };
  const hoverBase = () => {
    const b = paneL ? paneBox(paneL, leftView()) : null;
    return b ? JSON.stringify([chainSig[nSteps()], S.focus, b.x0, b.x1, b.y0, b.y1]) : '';
  };
  // Newton on F(z) = w from z (multiplicity m, central-difference derivative); steps capped at lim; null unless it
  // converges to a residual within tol
  function newtonTo(F, w, z, m, tol, lim) {
    for (let it = 0; it < 40; it++) {
      const f = F(z);
      if (!CX.isFin(f)) return null;
      const r = CX.sub(f, w);
      if (CX.abs(r) <= tol) return z;
      const hh = 1e-7 * (1 + CX.abs(z));
      const d = CX.scale(CX.sub(F(C(z.re + hh, z.im)), F(C(z.re - hh, z.im))), 1 / (2 * hh));
      if (!CX.isFin(d) || (d.re === 0 && d.im === 0)) return null;
      let st = CX.scale(CX.div(r, d), m);
      const L = CX.abs(st);
      if (!(L < Infinity)) return null;
      if (L > lim) st = CX.scale(st, lim / L);
      z = CX.sub(z, st);
      if (L <= 1e-15 * (1 + CX.abs(z))) { const f2 = F(z); return CX.isFin(f2) && CX.abs(CX.sub(f2, w)) <= 1e3 * tol ? z : null; }
    }
    return null;
  }
  const hovTol = (w) => 1e-11 * (1 + CX.abs(w));
  // continue the preimage z (of w0) to a preimage of w1 along the segment
  function trackRoot(F, z, m, w0, w1, size, deadline) {
    let s = 0, ds = 1, zc = z;
    for (let guard = 0; s < 1 && guard < 60; guard++) {
      if (performance.now() > deadline) return null;
      const s1 = Math.min(1, s + ds);
      const wt = C(w0.re + s1 * (w1.re - w0.re), w0.im + s1 * (w1.im - w0.im));
      const zn = newtonTo(F, wt, zc, m, hovTol(wt), 0.1 * size);
      if (zn && CX.abs(CX.sub(zn, zc)) < 0.15 * size) { zc = zn; s = s1; ds = Math.min(1 - s, 2 * ds) || ds; }
      else if ((ds /= 2) < 1 / 512) return null;
    }
    return s >= 1 ? zc : null;
  }
  // one root per point: roots that met (a critical value) keep the largest multiplicity
  function dedupeRoots(list, size) {
    const out = [];
    for (const r of list) {
      const o = out.find((q) => CX.abs(CX.sub(q.z, r.z)) < 1e-7 * size);
      if (o) o.mult = Math.max(o.mult || 1, r.mult || 1); else out.push({ z: r.z, mult: r.mult || 1 });
    }
    return out;
  }
  const inBoxZ = (z, b, pad) => { const px = pad * (b.x1 - b.x0), py = pad * (b.y1 - b.y0); return z.re >= b.x0 - px && z.re <= b.x1 + px && z.im >= b.y0 - py && z.im <= b.y1 + py; };
  // a full search of the left view at w (bounded to about ms), merged into the tracked roots
  function hoverSearch(w, ms) {
    const box = paneBox(paneL, leftView()), size = Math.max(box.x1 - box.x0, box.y1 - box.y0);
    let sols = [];
    try { sols = zerosPolesTimed(focusF(), box, { target: { re: w.re, im: w.im }, max: 24 }, ms); } catch (e) { sols = []; sols.incomplete = true; }
    const found = sols.filter((r) => r && r.kind !== 'pole' && r.z && CX.isFin(r.z)).map((r) => ({ z: r.z, mult: r.mult || 1 }));
    // a complete search replaces the in-view roots; the tracked ones outside the view are kept (they may come back)
    const kept = (hov.all || []).filter((r) => !inBoxZ(r.z, box, 0) || !!(sols.truncated || sols.incomplete));
    hov.all = dedupeRoots([...found, ...kept], size);
    hov.partial = !!(sols.truncated || sols.incomplete);
    hov.lastFull = performance.now();
    hov.wl = w;
  }
  function publishHover() {
    const box = paneBox(paneL, leftView());
    hov.list = (hov.all || []).filter((r) => inBoxZ(r.z, box, 0.02));
    hov.list.partial = hov.partial;
    hoverReadout();
    requestRender('OL');
  }
  function setHoverW(w) {
    clearTimeout(hov.timer);
    hov.w = w && CX.isFin(w) ? w : null;
    if (!hov.w || !hasCalc('zerosPoles') || !paneL || !(paneL.w > 0)) { hov.list = null; hov.all = null; hov.wl = null; hoverReadout(); return; }
    const want = hov.w, base = hoverBase();
    if (base !== hov.base || !hov.all || !hov.wl) {
      // a new map or view: search now (short), then refine when the pointer rests
      hov.base = base;
      hoverSearch(want, 30);
    } else if (hov.wl.re !== want.re || hov.wl.im !== want.im) {
      // follow every known preimage from the last w to this one (about 8 ms at most per move)
      const F = focusF(), box = paneBox(paneL, leftView()), size = Math.max(box.x1 - box.x0, box.y1 - box.y0);
      const deadline = performance.now() + 8, w0 = hov.wl, next = [];
      let lost = false;
      for (const r of hov.all) {
        if (!inBoxZ(r.z, box, 1)) continue; // far outside the view: let it go
        const seeds = r.mult > 1
          // a multiple root splits as w leaves the critical value: seeds around it
          ? Array.from({ length: r.mult }, (_, j) => ({ z: C(r.z.re + 0.01 * size * Math.cos(TAU * (j + 0.25) / r.mult), r.z.im + 0.01 * size * Math.sin(TAU * (j + 0.25) / r.mult)), m: 1 }))
          : [{ z: r.z, m: 1 }];
        for (const sd of seeds) {
          const z = trackRoot(F, sd.z, sd.m, w0, want, size, deadline);
          if (z) next.push({ z, mult: 1 }); else lost = true;
        }
      }
      hov.all = dedupeRoots(next, size);
      hov.wl = want;
      // a short discovery search now and then while moving (and when a path was lost)
      if (performance.now() - hov.lastFull > (lost ? 60 : 150)) hoverSearch(want, 12);
    }
    publishHover();
    // when the pointer rests: a longer search of the whole view (a longer one still if it was cut short)
    hov.timer = setTimeout(function rest(ms = 70) {
      if (hov.w !== want || (drag && drag.mode !== 'probe')) return;
      hoverSearch(want, ms);
      publishHover();
      if (hov.partial && ms < 250) hov.timer = setTimeout(() => rest(250), 300);
    }, 60);
  }
  // the left readout while the right plane is hovered: how many preimages w has in the left view
  function hoverReadout() {
    const lr = $('leftReadout');
    if (!lr || lr.classList.contains('copied')) return;
    if (!hov.w) { if (!probe) lr.innerHTML = idleLeft(); return; }
    // words in Archivo, the value in B612 Mono
    const head = (t) => `<span class="rp"><span class="rk"><span class="rw">${t}</span> <i>w</i></span> <span class="rv">${fmtCxHtml(hov.w)}</span></span>`;
    if (!hasCalc('zerosPoles')) { lr.innerHTML = head('at'); return; }
    if (!hov.list) { lr.innerHTML = head('finding the preimages of'); return; }
    const n = hov.list.reduce((a, r) => a + (r.mult || 1), 0);
    const where = !lFlat() ? ' (flat view)' : '';
    // a search cut short (a costly map): a lower bound, or no count at all when it found nothing
    let html = head(hov.list.partial && !n ? `preimage search stopped early${where} for` : `${hov.list.partial ? 'at least ' : ''}${n} preimage${n === 1 ? '' : 's'}${where} of`);
    if (hov.list.length === 1) html += rk((leftStage() === 0 ? '<i>z</i>' : `<i>w</i>${sub(leftStage())}`) + (hov.list[0].mult > 1 ? ` ×${hov.list[0].mult}` : ''), cxShort(hov.list[0].z, rootScale()));
    lr.innerHTML = html;
    copyValue.L = hov.list.map((r) => CX.fmt(r.z, 6).replace(/\s/g, '')).join(', ');
  }
  // markers at the hovered point's preimages (proj: the globe of the left sphere view, else the flat plane)
  function drawHoverPreimages(pane, proj) {
    const ctx = pane.octx;
    ctx.save();
    for (const r of hov.list) {
      const q = proj ? proj(r.z) : pane.w2s(r.z);
      if (!q) continue;
      const [x, y] = q;
      if (x < -10 || y < -10 || x > pane.w + 10 || y > pane.h + 10) continue;
      ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = TH.accent; ctx.beginPath(); ctx.arc(x, y, 6, 0, TAU); ctx.stroke();
      ctx.fillStyle = TH.accent; ctx.beginPath(); ctx.arc(x, y, 1.75, 0, TAU); ctx.fill();
      if (r.mult > 1) { ctx.font = `10px ${TH.mono}`; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.strokeText(`×${r.mult}`, x + 9, y - 8); ctx.fillStyle = TH.accent; ctx.fillText(`×${r.mult}`, x + 9, y - 8); }
    }
    ctx.restore();
  }
  // the point of the Riemann sphere under pane pixel (x, y) of a sphere view orbited by camera c (null off the globe
  // or at ∞): the ray from the eye meets the globe, and the stereographic projection takes the hit to the plane
  function pickSphere(pane, c, x, y) { const g = pickGlobe(pane, c, x, y); return g ? g.z : null; }
  // a ring at w on the right plane's globe (the hovered point of the regions sphere)
  function drawSphereMark(pane, w) {
    if (!GLR.ok || !GLR.camera) return;
    const pc = GLR.camera(camS, pane.w, pane.h);
    const p = liftC(w.re, w.im);
    const tv = [pc.eye[0] - p[0], pc.eye[1] - p[1], pc.eye[2] - p[2]];
    if (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2] <= 0) return;
    const q = project(pane, pc.MVP, p.map((v) => v * 1.01));
    if (!q) return;
    const ctx = pane.octx;
    ctx.save();
    ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, TAU); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = TH.probe; ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  // without GLR.drawPreimage: bounded area targets filled from their outlines
  function fillTargets2D(pane, areas) {
    const ctx = pane.ctx, win = targetWin();
    for (const t of areas) {
      if (t.complement || t.kind === 'formula') continue;
      let curves = [];
      try { curves = Region.curvesOf(t, win); } catch (e) { curves = []; }
      ctx.save(); ctx.beginPath();
      for (const c of curves) {
        const p = Region.sampleCurve(c, win);
        for (let i = 0; i + 1 < p.length; i += 2) { const [x, y] = pane.w2sxy(p[i], p[i + 1]); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
        ctx.closePath();
      }
      ctx.globalAlpha = t.alpha; ctx.fillStyle = shapeInk(t).c0; ctx.fill('evenodd');
      ctx.restore();
    }
  }
  // solutions of F(z) = p for the point targets, over the visible part of the left plane
  const roots = { key: '', sig: '', want: '', timer: 0, list: [], err: '' };
  const hasCalc = (fn) => typeof Calc !== 'undefined' && Calc && typeof Calc[fn] === 'function';
  // sig: what the solutions depend on besides the window (a pan keeps them on screen until the new ones arrive)
  const rootsSig = () => JSON.stringify([chainSig[nSteps()], S.focus, S.targets.filter((s) => s.visible !== false && s.kind === 'point').map((s) => [s.id, s.p[0], s.p[1]])]);
  function rootsKey() {
    const b = paneBox(paneL, leftView());
    return rootsSig() + JSON.stringify([b.x0, b.x1, b.y0, b.y1]);
  }
  function updateRoots() {
    if (!hasCalc('zerosPoles') || !paneL || !(paneL.w > 0)) return;
    const key = rootsKey();
    if (key === roots.key || key === roots.want) return;
    roots.want = key;
    clearTimeout(roots.timer);
    // after the view and the targets settle: a pan or a drag keeps the last solutions (they live in z)
    roots.timer = setTimeout(function run() {
      if (drag || tweens.length) { roots.timer = setTimeout(run, 150); return; }
      if (roots.want !== key) return;
      const F = focusF(), box = paneBox(paneL, leftView()), out = [];
      let err = '';
      // about 0.6 s on the main thread in all, at most 0.2 s a target
      const nPts = S.targets.filter((s) => s.visible !== false && s.kind === 'point').length;
      const ms = Math.max(40, Math.min(200, 600 / Math.max(1, nPts)));
      for (const s of S.targets) {
        if (s.visible === false || s.kind !== 'point') continue;
        let sols = [];
        try { sols = zerosPolesTimed(F, box, { target: { re: s.p[0], im: s.p[1] }, max: 40 }, ms); } catch (e) { err = e.message || String(e); sols = []; sols.incomplete = true; }
        // (filter returns a new array: keep the solver's flags for a capped or unfinished search)
        const f = sols.filter((r) => r && r.z && CX.isFin(r.z));
        f.truncated = !!sols.truncated; f.incomplete = !!sols.incomplete;
        out.push({ s, sols: f });
      }
      roots.list = out; roots.err = err; roots.key = key; roots.sig = rootsSig(); roots.want = '';
      requestRender('L', 'R');
    }, 100);
  }
  // roots are named after the left plane's variable: z₁, z₂ in the z-plane; in a wₖ-plane w₍₁₎, w₍₂₎ would clash
  // with the stage names, so they are r₁, r₂ there
  const rootName = (i) => (leftStage() === 0 ? `<i>z</i>${sub(i)}` : `<i>r</i>${sub(i)}`);
  const rootNameText = (i) => (leftStage() === 0 ? `z${sub(i)}` : `r${sub(i)}`);
  const rootScale = () => (paneL ? Math.max(paneL.w, paneL.h) / paneL.view.s : 0);
  // the degree of the focused map when it is rational with an exact degree: {d, poly}, else null
  function focusDegree() {
    // (a focused d/dz step: the fold of the chain up to it)
    const ks = S.focus === 0 ? activeSteps() : focusDeriv() ? activeSteps().filter((k) => k <= S.focus) : (stepFn(S.focus) ? [S.focus] : []);
    if (!ks.length) return { d: 1, poly: true };
    const P = ks.length === 1 && !isDeriv(ks[0]) ? built[ks[0] - 1].props : Funcs.composeProps(ks.map((k) => built[k - 1].props));
    if (!P || !P.rational || !P.degExact || P.constant || !(P.deg >= 1)) return null;
    return { d: P.deg, poly: !!P.polynomial };
  }
  // the ink of a target's roots: its own, unless it reads as the pole color (red and crimson mean singularities)
  function rootInk(s) {
    const e = shapeInk(s).edge;
    try {
      const a = hexToOklab(e), b = hexToOklab(TH.pole);
      if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 0.16) return TH.c[5].edge;
    } catch (err) { /* keep the target's ink */ }
    return e;
  }
  // proj: z -> screen [x, y] or null (hidden); the flat plane by default, the globe in the sphere view
  function drawRoots(pane, proj) {
    if (roots.sig !== rootsSig()) return;
    const ctx = pane.ctx, labels = [];
    let iz = 0;
    for (const e of roots.list) {
      // (an undo restores the targets as new objects: match them by id)
      const s = S.targets.find((t) => t.id === e.s.id), sols = e.sols;
      if (!s || s.visible === false) continue;
      const ink = { edge: rootInk(s) };
      for (const r of sols) {
        const q = proj ? proj(r.z) : pane.w2s(r.z);
        if (!q) { if (r.kind !== 'pole') iz++; continue; }
        const [x, y] = q;
        if (x < -10 || y < -10 || x > pane.w + 10 || y > pane.h + 10) { if (r.kind !== 'pole') iz++; continue; }
        ctx.save();
        if (r.kind === 'pole') {
          // a pole: a ring with a cross, in the pole color
          ctx.strokeStyle = TH.halo; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU); ctx.stroke();
          ctx.strokeStyle = TH.pole; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, 5, 0, TAU);
          ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3); ctx.moveTo(x + 3, y - 3); ctx.lineTo(x - 3, y + 3); ctx.stroke();
          labels.push({ x, y, text: r.mult > 1 ? `pole ×${r.mult}` : 'pole', word: true });
        } else {
          iz++;
          ctx.fillStyle = ink.edge; ctx.strokeStyle = TH.halo; ctx.lineWidth = 2.5;
          ctx.beginPath(); ctx.arc(x, y, 4.5, 0, TAU); ctx.stroke(); ctx.fill();
          ctx.strokeStyle = ink.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke();
          labels.push({ x, y, text: `${rootNameText(iz)}${r.mult > 1 ? ` ×${r.mult}` : ''}` });
        }
        ctx.restore();
      }
    }
    if (labels.length) placeLabels(ctx, pane, labels);
  }

  // ---------------- integrals: ∫γ F dz along a curve, on a right click ----------------
  // The curve: a shape's curve, or an area's boundary oriented with the area on its left, taken in the left plane
  // (the input of the focused map F). A right click (a long press on touch) near a curve in the left plane, near its
  // image in the right plane of Image, or near it on the Phase portrait opens a menu; its item opens a popover with
  // the integral, and for a closed curve (1/2πi)∮, the winding number of F∘γ and the zeros and poles inside.
  const integ = { gkey: '', geom: [] };
  // a polyline [[x, y], ...] (closed or not) cut to box B: [{pts, closed, part}]; it stays whole when it lies inside,
  // else its pieces inside are open (part: the visible part), ending at the crossing points
  function clipPolyline(pts, closed, B) {
    const inB = (p) => p[0] >= B.x0 && p[0] <= B.x1 && p[1] >= B.y0 && p[1] <= B.y1;
    if (pts.every(inB)) return [{ pts, closed }];
    // a closed curve starts at a point outside, so that no piece runs across its seam
    let seq = pts;
    if (closed) { const i0 = pts.findIndex((p) => !inB(p)); seq = pts.slice(i0).concat(pts.slice(0, i0 + 1)); }
    // Liang–Barsky: the parameters [t0, t1] of segment a → b inside B, or null
    const clipSeg = (a, b) => {
      let t0 = 0, t1 = 1;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const P = [-dx, dx, -dy, dy], Q = [a[0] - B.x0, B.x1 - a[0], a[1] - B.y0, B.y1 - a[1]];
      for (let k = 0; k < 4; k++) {
        if (P[k] === 0) { if (Q[k] < 0) return null; continue; }
        const r = Q[k] / P[k];
        if (P[k] < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
      }
      return t0 <= t1 ? [t0, t1] : null;
    };
    const at = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    const out = [];
    let cur = null;
    for (let i = 0; i + 1 < seq.length; i++) {
      const a = seq[i], b = seq[i + 1], c = clipSeg(a, b);
      if (!c) { if (cur) { out.push(cur); cur = null; } continue; }
      if (!cur || c[0] > 0) { if (cur) out.push(cur); cur = [at(a, b, c[0])]; }
      cur.push(at(a, b, c[1]));
      if (c[1] < 1) { out.push(cur); cur = null; }
    }
    if (cur) out.push(cur);
    return out.filter((p) => p.length >= 2 && p.some((q, i) => i && (q[0] !== p[0][0] || q[1] !== p[0][1]))).map((p) => ({ pts: p, closed: false, part: true }));
  }
  // the oriented pieces of a shape in the z-plane, as [[x, y], ...] polygons
  function curvePieces(s, dense) {
    const out = [];
    const t = kindType(s);
    if (t === 'point') return out;
    if (s.kind === 'formula') {
      // the mesh's level curves, cut to the meshing window like a line: an unbounded region's boundary runs out to
      // the stretched grid's far edge, where F may overflow (e^z past Re z = 709)
      const r = shapeGPU(s);
      if (r.mesh) for (const c of r.mesh.contours) if (c.pts && c.pts.length > 2) out.push(...clipPolyline(c.pts.map((z) => [z.re, z.im]), !!c.closed, clipWin));
    } else {
      let curves = [];
      try { curves = Region.curvesOf(s, clipWin); } catch (e) { curves = []; }
      for (const c of curves) {
        if (c.long) { // a line or a ray: its part in the meshing window
          const cl = Region.clipLine(c.a, CX.sub(c.b, c.a), clipWin, 0, 1);
          if (cl) out.push({ pts: [[cl[0].re, cl[0].im], [cl[1].re, cl[1].im]], closed: false, part: true });
          continue;
        }
        if (c.pts) {
          const ps = c.closed ? c.pts.slice(0, -1) : c.pts, xy = ps.map((z) => [z.re, z.im]);
          // an open traced curve (a curve formula) runs out toward infinity: its part in the meshing window, like a
          // line (its closed loops are counterclockwise, Curves.loops)
          if (c.traced && !c.closed) out.push(...clipPolyline(xy, false, clipWin));
          else if (c.traced && typeof Curves !== 'undefined' && Curves.simpleLoops) {
            // a traced loop that crosses itself (the figure eight |z^2 - 1| = 1) as its simple ccw lobes: an integral
            // around it does not flip sign with the trace window
            for (const q of Curves.simpleLoops(c.pts.flatMap((z) => [z.re, z.im]))) {
              const lp = [];
              for (let k = 0; k + 3 < q.length; k += 2) lp.push([q[k], q[k + 1]]);
              out.push({ pts: lp, closed: true });
            }
          } else out.push({ pts: xy, closed: !!c.closed });
          continue;
        }
        const n = (c.closed ? 720 : 360) / (dense ? 1 : 4);
        const pts = [];
        for (let i = 0; i < (c.closed ? n : n + 1); i++) { const z = c.f(i / n); pts.push([z.re, z.im]); }
        out.push({ pts, closed: !!c.closed });
      }
    }
    if (t === 'area') {
      // a positively oriented boundary keeps the area on its left (outer loops counterclockwise, holes clockwise);
      // so does the visible part of a boundary cut to the window (an edge of a half-plane or of a strip)
      let L = null;
      try { L = Region.levelOf(s); } catch (e) { L = null; }
      for (const c of out) {
        if (!L || c.pts.length < (c.closed ? 3 : 2)) continue;
        const n = c.pts.length;
        let best = -1, bi = 0;
        for (let i = 0; i < (c.closed ? n : n - 1); i++) { const a = c.pts[i], b = c.pts[(i + 1) % n], l = Math.hypot(b[0] - a[0], b[1] - a[1]); if (l > best) { best = l; bi = i; } }
        if (!(best > 0)) continue;
        const a = c.pts[bi], b = c.pts[(bi + 1) % n];
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, dx = (b[0] - a[0]) / best, dy = (b[1] - a[1]) / best, e = best * 0.02;
        const left = L(C(mx - dy * e, my + dx * e)), right = L(C(mx + dy * e, my - dx * e));
        if (left < right) c.pts.reverse();
      }
    }
    return out;
  }
  // the shapes' names as their rows show them ("Circle 1")
  function shapeNames() {
    const counts = {}, names = new Map();
    for (const s of S.shapes) { counts[s.kind] = (counts[s.kind] || 0) + 1; names.set(s.id, shapeName(s, counts)); }
    return names;
  }
  // one shape's curves in the left plane (stage leftStage()): {s, name, comps: [{flat, closed, part}], closed, box, bad}
  function shapeGeom(s, dense, names) {
    if (!s || kindType(s) === 'point') return null;
    const pieces = curvePieces(s, dense);
    if (!pieces.length) return null;
    const lk = leftStage(), G = stageF(lk);
    const comps = [];
    let bad = false;
    const box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    for (const c of pieces) {
      const flat = new Float64Array(2 * c.pts.length);
      c.pts.forEach((p, i) => {
        const w = lk ? G(C(p[0], p[1])) : C(p[0], p[1]);
        if (!CX.isFin(w)) bad = true;
        flat[2 * i] = w.re; flat[2 * i + 1] = w.im;
        if (CX.isFin(w)) { box.x0 = Math.min(box.x0, w.re); box.x1 = Math.max(box.x1, w.re); box.y0 = Math.min(box.y0, w.im); box.y1 = Math.max(box.y1, w.im); }
      });
      comps.push({ flat, closed: c.closed, part: !!c.part });
    }
    return { s, name: (names || shapeNames()).get(s.id) || Region.KINDS[s.kind].label, comps, closed: comps.every((c) => c.closed), box, bad };
  }
  // the curves the Phase view's Cauchy style may use, in the left plane: the selected shape's, the open integral
  // popover's, else every curve and bounded region boundary
  function integralGeom() {
    const sel = S.shapes.find((s) => s.id === selected && s.visible !== false && kindType(s) !== 'point');
    const pop = !sel && intPop ? S.shapes.find((s) => s.id === intPop.id && s.visible !== false) : null;
    // coarser while a shape is being dragged (a pan changes nothing here)
    const dense = !(drag && (drag.mode === 'move' || drag.mode === 'handle' || drag.mode === 'draw'));
    const key = JSON.stringify([chainSig[leftStage()], leftStage(), sel ? sel.id : '', pop ? pop.id : '', dense, clipWin, S.shapes.map((s) => (s.visible === false ? '' : shapeKey(s)))]);
    if (key === integ.gkey) return integ.geom;
    const names = shapeNames();
    const list = sel ? [sel] : pop ? [pop] : S.shapes.filter((s) => s.visible !== false && kindType(s) !== 'point' && s.kind !== 'cgrid' && s.kind !== 'pgrid');
    const geom = [];
    for (const s of list) {
      if (geom.length >= 12) break;
      const g = shapeGeom(s, dense, names);
      // an unbounded area has no closed boundary to go around: skipped unless it was picked
      if (!g || (!sel && !pop && kindType(s) === 'area' && !g.closed)) continue;
      geom.push(g);
    }
    integ.gkey = key; integ.geom = geom;
    return geom;
  }
  // ∫γ F dz along one shape's curves (components in turn, each starting where the last ended), with the running path
  function integrateGeom(g, F) {
    const it = { g, s: g.s, name: g.name, closed: g.closed, paths: [], value: C(0, 0), error: '', errBound: 0 };
    if (g.bad) it.error = 'The curve passes through a singularity of an earlier step';
    else if (!hasCalc('lineIntegral')) it.error = 'Line integrals are not available in this build';
    else {
      let acc = C(0, 0);
      for (const c of g.comps) {
        let r;
        try { r = Calc.lineIntegral(F, c.flat, c.closed); } catch (e) { r = { error: e.message || String(e), path: new Float64Array(0) }; }
        const src = !r.error && r.fine && r.fine.length > 2 ? r.fine : (r.path || new Float64Array(0));
        const p = new Float64Array(src.length);
        for (let i = 0; i + 1 < src.length; i += 2) { p[i] = src[i] + acc.re; p[i + 1] = src[i + 1] + acc.im; }
        it.paths.push(p);
        if (r.error) { it.error = r.error; break; }
        acc = C(acc.re + r.value.re, acc.im + r.value.im);
        it.errBound += Number.isFinite(r.errBound) ? r.errBound : 0;
      }
      it.value = it.error ? C(NaN, NaN) : acc;
    }
    return it;
  }
  // winding number of a closed polygon (flat [x, y, ...]) about z
  function windAbout(flat, z) {
    let a = 0;
    const n = flat.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = flat[2 * i] - z.re, ay = flat[2 * i + 1] - z.im, bx = flat[2 * j] - z.re, by = flat[2 * j + 1] - z.im;
      a += Math.atan2(ax * by - ay * bx, ax * bx + ay * by);
    }
    return Math.round(a / TAU);
  }
  // for a closed curve: the winding number of F∘γ about 0, and the zeros and poles found inside, with their
  // winding numbers (the argument principle: winding = zeros − poles, counted with multiplicity)
  function integralExtra(it, F) {
    if (!it || it.error || !it.closed) return null;
    let wind = 0, ok = hasCalc('argPrinciple');
    if (ok) for (const c of it.g.comps) {
      let r;
      try { r = Calc.argPrinciple(F, c.flat, 0); } catch (e) { r = { ok: false, winding: 0 }; }
      wind += r.winding || 0; ok = ok && !!r.ok;
    }
    let zeros = 0, poles = 0, list = [], partial = false;
    if (hasCalc('zerosPoles')) {
      const b = it.g.box, m = 0.02 * Math.max(b.x1 - b.x0, b.y1 - b.y0, 1e-9);
      try { list = zerosPolesTimed(F, { x0: b.x0 - m, x1: b.x1 + m, y0: b.y0 - m, y1: b.y1 + m }, { target: null, max: 40 }, 250); } catch (e) { list = []; list.incomplete = true; }
      partial = !!(list.truncated || list.incomplete);
      list = list.filter((r) => r && r.z && CX.isFin(r.z)).map((r) => Object.assign({ w: it.g.comps.reduce((acc, c) => acc + windAbout(c.flat, r.z), 0) }, r)).filter((r) => r.w !== 0);
      for (const r of list) { if (r.kind === 'pole') poles += r.w * (r.mult || 1); else zeros += r.w * (r.mult || 1); }
    }
    return { wind, ok, zeros, poles, list, partial, found: hasCalc('zerosPoles') };
  }
  // arrowheads along a screen polyline at the given fractions of its length
  function arrowsAlong(ctx, xy, fracs, size) {
    let total = 0;
    const seg = [];
    for (let i = 2; i + 1 < xy.length; i += 2) { const l = Math.hypot(xy[i] - xy[i - 2], xy[i + 1] - xy[i - 1]); seg.push(Number.isFinite(l) ? l : 0); total += seg[seg.length - 1]; }
    if (!(total > 6 * size)) return;
    for (const f of fracs) {
      let want = f * total, i = 0;
      while (i < seg.length - 1 && want > seg[i]) { want -= seg[i]; i++; }
      const x0 = xy[2 * i], y0 = xy[2 * i + 1], x1 = xy[2 * i + 2], y1 = xy[2 * i + 3];
      if (!(seg[i] > 0)) continue;
      const u = want / seg[i], x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, a = Math.atan2(y1 - y0, x1 - x0);
      ctx.beginPath();
      ctx.moveTo(x + size * Math.cos(a), y + size * Math.sin(a));
      ctx.lineTo(x + size * Math.cos(a + 2.5), y + size * Math.sin(a + 2.5));
      ctx.lineTo(x + size * Math.cos(a - 2.5), y + size * Math.sin(a - 2.5));
      ctx.closePath();
      ctx.fill();
    }
  }
  // proj (optional): z -> screen [x, y] or null (hidden, e.g. on the far side of the globe); a hidden point breaks the path
  function screenPath(pane, flat, proj) {
    const out = new Float64Array(flat.length);
    for (let i = 0; i + 1 < flat.length; i += 2) {
      const q = proj ? proj(C(flat[i], flat[i + 1])) : pane.w2sxy(flat[i], flat[i + 1]);
      out[i] = q ? q[0] : NaN; out[i + 1] = q ? q[1] : NaN;
    }
    return out;
  }
  // the left plane's sphere view: z lifted to the globe (stereographic) and projected, null on the far side
  function sphereProj(pane, info) {
    return (z) => {
      const p = CX.isFin(z) ? liftC(z.re, z.im) : [0, 0, 1];
      const tv = [info.eye[0] - p[0], info.eye[1] - p[1], info.eye[2] - p[2]];
      if ((tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / (Math.hypot(...tv) || 1) <= 0) return null;
      return project(pane, info.MVP, p.map((v) => v * 1.01));
    };
  }
  function strokePath(ctx, xy, close) {
    ctx.beginPath();
    let pen = false;
    for (let i = 0; i + 1 < xy.length; i += 2) {
      const x = xy[i], y = xy[i + 1];
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) { pen = false; continue; }
      if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
      pen = true;
    }
    if (close) ctx.closePath();
  }
  // the curve of the open integral popover, with arrows along its direction and a dot at its start; mapF carries it
  // from the left plane to the plane drawn (the image plane of Image), proj lifts it onto the left globe
  function drawIntHighlight(pane, proj, mapF) {
    const g = intPop && intPop.it && intPop.it.g;
    if (!g) return;
    const ctx = pane.octx, W = pane.w, H = pane.h;
    ctx.save();
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const c of g.comps) {
      let flat = c.flat;
      if (mapF) {
        flat = new Float64Array(c.flat.length);
        for (let i = 0; i + 1 < flat.length; i += 2) { const w = mapF(C(c.flat[i], c.flat[i + 1])); flat[i] = w.re; flat[i + 1] = w.im; }
      }
      const raw = screenPath(pane, flat, proj), xy = [];
      // a jump across a cut (or a pole) breaks the stroke
      for (let i = 0; i + 1 < raw.length; i += 2) {
        if (i && Math.hypot(raw[i] - raw[i - 2], raw[i + 1] - raw[i - 1]) > W + H) xy.push(NaN, NaN);
        xy.push(raw[i], raw[i + 1]);
      }
      const closed = c.closed && !mapF;
      strokePath(ctx, xy, closed);
      ctx.strokeStyle = TH.halo; ctx.globalAlpha = TH.haloA; ctx.lineWidth = 6; ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = TH.accent; ctx.lineWidth = 2.5; ctx.stroke();
      const along = c.closed && xy.length > 2 ? Float64Array.from([...xy, xy[0], xy[1]]) : Float64Array.from(xy);
      const fr = [0.125, 0.375, 0.625, 0.875];
      ctx.fillStyle = TH.halo; arrowsAlong(ctx, along, fr, 8.5);
      ctx.fillStyle = TH.accent; arrowsAlong(ctx, along, fr, 6);
      // the start of the curve (where the running integral is 0)
      if (xy.length >= 2 && Number.isFinite(xy[0]) && Number.isFinite(xy[1])) { ctx.fillStyle = TH.halo; ctx.strokeStyle = TH.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xy[0], xy[1], 4, 0, TAU); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  }
  // ---- the right-click menu and the integral popover ----
  let intPop = null;   // {id (shape), el, cx, cy (where it opened), it (the integral), x (winding, zeros and poles), timer}
  let lastPan = { t: 0, moved: false };   // a right-button pan just ended: its contextmenu opens nothing
  let holdMenuT = 0;   // a long press opened the menu: the touch's own contextmenu event opens nothing more
  // the shapes whose curves pass within reach of pane pixel (x, y): [{s, d}], nearest first. The left plane and the
  // Phase portrait show them in the left plane's coordinates; the image plane of Image shows their images.
  function curvesNear(pane, side, x, y) {
    let F = null, view;
    if (side === 'L') { if (!lFlat()) return []; view = leftView(); F = leftStage() ? stageF(leftStage()) : null; }
    else if (rImage() && !morphOn() && !trans.k) { view = V.right; F = stageF(rightStage()); }
    else return [];
    pane.setView(view);
    const W = pane.w, H = pane.h, out = [];
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point' || s.kind === 'cgrid' || s.kind === 'pgrid') continue;
      const r = shapeGPU(s);
      let best = Infinity;
      for (const p of r.polys || []) {
        const n = p.length / 2, stride = Math.max(1, Math.floor(n / 1500));
        let px = NaN, py = NaN;
        for (let i = 0; i < n + stride - 1; i += stride) {
          const j = Math.min(i, n - 1), z = C(p[2 * j], p[2 * j + 1]), w = F ? F(z) : z;
          if (!CX.isFin(w)) { px = NaN; continue; }
          const [qx, qy] = pane.w2s(w);
          if (Number.isFinite(px) && Math.hypot(qx - px, qy - py) < W + H) {
            const dx = qx - px, dy = qy - py, l2 = dx * dx + dy * dy;
            const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - px) * dx + (y - py) * dy) / l2)) : 0;
            best = Math.min(best, Math.hypot(x - px - u * dx, y - py - u * dy));
          }
          px = qx; py = qy;
          if (j === n - 1) break;
        }
      }
      if (best < 10) out.push({ s, d: best });
    }
    return out.sort((a, b) => a.d - b.d).slice(0, 3);
  }
  // a right click (or a long press) at pane pixel (x, y), client (cx, cy): a menu of the curves there; false when none
  function openIntegralMenu(pane, side, x, y, cx, cy) {
    const near = curvesNear(pane, side, x, y);
    if (!near.length) return false;
    const names = shapeNames();
    // the popover's variable (the left plane's: z, or wₖ with a step focused) and its closed-curve test (every
    // piece of the curve closed, after the cut to the meshing window)
    const dv = leftStage() === 0 ? 'z' : `w${sub(leftStage())}`;
    const items = near.map(({ s }) => {
      let closed = false;
      try { const pieces = curvePieces(s, false); closed = pieces.length > 0 && pieces.every((c) => c.closed); } catch (e) { closed = false; }
      const name = names.get(s.id) || Region.KINDS[s.kind].label;
      return { label: closed ? `∮ ${fnText()} d${dv} around ${name}` : `Integrate ${fnText()} along ${name}`, run: () => openIntegralPop(s.id, cx, cy) };
    });
    closePalette();
    const pop = openMenu(pane.ocanvas, items, 'ctx-menu');
    if (pop) {
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let px = cx + 2, py = cy + 2;
      if (px + pw > window.innerWidth - 12) px = Math.max(12, cx - pw - 2);
      if (py + ph > window.innerHeight - 12) py = Math.max(12, cy - ph - 2);
      pop.style.left = px + 'px'; pop.style.top = py + 'px';
      armOutside(null);   // (its opener is the plane itself: a press anywhere outside the menu closes it)
    }
    return true;
  }
  // a complex value for copying: components within tol read 0
  const cxCopy = (w, tol) => {
    if (!CX.isFin(w)) return '';
    const re = Math.abs(w.re) <= tol ? 0 : w.re, im = Math.abs(w.im) <= tol ? 0 : w.im;
    return CX.fmt(C(re, im), 12).replace(/\s/g, '');
  };
  function openIntegralPop(id, cx, cy) {
    closePalette();
    const s = S.shapes.find((x) => x.id === id);
    if (!s) return null;
    const pop = h('div', { class: 'pop int-pop', role: 'dialog', 'aria-label': 'Line integral' });
    $('popHost').append(pop);
    popEl = pop;
    intPop = { id, el: pop, cx, cy, it: null, x: null, timer: 0 };
    pop._onClose = () => {
      if (!intPop || intPop.el !== pop) return;
      clearTimeout(intPop.timer);
      intPop = null; integ.gkey = '';
      requestRender('OL', 'OR', lColor() && S.dc === 'cauchy' ? 'L' : null);
    };
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); } });
    fillIntPop();
    placeIntPop();
    armOutside(null);
    const first = pop.querySelector('button');
    if (first) first.focus({ preventScroll: true });
    // the Cauchy style follows the popover's curve when nothing is selected
    integ.gkey = '';
    requestRender('OL', 'OR', lColor() && S.dc === 'cauchy' ? 'L' : null);
    return first;
  }
  function placeIntPop() {
    if (!intPop) return;
    const pop = intPop.el, pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = intPop.cx + 12, y = intPop.cy + 12;
    if (x + pw > window.innerWidth - 12) x = Math.max(12, intPop.cx - pw - 12);
    if (y + ph > window.innerHeight - 12) y = Math.max(12, Math.min(window.innerHeight - ph - 12, intPop.cy - ph - 12));
    // keep the planes' legend chips clear (merged-views review: on the wide Phase panel it covered the colour key):
    // a popover that would overlap one moves to its left, or below it when there is no room on the left
    for (const id of ['leftLegend', 'rightLegend']) {
      const el = $(id);
      if (!el || el.hidden || el.offsetParent === null) continue;
      const q = el.getBoundingClientRect();
      if (!(q.width > 0) || x > q.right + 4 || x + pw < q.left - 4 || y > q.bottom + 4 || y + ph < q.top - 4) continue;
      if (q.left - 8 - pw >= 12) x = q.left - 8 - pw;
      else y = Math.min(window.innerHeight - ph - 12, q.bottom + 8);
    }
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
    pop.dataset.side = y < intPop.cy ? 'top' : 'bottom';
  }
  // the chain, the focus or the shapes changed under an open popover: integrate again once things settle
  function refreshIntPop() {
    if (!intPop) return;
    clearTimeout(intPop.refresh);
    intPop.refresh = setTimeout(() => {
      if (!intPop) return;
      const s = S.shapes.find((x) => x.id === intPop.id);
      if (!s || s.visible === false) { closePalette(); return; }
      if (drag) { refreshIntPop(); return; }
      fillIntPop();
    }, 120);
  }
  // integrate and fill the popover; the zeros and poles inside follow a moment later
  function fillIntPop() {
    const P = intPop;
    if (!P) return;
    const s = S.shapes.find((x) => x.id === P.id);
    const g = shapeGeom(s, true);
    if (!g) { closePalette(); return; }
    const F = focusF();
    P.it = integrateGeom(g, F);
    P.x = null;
    renderIntPop();
    clearTimeout(P.timer);
    if (P.it.closed && !P.it.error) P.timer = setTimeout(() => { if (intPop !== P) return; P.x = integralExtra(P.it, F); renderIntPop(); }, 30);
    requestRender('OL', 'OR');
  }
  function renderIntPop() {
    const P = intPop;
    if (!P || !P.it) return;
    const it = P.it, pop = P.el, Fh = fnHtml(), dv = leftStage() === 0 ? '<i>z</i>' : `<i>w</i>${sub(leftStage())}`;
    const tol = it.errBound || 0;
    const copyBtn = (text, what) => {
      const b = h('button', { class: 'icon-btn small', 'data-tip': 'Copy', 'aria-label': `Copy ${what}`, html: ICONS.copy, disabled: text ? null : true });
      b.addEventListener('click', () => { copyText(text); b.innerHTML = ICONS.check; b.classList.add('copied'); setTimeout(() => { b.innerHTML = ICONS.copy; b.classList.remove('copied'); }, 1200); });
      return b;
    };
    const row = (k, v, copy, cls) => h('div', { class: 'int-row' + (cls ? ' ' + cls : '') }, h('span', { class: 'int-k', html: k }), h('span', { class: 'int-v', html: v }), copy || h('span', { class: 'int-pad' }));
    const sym = it.closed ? '∮' : '∫';
    const part = it.g.comps.some((c) => c.part);
    const close = h('button', { class: 'icon-btn small', 'data-tip': 'Close  Esc', 'aria-label': 'Close', html: ICONS.close, onclick: () => closePalette() });
    const kids = [h('div', { class: 'pop-title' }, h('span', { class: 'int-title', html: `${sym} ${it.closed ? 'around' : 'along'} ${it.name.replace(/[&<>]/g, '')}${part ? ' <span class="int-part">(visible part)</span>' : ''}` }), h('span', { class: 'grow' }), close)];
    const body = h('div', { class: 'int-body' });
    if (it.error) body.append(h('div', { class: 'int-note err' }, it.error));
    else {
      body.append(row(`${sym}<sub><i>γ</i></sub> ${Fh} d${dv}`, cxShort(it.value, tol * 1e8), copyBtn(cxCopy(it.value, tol), 'the integral')));
      if (it.closed) {
        const r = C(it.value.im / TAU, -it.value.re / TAU), rt = tol / TAU;
        body.append(row(`(1/2π<i>i</i>) ∮ ${Fh} d${dv}`, cxShort(r, rt * 1e8), copyBtn(cxCopy(r, rt), 'the integral over 2πi')));
        const x = P.x, int = (n) => String(n).replace('-', '−');
        if (!x) body.append(h('div', { class: 'int-note' }, 'Counting zeros and poles inside…'));
        else {
          body.append(row(`winding of ${Fh}∘<i>γ</i> about 0`, x.ok ? int(x.wind) : '—', null));
          if (x.found) {
            const agree = x.ok && !x.partial && x.zeros - x.poles === x.wind;
            body.append(row(x.partial ? 'zeros − poles found inside' : 'zeros − poles inside', `<span class="${agree ? 'ok' : ''}">${int(x.zeros)} − ${int(x.poles)} = ${int(x.zeros - x.poles)}</span>`, null));
            const lst = h('div', { class: 'int-list' });
            let iz = 0, shown = 0;
            for (const r of x.list) {
              const pole = r.kind === 'pole';
              if (!pole) iz++;
              if (shown++ >= 6) continue;
              const nm = pole ? 'pole' : (leftStage() === 0 ? `<i>z</i>${sub(iz)}` : `<i>r</i>${sub(iz)}`);
              const extra = (r.mult > 1 ? ` <span class="int-m">×${r.mult}</span>` : '') + (Math.abs(r.w) !== 1 ? ` <span class="int-m">wound ${int(r.w)}×</span>` : '');
              lst.append(h('div', { class: 'int-row sub' }, h('span', { class: 'int-k', html: `<span class="sw${pole ? ' pole' : ''}"></span>${nm}${extra}` }), h('span', { class: 'int-v', html: cxShort(r.z, Math.max(it.g.box.x1 - it.g.box.x0, it.g.box.y1 - it.g.box.y0)) })));
            }
            if (shown > 6) lst.append(h('div', { class: 'int-note' }, `and ${shown - 6} more`));
            if (x.list.length) body.append(lst);
            if (x.partial) body.append(h('div', { class: 'int-note' }, 'The search stopped early; there may be more inside.'));
            else if (x.ok && x.zeros - x.poles !== x.wind) body.append(h('div', { class: 'int-note', html: `The counts differ: ${Fh} has a branch cut or an essential singularity inside the curve, where the argument principle does not apply.` }));
          }
          if (!x.ok) body.append(h('div', { class: 'int-note', html: `${Fh} vanishes, blows up or jumps on the curve, so the argument principle does not apply.` }));
        }
      }
    }
    // the running integral t ↦ ∫γ[0,t] F dz from 0: start ○, end ●, and for a closed curve the gap back to 0 (∮)
    const cv = h('canvas', { class: 'int-plot', width: 264 * 2, height: 128 * 2, 'aria-hidden': 'true' });
    body.append(cv, h('div', { class: 'int-cap', html: `Running integral of ${Fh} from 0 (○) to its value (●)${it.closed && !it.error ? '; the dashed gap back to 0 is ∮' : ''}` }));
    kids.push(body);
    pop.replaceChildren(...kids);
    pop.setAttribute('aria-label', `Line integral ${it.closed ? 'around' : 'along'} ${it.name}`);
    drawIntPlot(cv, it);
  }
  function drawIntPlot(cv, it) {
    const ctx = cv.getContext('2d'), dpr = 2, W = 264, Hh = 128;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = TH.plane; ctx.fillRect(0, 0, W, Hh);
    const xs = [0], ys = [0];
    for (const p of it.paths) for (let i = 0; i + 1 < p.length; i += 2) if (Number.isFinite(p[i]) && Number.isFinite(p[i + 1]) && Math.abs(p[i]) < 1e12 && Math.abs(p[i + 1]) < 1e12) { xs.push(p[i]); ys.push(p[i + 1]); }
    let x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const span = Math.max(x1 - x0, y1 - y0, 1e-9);
    if (x1 - x0 < span * 0.02) { x0 -= span * 0.1; x1 += span * 0.1; }
    if (y1 - y0 < span * 0.02) { y0 -= span * 0.1; y1 += span * 0.1; }
    const pad = 14, sc = Math.min((W - 2 * pad) / (x1 - x0), (Hh - 2 * pad) / (y1 - y0));
    const ox = W / 2 - (x0 + x1) / 2 * sc, oy = Hh / 2 + (y0 + y1) / 2 * sc;
    const P = (x, y) => [ox + x * sc, oy - y * sc];
    // the axes through 0
    const [zx, zy] = P(0, 0);
    ctx.strokeStyle = TH.gridMajor; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, Math.round(zy) + 0.5); ctx.lineTo(W, Math.round(zy) + 0.5); ctx.moveTo(Math.round(zx) + 0.5, 0); ctx.lineTo(Math.round(zx) + 0.5, Hh); ctx.stroke();
    const ink = shapeInk(it.s).edge;
    let end = null;
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    for (const p of it.paths) {
      const xy = new Float64Array(p.length);
      for (let i = 0; i + 1 < p.length; i += 2) { const q = P(p[i], p[i + 1]); xy[i] = q[0]; xy[i + 1] = q[1]; }
      strokePath(ctx, xy, false);
      ctx.strokeStyle = ink; ctx.lineWidth = 1.75; ctx.stroke();
      ctx.fillStyle = ink; arrowsAlong(ctx, xy, [0.25, 0.5, 0.75], 4.5);
      for (let i = xy.length - 2; i >= 0; i -= 2) if (Number.isFinite(xy[i]) && Number.isFinite(xy[i + 1])) { end = [xy[i], xy[i + 1]]; break; }
    }
    if (it.closed && end && !it.error && Math.hypot(end[0] - zx, end[1] - zy) > 3) {
      ctx.strokeStyle = TH.accent; ctx.lineWidth = 1.25; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(end[0], end[1]); ctx.lineTo(zx, zy); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.fillStyle = TH.plane;
    ctx.beginPath(); ctx.arc(zx, zy, 3.5, 0, TAU); ctx.fill(); ctx.stroke();
    if (end && it.error) {
      const [ex, ey] = end;
      ctx.strokeStyle = TH.pole; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex - 4, ey - 4); ctx.lineTo(ex + 4, ey + 4); ctx.moveTo(ex + 4, ey - 4); ctx.lineTo(ex - 4, ey + 4); ctx.stroke();
    } else if (end) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(end[0], end[1], 3.5, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = TH.line; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, Hh - 1);
  }
  // the selected curve's integral, from the keyboard or the palette: the popover opens over the left plane
  function integrateSelected() {
    const s = S.shapes.find((x) => x.id === selected && x.visible !== false && kindType(x) !== 'point');
    const list = s ? [s] : S.shapes.filter((x) => x.visible !== false && kindType(x) !== 'point' && x.kind !== 'cgrid' && x.kind !== 'pgrid');
    if (!list.length) { toast('Draw a curve or a region first: right-click a curve to integrate along it.'); return null; }
    const r = paneL.ocanvas.getBoundingClientRect();
    return openIntegralPop(list[0].id, r.left + r.width / 2, r.top + r.height / 2);
  }
  // GPU Cauchy style of the Phase view: N nodes on the subject's boundary, shared by its components by length
  const cauchyCache = { key: '', val: null };
  function cauchyPlot() {
    if (!hasCalc('cauchyNodes')) return null;
    const geom = integralGeom();
    const g = geom.find((x) => x.s.id === selected && x.closed) || geom.find((x) => x.closed);
    if (!g || g.bad) return null;
    const key = integ.gkey + '|' + g.s.id + '|' + chainSig[nSteps()] + '|' + S.focus;
    if (cauchyCache.key === key) return cauchyCache.val;
    const F = focusF();
    const lens = g.comps.map((c) => { let l = 0; for (let i = 2; i + 1 < c.flat.length; i += 2) l += Math.hypot(c.flat[i] - c.flat[i - 2], c.flat[i + 1] - c.flat[i - 1]); return l; });
    const tot = lens.reduce((a, b) => a + b, 0) || 1, N = 256, parts = [];
    let n = 0;
    g.comps.forEach((c, i) => {
      const m = Math.max(16, Math.round(N * lens[i] / tot));
      try { const nd = Calc.cauchyNodes(F, c.flat, m); if (nd && nd.length) { parts.push(nd); n += nd.length / 4; } } catch (e) { /* skip */ }
    });
    const nodes = new Float32Array(4 * n);
    let o = 0;
    for (const p of parts) { nodes.set(p, o); o += p.length; }
    cauchyCache.key = key; cauchyCache.val = n ? { nodes, n, name: g.name } : null;
    return cauchyCache.val;
  }
  // what the Phase, Landscape and Sphere (phase) views plot, at t = end (a derivative is a d/dz step of the chain)
  const plotF = () => focusF();

  // ---------------- the readings chip (the w-plane targets' preimages) ----------------
  const calcChipState = { html: '' };
  const fxHtml = () => `${fnHtml()}(${wHtml(leftStage())})`;
  // a complex value for display: ×10ⁿ (never 'e'), components below tol·max shown as 0
  const cxShort = (w, scale = 0) => {
    if (!CX.isFin(w)) return '—';
    const tol = Math.max(1e-12 * Math.max(Math.abs(w.re), Math.abs(w.im)), 1e-8 * scale);
    const f = (x) => CX.fmtNum(x, 4).replace('-', '−');
    let re = Math.abs(w.re) <= tol ? 0 : w.re, im = Math.abs(w.im) <= tol ? 0 : w.im;
    if (f(re) === '0') re = 0;
    if (f(Math.abs(im)) === '0') im = 0;
    if (im === 0) return f(re);
    const ims = Math.abs(im) === 1 ? 'i' : `${f(Math.abs(im))}i`;
    if (re === 0) return (im < 0 ? '−' : '') + ims;
    return `${f(re)} ${im < 0 ? '−' : '+'} ${ims}`;
  };
  function updateCalcChip() {
    const el = $('calcChip');
    if (!el) return;
    // the Cauchy style's note names the curve it integrates over: follow the selection
    if (lColor() && S.dc === 'cauchy') {
      const cp = cauchyPlot(), nm = cp ? cp.name : '';
      if (nm !== calcChipState.cauchy) { calcChipState.cauchy = nm; buildRightFoot(); updateFocusUI(); }
    }
    // the targets' readings, in every view, while there are targets; not over the merged deformation, whose plane is
    // Y's at time t, not X (merged-views review: the z-plane roots were listed as "in view" over a w-plane picture)
    const want = hasTargets() && solo() !== 'L' && !(S.view.main === 'xy' && morphOn());
    let html = '';
    if (want) {
      const pts = S.targets.filter((s) => s.visible !== false && s.kind === 'point');
      const others = S.targets.filter((s) => s.visible !== false && s.kind !== 'point').length;
      const rows = [];
      if (pts.length && !hasCalc('zerosPoles')) rows.push('<div class="cn">Root finding is not available in this build.</div>');
      else if (pts.length && roots.sig !== rootsSig()) rows.push(`<div class="ch">Solving ${fxHtml()} = <i>p</i> in view…</div>`);
      else if (pts.length) {
        let iz = 0, shown = 0;
        // with the left plane on the sphere the solve still runs over the flat view's window
        const where = !lFlat() ? 'in the flat view' : 'in view';
        const deg = focusDegree();
        roots.list.forEach((e, j) => {
          const s = S.targets.find((t) => t.id === e.s.id) || e.s, sols = e.sols;
          if (j) rows.push('<hr>');
          const zs = sols.filter((r) => r.kind !== 'pole'), ps = sols.filter((r) => r.kind === 'pole');
          const nz = zs.reduce((a, r) => a + (r.mult || 1), 0);
          // a capped or unfinished search gives a lower bound, never an exact count
          const partial = !!(sols.truncated || sols.incomplete);
          const val = s.p[0] === 0 && s.p[1] === 0 ? '0' : `<span class="cv">${cxShort(C(s.p[0], s.p[1]))}</span>`;
          // (a search cut short that found nothing gives no count at all)
          if (sols.incomplete && !nz) rows.push(`<div class="ch">No roots of ${fxHtml()} = ${val} found ${where}</div>`);
          else rows.push(`<div class="ch">${partial ? 'at least ' : ''}${nz} root${nz === 1 ? '' : 's'} of ${fxHtml()} = ${val} ${where}${sols.truncated ? ` (first ${sols.length})` : ''}</div>`);
          const ink = rootInk(s);
          for (const r of zs) {
            iz++;
            if (shown++ >= 6) continue;
            rows.push(`<div class="cl"><span><span class="sw" style="background:${ink}"></span>${rootName(iz)}${r.mult > 1 ? ` <span class="cm">×${r.mult}</span>` : ''}</span><span class="cv">${cxShort(r.z, rootScale())}</span></div>`);
          }
          // poles like zeros: one row each, with the order and the place
          for (const r of ps) {
            if (shown++ >= 6) continue;
            rows.push(`<div class="cl"><span><span class="sw pole" style="color:${TH.pole}"></span>pole${r.mult > 1 ? ` <span class="cm">×${r.mult}</span>` : ''}</span><span class="cv">${cxShort(r.z, rootScale())}</span></div>`);
          }
          if (sols.incomplete) rows.push('<div class="cn">The search stopped early; there may be more.</div>');
          // a rational F of degree d takes every value d times on the sphere (a polynomial, d times in ℂ)
          else if (!partial && deg && nz < deg.d) rows.push(`<div class="cn">${deg.poly ? '' : 'Up to '}${deg.d - nz} more outside ${!lFlat() ? 'the flat view' : 'the view (zoom out to see them)'}.</div>`);
        });
        if (shown > 6) rows.push(`<div class="cm">and ${shown - 6} more</div>`);
        if (roots.err) rows.push(`<div class="cn err">${roots.err}</div>`);
      }
      if (others) {
        if (rows.length) rows.push('<hr>');
        // areas are shaded on the left, curves drawn (their preimage curves)
        const vis = S.targets.filter((s) => s.visible !== false && s.kind !== 'point');
        const na = vis.filter((s) => kindType(s) === 'area').length, nc = vis.length - na;
        const the = (k, w) => (k === 1 ? `the ${w}` : `the ${k} ${w}s`);
        if (na && nc) rows.push(`<div class="cn">On the left: shaded where ${fxHtml()} lands in ${the(na, 'target area')}, and drawn the curves it maps onto ${the(nc, 'target curve')}.</div>`);
        else if (nc) rows.push(`<div class="cn">Drawn on the left: the curves ${fxHtml()} maps onto ${the(nc, 'target')}.</div>`);
        else rows.push(`<div class="cn">Shaded on the left: where ${fxHtml()} lands in ${others === 1 ? 'the target' : `the ${others} targets`}.</div>`);
      }
      // over the w-globe the chip keeps to its headings, so the scene stays visible
      const compact = rGlobe();
      html = (compact ? rows.filter((r) => r.startsWith('<div class="ch">') || r.includes('cn err')) : rows).join('');
    }
    if (html !== calcChipState.html) { calcChipState.html = html; el.innerHTML = html; }
    const show = want && !!html;
    if (el.hidden === show) el.hidden = !show;
  }

  // ---------------- thumbnails ----------------
  const thumbs = new Map(); // stage k -> Pane
  // thumbnail sizes come from a ResizeObserver: measuring each canvas after the cards were rebuilt forced a
  // layout per thumbnail
  const thumbSize = new WeakMap();
  const thumbSeen = new Set();
  let thumbRO = null;
  function thumbDims(cv) {
    let s = thumbSize.get(cv);
    if (!s) {
      if (!thumbRO && window.ResizeObserver) {
        thumbRO = new ResizeObserver((es) => {
          let changed = false;
          for (const e of es) {
            const o = thumbSize.get(e.target), w = e.contentRect.width, hh = e.contentRect.height;
            if (!o || o[0] !== w || o[1] !== hh) { thumbSize.set(e.target, [w, hh]); changed = true; }
          }
          if (changed) requestRender('T');
        });
      }
      const r = cv.getBoundingClientRect(); // first sight only
      s = [r.width, r.height];
      thumbSize.set(cv, s);
      if (thumbRO) { thumbRO.observe(cv); thumbSeen.add(cv); }
    }
    return s;
  }
  // thumbnails are cached by signature (stage, chain prefix, shapes, look), so rebuilding the strip is instant
  const thumbCache = new Map();
  let thumbShapesSig = '';
  function renderThumb(k) {
    const pane = thumbs.get(k);
    if (!pane || !pane.canvas.isConnected) return;
    pane.resize(...thumbDims(pane.canvas));
    // (with exact images: whether the inverse program is ready, so a thumbnail drawn forward before it was is redrawn)
    const sig = `${k}|${chainSig[k]}|${thumbShapesSig}|${S.pattern}|${S.patternScale}|${S.alpha}|${S.lines}|${TH.plane}|${pane.pw}x${pane.ph}|${S.exactImages !== false && GLR.ok && GLR.inverseStatus ? GLR.inverseStatus(S.alpha, 'flat') === 'ready' : ''}`;
    if (pane.sig === sig) return;
    const hit = thumbCache.get(sig);
    if (hit) {
      pane.ctx.setTransform(1, 0, 0, 1, 0, 0);
      pane.ctx.drawImage(hit, 0, 0);
      pane.sig = sig;
      return;
    }
    fitPane(pane, k);
    pane.begin(TH.plane);
    if (!GLR.ok || !GLR.drawGrid) Axes.draw(pane, Object.assign({}, TH, { label: 'rgba(0,0,0,0)' }), { unitCircle: false, labels: false });
    thumbNotFinal = false;
    if (GLR.ok) drawScene(pane, stageMap(k), null, { thin: true, L: 2 });
    const glst = GLR.frameStatus ? GLR.frameStatus() : null;
    const waiting = !!(glst && glst.pending);
    drawPoints(pane, stageF(k), { thin: true });
    drawCuts(pane, k, false, true);
    if (!S.shapes.some((x) => x.visible !== false)) {
      // above the real axis (the empty view is centered on 0) and cased in the plane color, so nothing strikes it
      const ctx = pane.ctx;
      ctx.font = `12px ${TH.ui}`; ctx.fillStyle = TH.muted; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      haloText(ctx, 'No shapes', pane.w / 2, pane.h / 2 - 7, TH.plane);
    }
    if (waiting || thumbNotFinal) { thumbNotFinal = false; thumbsWaiting = true; return; } // drawn with a stand-in: not final, not cached
    pane.sig = sig;
    if (window.createImageBitmap) {
      createImageBitmap(pane.canvas).then((bm) => {
        thumbCache.set(sig, bm);
        if (thumbCache.size > 48) { const old = thumbCache.keys().next().value; const b = thumbCache.get(old); thumbCache.delete(old); if (b && b.close) b.close(); }
      }).catch(() => {});
    }
  }
  let thumbsWaiting = false;
  function renderThumbs() {
    // wait for a quiet moment: never during drags, pans or a playing morph
    if (drag || tweens.length || camTweens.length || (morph.playing && morph.open) || performance.now() - lastInputT < 150) {
      clearTimeout(thumbT);
      thumbT = setTimeout(renderThumbs, 160);
      return;
    }
    thumbShapesSig = S.shapes.map((x) => shapeKey(x) + (x.visible === false ? 'h' : '') + (x.ci ?? '') + (x.color || '')).join('|');
    for (const cv of thumbSeen) if (!cv.isConnected) { thumbRO.unobserve(cv); thumbSeen.delete(cv); } // cards rebuilt
    for (const p of thumbs.values()) if (p.canvas.isConnected) thumbDims(p.canvas); // all reads before any canvas resize
    for (const k of thumbs.keys()) { try { renderThumb(k); } catch (e) { console.error(e); } }
  }

  // ---------------- render scheduling ----------------
  const dirty = { L: false, R: false, OL: false, OR: false, T: false, P: false, G: false }; // G: the legend chip
  let rafId = 0;
  function requestRender(...which) {
    for (const w of which.length ? which : ['L', 'R']) if (w) dirty[w] = true;
    if (!rafId) { rafId = requestAnimationFrame(frame); rafReqT = performance.now(); }
  }
  let thumbT = 0, lastInputT = 0, motionInT = 0;
  // motionInT: the last CONTINUOUS input (a wheel, a pointer moved with a button down, a range slider's input, a held
  // key); a hover or a single click is not motion (interacting(): a ready inverse program is not held back for it)
  for (const ev of ['pointermove', 'pointerdown', 'wheel', 'keydown', 'input']) window.addEventListener(ev, (e) => {
    const t = performance.now();
    lastInputT = t;
    if (ev === 'wheel' || (ev === 'pointermove' && e.buttons) || (ev === 'input' && e.target && e.target.type === 'range') || (ev === 'keydown' && e.repeat)) motionInT = t;
  }, { passive: true, capture: true });
  // cameras: 28° telephoto. dist is the fit distance for the bounding sphere at the pane's aspect; render3D and
  // renderSphere refit it every frame (refitCam), so zoom limits (0.4–4 × dist) and resets stay relative to the fit.
  const CAM3 = { yaw: -38 * DEG, pitch: 30 * DEG, dist: 1.77 / Math.sin(14 * DEG) * 1.05, tx: 0, ty: 0, tz: -0.04, fov: 28 * DEG };
  const CAMS = { yaw: -60 * DEG, pitch: 18 * DEG, dist: 1.16 / Math.sin(14 * DEG) * 1.05, tx: 0, ty: 0, tz: 0, fov: 28 * DEG };
  const cam = Object.assign({ vyaw: 0, vpitch: 0 }, CAM3);
  const camS = Object.assign({ vyaw: 0, vpitch: 0 }, CAMS);
  // the pane a camera orbits in (U-b): the landscape (cam) and the z-globe (camL) in X, the w-globe (camS) in Y
  const camSide = (c) => (c === camS ? 'R' : 'L');
  const camTweens = [];
  // a new fit distance (pane resized, box aspect or height scale changed) rescales the user's zoom with it
  function refitCam(c, base, fit) {
    if (!(fit > 0 && fit < 1e6) || Math.abs(fit - base.dist) <= 1e-9 * fit) return;   // (a collapsed pane gives no fit)
    const k = fit / base.dist;
    c.dist *= k;
    for (const tw of camTweens) if (tw.c === c) { tw.from.dist *= k; tw.to.dist *= k; }
    base.dist = fit;
  }
  function tweenCam(c, target) {
    for (let i = camTweens.length - 1; i >= 0; i--) if (camTweens[i].c === c) camTweens.splice(i, 1);
    const to = Object.assign({}, { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx, ty: c.ty }, target);
    c.vyaw = c.vpitch = 0;
    const side = camSide(c);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { Object.assign(c, to); requestRender(side); return; }
    // take the short way round in yaw
    let dy = (to.yaw - c.yaw) % TAU; if (dy > Math.PI) dy -= TAU; if (dy < -Math.PI) dy += TAU;
    camTweens.push({ c, from: { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx, ty: c.ty }, to: Object.assign(to, { yaw: c.yaw + dy }), t0: performance.now(), ms: 400 });
    requestRender(side);
  }
  function frame(ts) {
    rafId = 0;
    let again = false;
    liveMsUsed = 0;
    const frameT0 = performance.now();
    frameStartT = frameT0;
    // (the time from the request to this callback: the rAF timestamp is the frame's begin time, which can precede the
    // request)
    frameLag = Math.max(0, performance.now() - rafReqT);
    prepMs = 0;
    if (morph.playing && morph.open) {
      const dt = morph.last ? Math.min(0.1, (ts - morph.last) / 1000) : 0;
      morph.last = ts;
      const m = morphLen();
      // per step: eased motion, a short hold at each step boundary, a longer one at the end
      if (!m) { morph.playing = false; setPlayIcon(); }
      else if (morph.hold > 0) morph.hold -= dt;
      else {
        // the current step is tracked explicitly; deriving it from floor(T) skipped a step when easing rounded T up to an integer
        if (morph.seg == null) { morph.seg = Math.max(0, Math.min(m - 1, Math.floor(morph.T))); morph.u = Math.max(0, Math.min(0.999, morph.T - morph.seg)); }
        const before = morph.seg;
        morph.u = (morph.u || 0) + dt / (S.morphSecs || 1.6);
        if (morph.u >= 1) { morph.u = 0; morph.T = Math.min(m, before + 1); morph.seg = morph.T >= m ? null : before + 1; morph.hold = morph.T >= m ? 1.0 : 0.5; }
        else { const u = morph.u; morph.T = Math.min(before + 0.9999, before + (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2)); }
      }
      if (m && morph.hold <= 0 && morph.T >= m) {
        if (S.loop === false || matchMedia('(prefers-reduced-motion: reduce)').matches) { morph.playing = false; morph.seg = null; setPlayIcon(); scheduleFix(); } else { morph.T = 0; morph.u = 0; morph.seg = 0; }
      }
      dirty.R = true;
      // X's portrait, landscape or phase globe paint H_t too
      if (lPaintsF()) dirty.L = true;
      again = morph.playing;
    }
    // camera tweens and inertia in 3D views
    for (let i = camTweens.length - 1; i >= 0; i--) {
      const tw = camTweens[i];
      const u = Math.min(1, (performance.now() - tw.t0) / tw.ms), e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      for (const k of ['yaw', 'pitch', 'dist', 'tx', 'ty']) tw.c[k] = tw.from[k] + (tw.to[k] - tw.from[k]) * e;
      if (u >= 1) camTweens.splice(i, 1);
      dirty[camSide(tw.c)] = true;
      again = true;
    }
    // (the landscape and the z-globe orbit in X, the w-globe in Y)
    const c3 = rGlobe() ? camS : null;
    const cL = lLand() ? cam : lGlobe() ? leftCam() : null;
    for (const [cc, side] of [[c3, 'R'], [cL, 'L']]) {
      if (!cc || drag || !(Math.abs(cc.vyaw) > 1e-4 || Math.abs(cc.vpitch) > 1e-4)) continue;
      cc.yaw += cc.vyaw;
      cc.pitch = Math.max(pitchMin(cc), Math.min(88 * DEG, cc.pitch + cc.vpitch));
      cc.vyaw *= 0.9; cc.vpitch *= 0.9;
      dirty[side] = true;
      again = true;
    }
    if (tweens.length) { stepTweens(ts); again = true; }
    if (trans.k) {
      if (performance.now() - trans.t0 >= trans.dur || !stepActive(trans.k)) { trans.k = 0; scheduleFix(); if (rightAuto && rImage()) fitRight(true); }
      dirty.R = true; again = true;
    }
    // overlays and marker rulers once per frame, after whichever planes were redrawn
    const ov = dirty.L || dirty.R || dirty.OL || dirty.OR;
    const leg = dirty.G || dirty.R; // the legend repaints only when its key or the needle changed
    dirty.G = false;
    if (dirty.L) { dirty.L = false; if (solo() !== 'R') try { renderLeft(); } catch (e) { console.error(e); } }
    if (dirty.R) { dirty.R = false; if (solo() !== 'L') try { renderRight(); } catch (e) { console.error(e); } }
    dirty.OL = dirty.OR = false;
    if (invPaneQ.drew.L && invPaneQ.drew.R) for (const k of ['L', 'R']) if (invPaneQ[k]) invPaneQ[k].share = 0.5;
    invPaneQ.L = invPaneQ.R = null; invPaneQ.drew.L = invPaneQ.drew.R = false;
    if (ov) try { renderOverlays(); } catch (e) { console.error(e); }
    if (leg) try { drawLegend(); } catch (e) { console.error(e); }
    idleReadouts();
    if (dirty.T) {
      dirty.T = false;
      clearTimeout(thumbT);
      thumbT = setTimeout(renderThumbs, 150);
    }
    if (dirty.P) { dirty.P = false; renderProps(); }
    // a shape drag whose frames run over the 60 fps budget twice takes the drag-time mesh cap (baseRes)
    if (drag && (drag.mode === 'handle' || drag.mode === 'move') && !drag.capMesh && performance.now() - frameT0 + frameLag > FRAME_BUDGET_MS + 2) {
      if ((drag.slow = (drag.slow || 0) + 1) >= 2) { drag.capMesh = true; dirty.L = dirty.R = true; again = true; }
    }
    // (a requestRender during this frame may already have asked for the next one: never two frame chains at once)
    if (again && !rafId) { rafId = requestAnimationFrame(frame); rafReqT = performance.now(); }
  }
  // a newly added step plays its own homotopy once, so the change is seen as a deformation
  const trans = { k: 0, t0: 0, dur: 480 };
  function startTransition(k) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !rImage() || morphOn() || rightStage() !== k || !stepActive(k)) return;
    trans.k = k; trans.t0 = performance.now();
    // frame both the start and the end of the deformation, then settle on the result
    paneR.setView(V.right);
    if (rightAuto) Object.assign(V.right, fittedView(paneR, k, [k - 1]));
    requestRender('R');
  }
  function transState() {
    const u = Math.min(1, (performance.now() - trans.t0) / trans.dur);
    const t = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    const k = trans.k, Fprev = stageF(k - 1);
    // a new d/dz step slides from G_{k−1} to G_k along the straight line
    if (isDeriv(k)) return { map: { mode: 1, hi: k, t }, F: lerpF(Fprev, stageF(k), t), u };
    const Ht = homF(k, t);
    return { map: { mode: 1, hi: k, t }, F: (z) => Ht(Fprev(z)), u };
  }
  // smooth view transitions
  const tweens = [];
  function tweenView(view, target, ms = 260, onDone) {
    for (let i = tweens.length - 1; i >= 0; i--) if (tweens[i].view === view) tweens.splice(i, 1);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) { Object.assign(view, target); if (onDone) onDone(); requestRender('L', 'R'); return; }
    tweens.push({ view, from: { cx: view.cx, cy: view.cy, s: view.s }, to: target, t0: performance.now(), ms, onDone });
    requestRender();
  }
  // a view switch lands the plane tweens of X's view at once (they would move the next view's plane otherwise)
  function cancelTweens() {
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      if (tw.view !== S.srcView && tw.view !== V.left) continue;
      Object.assign(tw.view, tw.to); tweens.splice(i, 1); if (tw.onDone) tw.onDone();
    }
  }
  function stepTweens(ts) {
    const now = performance.now();
    for (let i = tweens.length - 1; i >= 0; i--) {
      const tw = tweens[i];
      const u = Math.min(1, (now - tw.t0) / tw.ms);
      const e = 1 - Math.pow(1 - u, 3);
      const ls = Math.log(tw.from.s) + (Math.log(tw.to.s) - Math.log(tw.from.s)) * e;
      tw.view.s = Math.exp(ls);
      tw.view.cx = tw.from.cx + (tw.to.cx - tw.from.cx) * e;
      tw.view.cy = tw.from.cy + (tw.to.cy - tw.from.cy) * e;
      if (u >= 1) { tweens.splice(i, 1); if (tw.onDone) tw.onDone(); }
    }
    dirty.L = true; dirty.R = true;
  }
  // compute a fitted view for a pane without applying it
  function fittedView(pane, k, extraKs, F) {
    const saved = pane.view;
    const tmp = { cx: saved.cx, cy: saved.cy, s: saved.s };
    pane.setView(tmp);
    fitPane(pane, k, extraKs, F);
    pane.setView(saved);
    return tmp;
  }

  // change notifications
  let lastLeftSig = '';
  let chainInfoKey = '';
  // a change that follows another within 150 ms, or comes from a drag, is part of a scrub: MathJax waits for a pause
  let lastChangeT = 0, scrubT = 0;
  function noteChange() {
    const now = performance.now();
    if (drag || now - lastChangeT < 150) { TeX.hush(); scrubT = now; }
    lastChangeT = now;
  }
  function chainChanged(structural) {
    noteChange();
    rebuild();
    if (structural) buildPipeline(); else updateCards();
    if (rightAuto && autoFit()) fitRight();
    const ls = leftStage() + ':' + chainSig[leftStage()];
    if (leftStage() > 0 && leftAuto && ls !== lastLeftSig) { paneL.setView(V.left); fitPane(paneL, leftStage()); }
    lastLeftSig = ls;
    if (morph.open && !morphRange().steps.length) closeTransport();
    scheduleFix();
    updateLeds();
    refreshIntPop();
    requestRender('L', 'R', 'T', 'P');
  }
  function shapesChangedAll(structural) { shapesChanged(structural); }
  function shapesChanged(structural) {
    noteChange();
    if (structural) {
      updateFocusUI();
      buildShapeList();
      updateRegionCard();
    } else { updateShapeList(); updateRegionCard(); }
    if (rightAuto && autoFit()) fitRight();
    scheduleFix();
    refreshIntPop();
    requestRender('L', 'R', 'T');
  }
  // the right plane mode that keeps its own view, fitted to what it shows
  const autoFit = () => rImage();
  function boxView(pane, b) {
    const saved = pane.view, tmp = { cx: saved.cx, cy: saved.cy, s: saved.s };
    pane.setView(tmp);
    if (!pane.fitBox(b, 0.07)) pane.fitBox({ x0: -2, x1: 2, y0: -2, y1: 2 });
    pane.setView(saved);
    return tmp;
  }
  // the deformation's own frame at pane's size (fitRight; the globe's path selection frame)
  function defFitView(pane, withT) {
    let target;
      // the deformation: its start and its end. A start much larger than its end (an unbounded source, the
      // half-plane e^X of a strip at a focused Möbius step) is clipped to 1.5 times the end's box, so H_t(X) does not
      // shrink to a blob in a frame of the source (merged-views review); the Fit button also takes the current H_t
      // (withT)
      const base = S.focus > 0 ? S.focus - 1 : 0;
      const end = S.focus > 0 ? S.focus : nSteps();
      const m = morphLen();
      const xs = [], ys = [], bx = [], by = [];
      stageSamples(stageF(end), xs, ys);
      if (withT && morph.T > 0 && morph.T < m) stageSamples(morphAt(morph.T), xs, ys);
      stageSamples(stageF(base), bx, by);
      const U = robustBox(xs, ys), B = robustBox(bx, by);
      const area = (b) => (b.x1 - b.x0) * (b.y1 - b.y0);
      if (U && B && area(B) > 9 * Math.max(area(U), 1e-12)) {
        const cx = (U.x0 + U.x1) / 2, cy = (U.y0 + U.y1) / 2, hw = 0.75 * (U.x1 - U.x0), hh = 0.75 * (U.y1 - U.y0);
        for (let i = 0; i < bx.length; i++) if (Math.abs(bx[i] - cx) <= hw && Math.abs(by[i] - cy) <= hh) { xs.push(bx[i]); ys.push(by[i]); }
        const b = robustBox(xs, ys) || U;
        const v = { cx: V.right.cx, cy: V.right.cy, s: V.right.s }, keep = pane.view;
        pane.setView(v); pane.fitBox(b, 0.07); pane.setView(keep);
        target = v;
      } else {
        for (let i = 0; i < bx.length; i++) { xs.push(bx[i]); ys.push(by[i]); }
        const b = robustBox(xs, ys);
        target = b ? (() => { const v = { cx: V.right.cx, cy: V.right.cy, s: V.right.s }, keep = pane.view; pane.setView(v); pane.fitBox(b, 0.07); pane.setView(keep); return v; })() : fittedView(pane, end, [base]);
      }
    return target;
  }
  function fitRight(animate, withT) {
    paneR.setView(V.right);
    let target;
    if (morphOn()) target = defFitView(paneR, withT);
    else if (hasTargets()) {
      // the image of the domain and the w-plane targets
      const xs = [], ys = [];
      stageSamples(stageF(rightStage()), xs, ys);
      for (const s of S.targets) {
        if (s.visible === false) continue;
        let b = null;
        try { b = Region.bboxOf(s); } catch (e) { b = null; }
        if (b) { xs.push(b.x0, b.x1); ys.push(b.y0, b.y1); }
        try { for (const [, z] of Region.handlesOf(s)) { xs.push(z.re); ys.push(z.im); } } catch (e) { /* no handles */ }
      }
      target = boxView(paneR, robustBox(xs, ys) || { x0: -2, x1: 2, y0: -2, y1: 2 });
    } else target = fittedView(paneR, rightStage());
    // a refit that would move the view by a few pixels at most (the fit after a drag, from the same shape data) is
    // skipped: its tween frames would be motion frames for nothing (motion-vs-rest, the refit at pointer-up)
    if (animate && fitWithinPx(V.right, target, paneR, 3)) return;
    if (animate) tweenView(V.right, target);
    else Object.assign(V.right, target);
  }
  // whether view b differs from view a by at most px CSS pixels anywhere in the pane (centre shift plus the zoom's
  // move of the pane's corners)
  function fitWithinPx(a, b, pane, px) {
    if (!a || !b || !(a.s > 0) || !(b.s > 0)) return false;
    const half = Math.hypot(pane.w || 0, pane.h || 0) / 2;
    const shift = Math.hypot(b.cx - a.cx, b.cy - a.cy) * a.s;
    return shift + Math.abs(b.s / a.s - 1) * half <= px;
  }
  function setFocus(k) {
    S.focus = k;
    leftAuto = true; rightAuto = true;
    // (Y's split view, put aside by the deformation, is fitted again for the new focus when the deformation closes)
    if (defMem.y) defMem.y.auto = true;
    if (leftStage() > 0) { paneL.setView(V.left); fitPane(paneL, leftStage()); lastLeftSig = leftStage() + ':' + chainSig[leftStage()]; }
    // the deformation starts over for the new focus (or closes when it has nothing to deform)
    morph.T = 0; morph.seg = null;
    if (morph.open && !morphRange().steps.length) closeTransport();
    updateFocusUI();
    // the target group's heading and formulas name Y's variable (wₖ with step k focused, P13)
    if (S.targets && S.targets.length) buildShapeList();
    fitRight();
    scheduleFix();
    refreshIntPop();
    requestRender('L', 'R', 'P');
    save();
  }

  // ---------------- pane titles & option strips ----------------
  // the right plane says what it shows beside its mode control (icon-only below 520px): the whole title when it
  // fits the free head, the math part alone when the role text would be cut short, nothing when even that does not fit
  // Each pane says what it shows after its view control (icon-only below 520px): the whole title when it fits the
  // free head, the math part alone when the role text would be cut short, nothing when even that does not fit (U4: the
  // control comes first, so it never moves when the title changes with the focus)
  function fitTitle(side) {
    const t = $(side === 'L' ? 'leftTitle' : 'rightTitle'), pane = $(side === 'L' ? 'paneL' : 'paneR'), grow = t && t.nextElementSibling;
    if (!t || !grow) return;
    t.classList.remove('terse', 'short'); pane.classList.remove('tiny');
    const tabs = $(side === 'L' ? 'leftTabs' : 'rightTabs');
    // (a view control squeezed by the title, if any, takes its room back first)
    const room = grow.offsetWidth + t.offsetWidth - (tabs ? Math.max(0, tabs.scrollWidth - tabs.clientWidth) : 0);
    if (!(grow.offsetWidth + t.offsetWidth > 0)) return;   // not laid out (hidden plane): measured again on the next resize
    const pt = t.querySelector('.ptitle'), pr = t.querySelector('.prole');
    const ptw = pt ? pt.scrollWidth : 0;
    if (pt && ptw > room) { pane.classList.add('tiny'); return; }
    // the role is shown whole, or in its short form (its first words: "landscape", "phase of F" without the
    // formula), or not at all: it is never cut inside a formula
    if (!pr || room - ptw - 8 >= pr.scrollWidth) return;
    if (pr.querySelector('.rs')) {
      t.classList.add('short');
      if (room - ptw - 8 >= pr.scrollWidth) return;
      t.classList.remove('short');
    }
    t.classList.add('terse');
  }
  function fitRightTitle() { fitTitle('L'); fitTitle('R'); }
  // the words of the landscape's height (S.height)
  const heightHtml = (Fh) => ({ abs: `|${Fh}|`, re: `Re ${Fh}`, im: `Im ${Fh}` }[S.height] || `log|${Fh}|`);
  // the pane titles (panels.md 2): X is the domain of the map in focus, Y its codomain
  function paneTitles() {
    const n = nSteps(), lk = leftStage(), rk = rightStage(), dk = focusDeriv();
    const Fh = fnHtml();
    // the role, with its short form for a narrow head (fitTitle): the words before the formula ("landscape",
    // "phase", "Cauchy integral", "image"), plus ", deforming"
    const T = (t, role) => {
      const m = /^(.*?)( of | over |, after )/.exec(role);
      const short = m ? m[1] + (/, deforming$/.test(role) ? ', deforming' : '') : '';
      return `<span class="ptitle">${t}</span><span class="prole">${short ? `<span class="rf">${role}</span><span class="rs">${short}</span>` : role}</span>`;
    };
    const surfL = lGlobe() ? 'sphere' : 'plane';
    const xName = `${wHtml(lk)}-${surfL}`;
    // (the deformation paints H_t: the title names it, merged-views review)
    const def = '';
    const of = morphOn() && lPaintsF() ? '<i>H</i><sub><i>t</i></sub>' : S.focus === 0 ? '<i>F</i>' : dk ? `${Fh}(<i>z</i>)` : Fh;
    let roleL;
    if (lLand()) roleL = `landscape of ${heightHtml(of)}${S.sheets && !morphOn() && multiSheet() ? ', all sheets' : ''}`;
    else if (lColor() && S.dc === 'cauchy' && !morphOn()) { const cp = typeof cauchyPlot === 'function' ? cauchyPlot() : null; roleL = cp ? `Cauchy integral over ${cp.name}` : 'Cauchy integral'; }
    else if (lPhase()) roleL = `phase of ${of}`;
    else roleL = `domain of ${of}`;
    const left = T(xName, roleL + def);
    let right;
    // (the deformation keeps Y's surface: the arrow form on the plane, the w-sphere's own title on the globe)
    // (one title for the merged plane and the merged globe)
    if (morphOn()) right = T(S.focus === 0 || dk ? `${wHtml(0)} → ${S.focus === 0 ? '<i>w</i>' : wHtml(rk)}` : `${wHtml(lk)} → ${wHtml(rk)}`, 'deformation');
    else if (rGlobe()) right = T(`${S.focus === 0 ? '<i>w</i>' : wHtml(rk)}-sphere`, 'image');
    else if (S.focus === 0) right = T(n ? '<i>w</i> = <i>F</i>(<i>z</i>)' : '<i>w</i> = <i>z</i>', `image, after ${n} step${n === 1 ? '' : 's'}`);
    else if (dk) right = T(`${wHtml(rk)} = d${wHtml(rk - 1)}/d<i>z</i>`, 'image');
    else right = T(`${wHtml(rk)} = <i>f</i>${sub(S.focus)}(${wHtml(lk)})`, 'image');
    return { left, right };
  }
  function updateFocusUI() {
    const t = paneTitles();
    if ($('leftTitle').innerHTML !== t.left) $('leftTitle').innerHTML = t.left;
    if ($('rightTitle').innerHTML !== t.right) $('rightTitle').innerHTML = t.right;
    $('paneL').classList.toggle('no-rulers', !lFlat());
    // (the last active step turned off or removed ends the deformation, and with it the merge)
    if (morph.open && !morphRange().steps.length) { closeTransport(); return; }
    if (Views.merged(S.view, morphOn()) !== layoutMg) applyLayout();
    syncViewControls();
    fitRightTitle();
    $('paneR').classList.toggle('no-rulers', !rImage());
    $('rightFit').hidden = !rImage();
    $('leftFit').hidden = false;
    buildRightFoot();
    for (const c of document.querySelectorAll('.card')) c.classList.toggle('focus', +c.dataset.k === S.focus);
    $('viewAllBtn').setAttribute('aria-pressed', String(S.focus === 0));
    if (setupFormula.refresh) setupFormula.refresh();
    syncEmptyState();
    syncSnapUnit();
    updateToolHint();
    updateLeds();
    drawLegend();
  }
  // segmented controls: mark the selected segment and move the sliding thumb
  function setSeg(el, value) {
    if (!el) return;
    let on = null;
    for (const b of el.children) {
      if (!b.dataset || b.dataset.mode === undefined && b.dataset.v === undefined) continue;
      const sel = (b.dataset.mode ?? b.dataset.v) === String(value);
      b.classList.toggle('on', sel);
      b.setAttribute('aria-checked', String(sel));
      if (sel) on = b;
    }
    if (on) {
      el.style.setProperty('--seg-x', on.offsetLeft + 'px');
      el.style.setProperty('--seg-w', on.offsetWidth + 'px');
    }
  }
  function seg(id, value, options, onchange, label) {
    const el = h('div', { class: 'seg small', id, role: 'radiogroup', 'aria-label': label });
    for (const [v, l, title] of options) {
      el.append(h('button', { 'data-v': v, role: 'radio', title: title || null, onclick: () => { setSeg(el, v); onchange(v); } }, l));
    }
    requestAnimationFrame(() => setSeg(el, value));
    setSeg(el, value);
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      const bs = [...el.children], i = bs.findIndex((b) => b.classList.contains('on'));
      const j = Math.max(0, Math.min(bs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
      bs[j].click(); bs[j].focus(); e.preventDefault();
    });
    return el;
  }
  function selectEl(id, value, options, onchange, title) {
    const sel = h('select', { class: 'sel', id, title, 'aria-label': title, onchange: (e) => onchange(e.target.value) }, ...options.map(([v, l]) => h('option', { value: v }, l)));
    sel.value = value;
    return sel;
  }
  function checkEl(id, checked, label, onchange) {
    const inp = h('input', { type: 'checkbox', id, onchange: (e) => onchange(e.target.checked) });
    inp.checked = !!checked;
    return h('label', { class: 'check' }, inp, h('span', null, label));
  }
  const DC_STYLES = [['enhanced', 'Tiles', 'Conformal tiles: phase sectors and modulus contours form squares'], ['phase', 'Plain', 'Phase only'], ['classic', 'Modulus', 'Brightness from |F|: zeros black, poles white'], ['modulus', 'Contours', 'Level lines of |F| and arg F'], ['grid', 'Grid', 'Pull-back of the Re/Im grid of the image'], ['cauchy', 'Cauchy', 'The Cauchy integral over the selected closed curve: F inside, 0 outside']];
  // the idle hint of a globe (panels.md 3, 9): on an editable globe a drawing tool's drag draws, so the hint names the
  // tool's gesture and how to turn; Select drags shapes and turns on empty space; a tool that does not draw here
  // (Annulus, Sector, Polar grid: the pane chip says so) and a globe that takes no drawing turn with a drag
  function globeHint(side) {
    const TURN = 'Drag to turn; ∞ is at the north pole';
    if (!globeEdit(side) || tool === 'formula' || GLOBE_OFF.has(tool)) return TURN;
    if (tool === 'select') return 'Drag to turn, a shape to move it; ∞ is at the north pole';
    const lab = ((TOOLS.find((t) => t[0] === tool) || [])[1] || '').toLowerCase();
    const tg = side === 'R' ? 'target ' : '';
    const g = tool === 'point' ? `Click to place a ${tg}point` : tool === 'polygon' ? 'Click the vertices'
      : tool === 'curve' ? `Hold and draw a ${tg}curve` : tool === 'lasso' ? `Hold and draw a ${tg}region`
        : `Drag to draw ${tg ? 'a target' : /^[aeiou]/.test(lab) ? 'an' : 'a'} ${lab}`;
    return `${g}; Space or the middle button turns`;
  }
  // the idle left readout: the scale, or how to draw on or turn the globe, or orbit the landscape (which takes no
  // drawing, panels.md 9.1)
  const touchUI = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };
  const idleLeft = () => (lGlobe() ? `<span class="rhint">${globeHint('L')}</span>`
    : lLand() ? `<span class="rhint">${tool !== 'select' && tool !== 'formula' ? 'Draw in X → Y (1)' : touchUI() ? 'Drag to orbit, pinch to zoom' : 'Drag to orbit, Shift-drag to pan'}</span>` : rk('', paneL ? scaleText(paneL) : ''));
  // the idle right readout: the scale, a drawing hint, or how to draw on or turn the w-globe (a short hint in Archivo)
  function idleRight() {
    const v = rGlobe() ? { hint: globeHint('R') }
      : targetsEditable() && tool !== 'select' && tool !== 'formula' ? { hint: `Draw a target in the ${yHtml()}-plane` } : scaleText(paneR);
    return v && v.hint ? `<span class="rhint">${v.hint}</span>` : rk('', v);
  }
  function scaleText(pane) { return pane ? `${CX.fmtNum(Axes.niceStep(110 / pane.view.s), 4).replace('-', '−')} / div` : ''; }
  // Mode options (spec 5.8): one 32px row. Controls that do not fit beside the view stack move, in order, behind
  // a sliders button into a popover; on a phone all of them do. The deformation transport always stays inline.
  const phoneMQ = matchMedia('(max-width: 767px)');
  // one options strip per pane (U-b, panels.md 4): foot.L in X, foot.R in Y
  const footOf = () => ({ kids: [], widths: null, n: -1, w: -1, phone: null, pop: null });
  const foot = { L: footOf(), R: footOf() };
  phoneMQ.addEventListener('change', () => { if (S && paneR) layoutFoot(true); });
  function layoutFoot(force) { layoutFootSide('L', force); layoutFootSide('R', force); }
  function layoutFootSide(side, force) {
    const f = $(side === 'L' ? 'leftFoot' : 'rightFoot'), ft = foot[side], pane = side === 'L' ? paneL : paneR;
    if (!f || !pane || !ft.kids.length) return;
    const phone = phoneMQ.matches;
    if (!force && ft.w === pane.w && ft.phone === phone) return;
    let n = ft.kids.length;
    if (phone) n = 0;
    else {
      if (!ft.widths) {
        // natural widths, measured once per build with every control inline on one row
        if (f.childElementCount !== ft.kids.length || [...f.children].some((c, i) => c !== ft.kids[i])) f.replaceChildren(...ft.kids);
        f.classList.add('measuring');
        const ws = ft.kids.map((c) => c.getBoundingClientRect().width);
        f.classList.remove('measuring');
        if (ws.some((x) => !(x > 0))) { ft.n = n; return; } // plane not shown: keep everything inline for now
        ft.widths = ws;
      }
      const avail = pane.w - 60, gap = 8, pad = 10, btn = 24 + gap;
      let used = pad;
      for (n = 0; n < ft.kids.length; n++) {
        const next = used + (n ? gap : 0) + ft.widths[n];
        const more = n + 1 < ft.kids.length ? btn : 0;
        if (next + more > avail) break;
        used = next;
      }
    }
    ft.w = pane.w; ft.phone = phone;
    if (n === ft.n && !force) return;
    ft.n = n;
    const rest = ft.kids.slice(n);
    let b = null;
    if (rest.length) {
      b = h('button', { class: 'icon-btn opts-btn', 'data-tip': 'Display options', 'aria-label': 'Display options', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', html: ICONS.sliders });
      b.addEventListener('click', () => openFootPop(b, false, side));
    }
    const open = ft.pop && ft.pop.isConnected;
    f.replaceChildren(...ft.kids.slice(0, n), ...(b ? [b] : []));
    f.classList.toggle('collapsed', !n);
    if (open) { if (b) openFootPop(b, true, side); else closePalette(); }
  }
  function openFootPop(btn, refresh, side = 'R') {
    const ft = foot[side];
    if (!refresh && ft.pop && ft.pop.isConnected) { closePalette(); btn.focus(); return; } // anchor re-click closes
    closePalette();
    const rest = ft.kids.slice(ft.n);
    const pop = h('div', { class: 'pop opts-pop', role: 'dialog', 'aria-label': 'Display options' }, ...rest);
    $('popHost').append(pop);
    popEl = pop; ft.pop = pop;
    btn.setAttribute('aria-expanded', 'true');
    for (const s of pop.querySelectorAll('.seg')) { const on = s.querySelector(':scope > .on'); if (on) setSeg(s, on.dataset.v ?? on.dataset.mode); }
    // a segmented row wider than the popover (a phone): the chosen segment in view, and a fade where more follows
    for (const s of pop.querySelectorAll(':scope > .seg')) {
      if (s.scrollWidth <= s.clientWidth + 1) continue;
      const on = s.querySelector(':scope > .on');
      if (on) s.scrollLeft = Math.max(0, Math.min(s.scrollWidth - s.clientWidth, on.offsetLeft + on.offsetWidth / 2 - s.clientWidth / 2));
      const edge = () => { s.classList.toggle('more-l', s.scrollLeft > 1); s.classList.toggle('more-r', s.scrollLeft + s.clientWidth < s.scrollWidth - 1); };
      edge();
      s.addEventListener('scroll', edge, { passive: true });
    }
    // the strip sits at the bottom of the plot: open upward over the plot, below only when there is no room
    const r = btn.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    const x0 = (btn.closest('.options') || btn).getBoundingClientRect().left; // above the strip, clear of the view stack
    let y = r.top - ph - 6;
    if (y < 12) y = Math.max(12, Math.min(window.innerHeight - ph - 12, r.bottom + 6));
    pop.dataset.side = y < r.top ? 'top' : 'bottom';
    pop.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, x0)) + 'px';
    pop.style.top = y + 'px';
    const mo = new MutationObserver(() => { if (!pop.isConnected) { btn.setAttribute('aria-expanded', 'false'); mo.disconnect(); } });
    mo.observe($('popHost'), { childList: true });
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); closePalette(); btn.focus(); } });
    if (!refresh) { const first = pop.querySelector('button, input, select'); if (first) first.focus({ preventScroll: true }); }
    armOutside(btn);
  }
  // the focused map has a multivalued step the Landscape can show all sheets of (GLR.sheetInfo): {infinite} or null
  function multiSheet() {
    if (!GLR.ok || typeof GLR.sheetInfo !== 'function') return null;
    try { return GLR.sheetInfo(endMap(), S.sheetW || 2) || null; } catch (e) { return null; }
  }
  // the All sheets check: with more sheet combinations than the landscape draws (GLR caps them), "24 of 30"
  function sheetsLabel(lab, ms) {
    const span = lab && lab.querySelector('span');
    if (!span) return lab;
    const capped = !!(S.sheets && ms && ms.total > ms.K);
    span.textContent = capped ? `All sheets (${ms.K} of ${ms.total})` : 'All sheets';
    if (capped) lab.dataset.tip = `${ms.K} of the ${ms.total} surfaces are drawn (at most ${ms.K}).`; else delete lab.dataset.tip;
    return lab;
  }
  function setSheets(on) {
    S.sheets = !!on;
    // the sheets of a root share |F|: they separate in Re F and Im F
    if (on && (S.height === 'log' || S.height === 'abs')) { S.height = 'im'; toast(`All sheets: the height is now Im ${fnText()}, where the sheets come apart (a modulus height stacks them).`); }
    buildRightFoot(); updateFocusUI(); requestRender('L'); save();
  }
  // both panes' options strips (the name is kept from when only the right pane had one)
  function buildRightFoot() { buildFoot('L'); buildFoot('R'); buildDock(); setReadouts(probe); }
  // X's paint changed (style, sectors, grid step): X redraws, and Y too while it shows the colour key
  const paintChanged = () => requestRender('L', wKeyOn() ? 'R' : null, 'T');
  function buildFoot(side) {
    const f = $(side === 'L' ? 'leftFoot' : 'rightFoot');
    if (!f) return;
    f.innerHTML = '';
    f.className = 'options';
    const ft = foot[side];
    ft.kids = []; ft.widths = null; ft.n = -1;
    if (side === 'L') { buildFootL(f); f.hidden = !f.children.length; ft.kids = [...f.children]; layoutFootSide('L', true); drawLegend(); return; }
    const resetCam = (c, d) => h('button', { class: 'icon-btn small', title: 'Reset camera', 'aria-label': 'Reset camera', html: ICONS.orbit, onclick: () => tweenCam(c, d) });
    const Fn = fnText();
    if (morphOn() && rImage()) {
      // (the merged deformation plane: no options of its own; the transport is docked under it)
    } else if (rImage()) {
      if (lFlat()) f.append(checkEl('fovChk', S.fov !== false, 'View outline', (v) => { S.fov = v; requestRender('R'); drawLegend(); save(); }));
      // the phase colour key under the images: X's portrait colours of the identity, so a colour in Phase reads off
      // as a value in Y (its one switch, merged-views review)
      if (wKeyAvail()) { const kl = checkEl('wKeyChkR', !!S.wKey, 'Phase key', (v) => { S.wKey = v; buildRightFoot(); drawLegend(); requestRender('R'); save(); }); kl.dataset.tip = `The phase colours of the ${yHtml()}-plane under the images`; f.append(kl); }
    } else if (rGlobe()) {
      f.append(
        checkEl('eqChkR', S.view.R.eq, 'Equator', (v) => { S.view.R.eq = v; requestRender('R'); save(); }),
        resetCam(camS, CAMS));
      tipEq(f);
    }
    f.hidden = !f.children.length;
    ft.kids = [...f.children]; layoutFootSide('R', true);
    drawLegend();
  }
  // the deformation transport (spec 6.11; merged-views.md: docked at the bottom of the view's panel, under the plot):
  // play, the scrubber with a tick per step, t, speed, the path, Loop and Paths; x turns the deformation off
  function buildDock() {
    const side = S.view.main === 'xy' ? 'R' : 'L';
    for (const sd of ['L', 'R']) {
      const d = $(sd === 'L' ? 'tdockL' : 'tdockR');
      if (!d) continue;
      const on = morph.open && sd === side;
      if (d.hidden === on) d.hidden = !on;
      if (!on) { if (d.firstChild) d.replaceChildren(); continue; }
      d.replaceChildren();
      const f = d;

      // the deformation transport (spec 6.11), in every view: play, the scrubber with a tick per step (one for all
      // steps at once), t, speed, the order of the steps (two or more), Loop and the Paths toggle (P); × closes it
      // and the view returns to t = end
      const m = morphLen(), nSt = morphRange().steps.length, hasD = morphHasDeriv();
      const play = h('button', { class: 'icon-btn play', id: 'morphPlay', title: morph.playing ? 'Pause' : 'Play', 'aria-label': morph.playing ? 'Pause' : 'Play', html: morph.playing ? ICONS.pause : ICONS.play, onclick: () => togglePlay() });
      const rng = h('input', { type: 'range', id: 'morphRange', min: 0, max: Math.max(m, 0.001), step: 0.001, value: morph.T, 'aria-label': 'Deformation time',
        oninput: (e) => { let v = +e.target.value; const r = Math.round(v); if (Math.abs(v - r) < 0.03) v = r; morph.T = v; morph.seg = null; morph.u = 0; morph.playing = false; setPlayIcon(); paintFader(e.target); scheduleFix(); requestRender('R', lPaintsF() ? 'L' : null); } });
      const ticks = h('div', { class: 'tticks', 'aria-hidden': 'true' });
      if (allAtOnce()) {
        const ks = morphRange().steps;
        ticks.append(h('span', { class: 'ttick', style: 'left:50%', html: `<i>f</i>${sub(ks[0])}, …, <i>f</i>${sub(ks[ks.length - 1])} at once` }));
      } else morphRange().steps.forEach((k, i) => ticks.append(h('span', { class: 'ttick', style: `left:${(i + 0.5) / Math.max(1, m) * 100}%`, html: isDeriv(k) ? 'd/d<i>z</i>' : `<i>f</i>${sub(k)}` })));
      // the order of the steps (two or more): one after another (t in [0, m]) or all at once (t in [0, 1])
      let order = null;
      if (nSt > 1) {
        order = selectEl('homOrderSel', allAtOnce() ? 'all' : 'steps', [['steps', 'One after another'], ['all', 'All at once']], (v) => setHomAll(v === 'all'), 'Deformation: the steps one after another or all at once');
        if (hasD) { order.disabled = true; order.value = 'steps'; order.dataset.tip = 'd/dz is not a map: its step deforms on its own, so the steps run one after another'; }
      }
      f.append(play, h('div', { class: 'tscrub' }, rng, ticks), h('span', { class: 'tread mono', id: 'morphLabel' }, `t = ${morph.T.toFixed(2)} / ${m}`),
        seg('speedSeg', String(S.morphSecs), [['3.2', '0.5×'], ['1.6', '1×'], ['0.8', '2×']], (v) => { S.morphSecs = +v; save(); }, 'Speed'),
        ...(order ? [order] : []),
        checkEl('loopChk', S.loop !== false, 'Loop', (v) => { S.loop = v; save(); }),
        // (the paths t -> H_t(z) are drawn in the merged deformation plane and on its globe)
        ...(side === 'R' ? [pathsToggle(hasD)] : []),
        h('button', { class: 'icon-btn tclose', 'data-tip': 'Deformation off  M', 'aria-label': 'Turn the deformation off', html: ICONS.close, onclick: () => { closeTransport(); const b = $('morphBtn'); if (b) b.focus({ preventScroll: true }); } }));
      paintFader(rng);
    }
  }
  // the Paths toggle of the deformation (key P while the deformation shows in X → Y; the palette): the live paths
  // t -> H_t(z) on the merged plane and globe, remembered in the saved state, and the figure's default
  // (with a d/dz in the range no paths are drawn: the toggle is disabled and says why, as the order select)
  function pathsToggle(hasD = morphHasDeriv()) {
    const on = S.morphPaths !== false;
    const b = h('button', { class: 'phbtn tpaths', id: 'pathsBtn', type: 'button', 'aria-pressed': String(on && !hasD), 'data-tip': `${on ? 'Hide' : 'Show'} the paths t ↦ H_t(z)  P`, html: `${ICONS.paths}<span>Paths</span>`, onclick: () => setMorphPaths(!(S.morphPaths !== false)) });
    if (hasD) { b.disabled = true; b.dataset.tip = 'd/dz is not a map, so there are no paths t ↦ H_t(z) to draw'; }
    return b;
  }
  function setMorphPaths(on) {
    S.morphPaths = !!on;
    const b = $('pathsBtn');
    if (b) { b.setAttribute('aria-pressed', String(!!on)); b.dataset.tip = `${on ? 'Hide' : 'Show'} the paths t ↦ H_t(z)  P`; }
    requestRender('R'); drawLegend(); save();
  }
  // one after another <-> all at once: the same moment of the deformation, rescaled to the new range of t
  function setHomAll(all) {
    const before = morphLen();
    S.homAll = !!all;
    const after = morphLen();
    if (morph.open && before !== after) { morph.T = morph.T * after / before; morph.seg = null; morph.u = 0; }
    else if (!morph.open) morph.T = after;
    buildDock(); scheduleFix(); requestRender('R', lPaintsF() ? 'L' : null); save();
  }
  const resetCamBtn = (c, d) => h('button', { class: 'icon-btn small', title: 'Reset camera', 'aria-label': 'Reset camera', html: ICONS.orbit, onclick: () => tweenCam(c, d) });
  // the Equator checkbox's tooltip (P2: formerly "Plane")
  function tipEq(f) { const l = f.querySelector('label.check:has(> input[id^="eqChk"])'); if (l) l.dataset.tip = 'Equatorial plane and projection ray'; }
  // X's strip (panels.md 4): the paint's part (Phase on: style, n, Δ, Outlines), then the surface's part (Sphere:
  // Equator, Reset camera; Landscape: height, sheets, scale, unit level, view, Reset camera). X Plane with Phase off
  // has none (the strip hides).
  function buildFootL(f) {
    const Fn = fnText();
    // the Landscape view (merged-views.md): its height, then its colouring in one control: the phase colours the relief
    // can paint (Tiles, Plain) or plaster. Plain on the relief is S.landPlain, so the portrait keeps its own style (P10)
    if (lLand()) {
      const paint = !S.view.D.phase ? 'plaster' : landMaterial() === 'phase' ? 'phase' : 'tiles';
      f.append(
        seg('heightSeg', S.height, [['log', `log |${Fn}|`], ['abs', `|${Fn}|`], ['re', `Re ${Fn}`], ['im', `Im ${Fn}`]], (v) => { S.height = v; updateFocusUI(); requestRender('L'); save(); }, 'Height'),
        seg('landPaint', paint, [['tiles', 'Tiles', 'Phase colours with modulus contours'], ['phase', 'Plain', 'Phase colours only'], ['plaster', 'Plaster', 'The relief alone, lit']], (v) => {
          S.view.D.phase = v !== 'plaster';
          if (v === 'phase') S.landPlain = S.dc !== 'phase';
          else if (v === 'tiles') { S.landPlain = false; if (S.dc === 'phase') S.dc = 'enhanced'; }
          buildRightFoot(); updateFocusUI(); paintChanged(); save();
        }, 'Colouring'));
    }
    if (lPhase()) {
      const land = lLand();
      if (!land) f.append(seg('dcSeg', S.dc, DC_STYLES, (v) => { S.dc = v; S.landPlain = false; buildRightFoot(); updateFocusUI(); paintChanged(); save(); }, 'Phase style'));
      if (S.dc === 'cauchy' && lColor()) {
        const cp = cauchyPlot(), Fh = fnHtml();
        f.append(h('span', { class: 'foot-note', html: cp ? `(1/2π<i>i</i>) ∮ ${Fh}(<i>ζ</i>)/(<i>ζ</i> − <i>z</i>) d<i>ζ</i> over ${cp.name}: ${Fh} inside, 0 outside` : 'Select a closed curve or a bounded region: its Cauchy integral is shown.' }));
      }
      f.append(h('div', { class: 'scrub' }, h('span', { class: 'pl' }, 'n'), selectEl('secSel', String(S.sectors || 12), [['8', '8'], ['12', '12'], ['16', '16'], ['24', '24']], (v) => { S.sectors = +v; paintChanged(); drawLegend(); save(); }, 'Phase sectors')));
      if (S.dc === 'grid' && !land) f.append(h('div', { class: 'scrub' }, h('span', { class: 'pl' }, 'Δ'), selectEl('dcGridSel', String(S.dcGrid), [['0.1', '0.1'], ['0.25', '0.25'], ['0.5', '0.5'], ['1', '1'], ['2', '2']], (v) => { S.dcGrid = +v; paintChanged(); save(); }, 'Grid step')));
      if (lColor()) f.append(checkEl('outlineChk', S.outline, 'Outlines', (v) => { S.outline = v; requestRender('L'); save(); }));
    }
    if (lGlobe()) {
      f.append(checkEl('eqChkL', xView().eq, 'Equator', (v) => { xView().eq = v; requestRender('L'); save(); }), resetCamBtn(camL, CAML));
      tipEq(f);
    } else if (lLand()) {
      // All sheets: the whole covering surface of a multivalued map (a window of 2W + 1 sheets for log and
      // irrational powers)
      const ms = multiSheet();
      f.append(
        ...(ms ? [sheetsLabel(checkEl('sheetsChk', S.sheets, 'All sheets', (v) => setSheets(v)), ms)] : []),
        ...(ms && S.sheets && ms.infinite ? [h('div', { class: 'scrub', 'data-tip': 'Sheets shown on each side of the principal one' }, h('span', { class: 'pl' }, 'sheets ±'), selectEl('sheetWSel', String(S.sheetW || 2), [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']], (v) => { S.sheetW = +v; const c = $('sheetsChk'); if (c) sheetsLabel(c.closest('label'), multiSheet()); requestRender('L'); save(); }, 'Sheets on each side'))] : []),
        h('label', { class: 'fader-row compact' }, h('span', { class: 'fl' }, 'Scale'), h('input', { type: 'range', id: 'lscaleRange', min: 0.25, max: 2, step: 0.05, value: S.lscale || 1, 'aria-label': 'Height scale', oninput: (e) => { S.lscale = +e.target.value; requestRender('L'); save(); } })),
        checkEl('unitLevelChk', S.unitLevel, 'Unit level', (v) => { S.unitLevel = v; requestRender('L'); save(); }),
        seg('viewSeg', '', [['iso', '3/4'], ['top', 'Top'], ['front', 'Front']], (v) => tweenCam(cam, { iso: { yaw: -38 * DEG, pitch: 30 * DEG }, top: { yaw: -90 * DEG, pitch: 88 * DEG }, front: { yaw: -90 * DEG, pitch: 8 * DEG } }[v]), 'View'),
        resetCamBtn(cam, CAM3));
    }
  }
  // The deformation plane has its own view (merged-views review: it shared Y's, so zooms leaked both ways): Y's split
  // view is put aside while the deformation shows and restored when it closes; the deformation's own view is kept
  // between openings for the same chain, focus and path, and fitted to X and its images the first time.
  const defMem = { y: null, d: null, dkey: '' };
  const defKey = () => JSON.stringify([chainSig[nSteps()], S.focus, !!S.homAll, S.shapes.filter((s) => s.visible !== false).length]);
  // the deformation transport: open, it plays the homotopy from t = 0 in the current view; closed, t = end
  function openTransport() {
    if (!morphRange().steps.length) { toast('Add a function to the chain to see its deformation.'); return; }
    if (typeof cancelTweens === 'function') cancelTweens();
    defMem.y = { v: { cx: V.right.cx, cy: V.right.cy, s: V.right.s }, auto: rightAuto };
    const mem = defMem.d && defMem.dkey === defKey() ? defMem.d : null;
    if (mem) { Object.assign(V.right, mem.v); rightAuto = mem.auto; } else rightAuto = true;
    morph.open = true;
    morph.T = 0; morph.seg = null; morph.u = 0; morph.hold = 0; morph.last = 0;
    morph.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (draft && draft.target) draft = null;
    setHoverW(null); rHover = null;
    // (X → Y: the panes merge into one plane, merged-views.md; the plane is fitted once its new width is known)
    applyLayout();
    if (rightAuto && rImage()) { paneR.resize(); fitRight(); }
    updateFocusUI(); scheduleFix(); requestRender('L', 'R');
  }
  function closeTransport() {
    if (!morph.open) return;
    if (typeof cancelTweens === 'function') cancelTweens();
    defMem.d = { v: { cx: V.right.cx, cy: V.right.cy, s: V.right.s }, auto: rightAuto }; defMem.dkey = defKey();
    morph.open = false; morph.playing = false; morph.seg = null;
    morph.T = morphLen();
    if (defMem.y) { Object.assign(V.right, defMem.y.v); rightAuto = defMem.y.auto; defMem.y = null; }
    applyLayout();
    if (rightAuto && rImage()) { paneR.resize(); fitRight(); }
    updateFocusUI(); scheduleFix(); requestRender('L', 'R');
  }
  const toggleTransport = () => (morph.open ? closeTransport() : openTransport());
  function setPlayIcon() {
    const b = $('morphPlay');
    if (!b) return;
    b.innerHTML = morph.playing ? ICONS.pause : ICONS.play;
    b.title = morph.playing ? 'Pause' : 'Play';
    b.setAttribute('aria-label', b.title);
  }
  // phase color as in the shaders (OKLCH wheel, arg 0 = red)
  function oklchRGB(L, Cc, hh) {
    const a = Cc * Math.cos(hh), b = Cc * Math.sin(hh);
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ ** 3, m = m_ ** 3, s2 = s_ ** 3;
    const lin = [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s2, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s2, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s2];
    return lin.map((c) => { c = Math.min(1, Math.max(0, c)); return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); });
  }
  let legendNeedle = null, legendMod = null;
  const WHEEL_STOPS = ['#F58C7E', '#EA9853', '#CFA93E', '#A5B953', '#6EC580', '#27C8AF', '#1CC3D8', '#53B8F7', '#8EAAFD', '#B99BF5', '#DB8FD6', '#F089AC'];
  // The legend's static part (ring, strip, words) is painted once per look into an offscreen canvas; a probe move
  // only blits it and draws the needle and the modulus tick, on the next frame (requestRender('G')).
  const WHEEL_RGB = WHEEL_STOPS.map((c) => GLR.hexRGB(c));
  const LEG = { W: 136, H: 72, dpr: 2, cx: 42, cy: 36, R: 24, r0: 14, sx: 80, sy: 30, sw: 48, sh: 8 };
  // one legend chip per pane (U-b): X's colour key while Phase is on (wheel and modulus strip; the landscape's
  // height), Y Plane's pattern key. legendKind(side): 'color' | 'sphere' | '3d' (X) | 'image' (Y) | null
  const legendState = { L: { key: '', drawn: '', cv: null, strip: false }, R: { key: '', drawn: '', cv: null, strip: false } };
  function legendKind(side) {
    if (!GLR.ok) return null;
    if (side === 'R') return rImage() ? 'image' : null;
    if (!lPhase()) return null;
    return lLand() ? '3d' : lGlobe() ? 'sphere' : 'color';
  }
  function legendWanted(side = 'R') { return !!legendKind(side); }
  function drawLegend() { drawLegendSide('L'); drawLegendSide('R'); }
  function drawLegendSide(side) {
    const box = $(side === 'L' ? 'leftLegend' : 'rightLegend');
    const cv = $(side === 'L' ? 'legendCanvasL' : 'legendCanvas');
    if (!box || !cv) return;
    // no legend without WebGL: the plane shows nothing it could explain
    const kind = legendKind(side);
    const want = !!kind;
    if (box.hidden === want) box.hidden = !want;
    // (the folded chip on a phone shows a glyph of its key: the hue wheel, arg increasing counterclockwise from red at
    // 1, or a checker for the Pattern key)
    if (kind && box.dataset.kind !== kind) {
      box.dataset.kind = kind;
      if (!box.style.getPropertyValue('--wheel')) box.style.setProperty('--wheel', `conic-gradient(from 90deg, ${[0, ...WHEEL_STOPS.map((_, i) => 12 - i).slice(1), 12].map((i) => WHEEL_STOPS[i % 12]).join(', ')})`);
    }
    if (side === 'L') {
      // the Key switch: X's colour key painted in the Y plane (the user's decision for item 1: not a view of Y)
      const ks = $('wKeyRow');
      // (merged-views review: the key shows only in X → Y, so its switch is the "Phase key" check in Y's strip)
      const showKey = false;
      if (ks && ks.hidden === showKey) ks.hidden = !showKey;
      const kc = $('wKeyChk');
      if (kc && kc.checked !== !!S.wKey) kc.checked = !!S.wKey;
      // (in Y's variable, P13)
      const kl = ks && ks.querySelector('span'), kt = `Key in the ${yHtml()}-plane`;
      if (kl && kl.innerHTML !== kt) kl.innerHTML = kt;
    }
    if (!want) return;
    const st = legendState[side];
    const { W, H: Hh, dpr } = LEG;
    if (cv.width !== W * dpr) { cv.width = W * dpr; cv.height = Hh * dpr; st.drawn = ''; }
    const img = kind === 'image';
    const k = rightStage();
    const anyCut = img && built.some((b, i) => i < k && S.steps[i] && S.steps[i].on !== false && b && !b.error && b.cuts.some((c) => c.kind === 'ray'));
    const key = [kind, S.dc, S.sectors, S.height, S.pattern, img ? patternCell() : '', anyCut, S.fov, lFlat(), morphOn(), S.morphPaths !== false, fnText(), TH.ink, TH.plane, TH.lineStrong, document.fonts ? document.fonts.status : ''].join('|');
    if (st.key !== key || !st.cv) {
      if (!st.cv) st.cv = document.createElement('canvas');
      const off = st.cv;
      off.width = W * dpr; off.height = Hh * dpr;
      const octx = off.getContext('2d');
      octx.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintLegend(octx, anyCut, kind, st);
      st.key = key; st.drawn = '';
    }
    const dyn = img ? '' : `${legendNeedle == null ? '' : legendNeedle.toFixed(3)}|${legendMod == null ? '' : legendMod.toPrecision(4)}`;
    if (st.drawn === key + dyn) return;
    st.drawn = key + dyn;
    const ctx = cv.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, cv.width, cv.height);
    ctx.drawImage(st.cv, 0, 0);
    if (img) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const { cx, cy, R, sx, sy, sw, sh } = LEG;
    if (legendNeedle != null) {
      ctx.strokeStyle = TH.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(legendNeedle) * R, cy - Math.sin(legendNeedle) * R); ctx.stroke();
    }
    if (st.strip && legendMod != null && Number.isFinite(legendMod) && legendMod > 0) {
      const q = TAU / (S.sectors || 12);
      const f = ((Math.log(legendMod) / q) % 3 + 3) % 3;
      const mx = sx + f / 3 * sw;
      ctx.strokeStyle = TH.ink; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx, sy - 2); ctx.lineTo(mx, sy + sh + 2); ctx.stroke();
    }
  }
  function paintLegend(ctx, anyCut, kind, st) {
    const { W, H: Hh } = LEG;
    ctx.clearRect(0, 0, W, Hh);
    ctx.textBaseline = 'middle';
    st.strip = false;
    if (kind === 'image') {
      // pattern key: the cell size in z, plus markers present in the plane
      ctx.font = `600 11px ${TH.ui}`; ctx.fillStyle = TH.ink2; ctx.textAlign = 'left';
      if (S.pattern === 'stretch') {
        // the local scale ramp: blue shrinks, amber grows
        ctx.fillText('Scale |F′|', 8, 13);
        const g = ctx.createLinearGradient(8, 0, 128, 0);
        g.addColorStop(0, TH.stretchShrink); g.addColorStop(0.5, TH.stretchMid); g.addColorStop(1, TH.stretchGrow);
        ctx.fillStyle = g; ctx.fillRect(8, 22, 120, 8);
        ctx.strokeStyle = TH.lineStrong; ctx.lineWidth = 1; ctx.strokeRect(8.5, 22.5, 119, 7);
        ctx.font = `10px ${TH.mono}`; ctx.fillStyle = TH.muted;
        ctx.textAlign = 'left'; ctx.fillText('×⅛', 8, 40); ctx.textAlign = 'center'; ctx.fillText('1', 68, 40); ctx.textAlign = 'right'; ctx.fillText('×8', 128, 40);
        ctx.textAlign = 'left';
      } else {
        ctx.fillText('Pattern', 8, 13);
        // "cell 0.5 in z" as one run: words in Archivo, the number in B612 Mono, z in STIX italic
        let x = 8;
        const run = (t, font, color) => { ctx.font = font; ctx.fillStyle = color; ctx.fillText(t, x, 30); x += ctx.measureText(t).width; };
        if (S.pattern === 'sphere') {
          // the spherical checker has no cell size in z: its longitude x latitude cells of the Riemann sphere (SPEC 6.3)
          run(`${sphN()} × ${sphN() / 2}`, `11px ${TH.mono}`, TH.ink);
          run(' cells of the sphere', `11px ${TH.ui}`, TH.muted);
        } else {
          run('cell ', `11px ${TH.ui}`, TH.muted);
          run(CX.fmtNum(patternCell(), 4).replace('-', '−'), `11px ${TH.mono}`, TH.ink);
          run(' in ', `11px ${TH.ui}`, TH.muted);
          run('z', `italic 500 12px ${TH.math}`, TH.muted);
        }
      }
      // only marks that this plane actually draws
      let y = 52;
      ctx.font = `11px ${TH.ui}`; ctx.lineWidth = 1;
      if (anyCut) { ctx.strokeStyle = TH.cut; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(24, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = TH.muted; ctx.fillText('image of a cut', 30, y); y += 15; }
      // the merged deformation plane: what grey is (X, the start) and what the lines are (the paths t -> H_t(z)), in
      // the rows the view outline uses in X → Y (merged-views review: the chip's lower half was blank)
      if (morphOn()) {
        const run = (t, font, color, x, yy) => { ctx.font = font; ctx.fillStyle = color; ctx.fillText(t, x, yy); return x + ctx.measureText(t).width; };
        if (y < 68) {
          // (at a focused step after the first, the start is the dashed outline of the step's source, renderMorph)
          if (S.focus <= 1) { ctx.fillStyle = TH.ink; ctx.globalAlpha = 0.16; ctx.fillRect(8, y - 5, 16, 10); ctx.globalAlpha = 1; ctx.strokeStyle = TH.faint; ctx.strokeRect(8.5, y - 4.5, 15, 9); run('X', `italic 500 12px ${TH.math}`, TH.muted, 30, y); }
          else { ctx.strokeStyle = TH.faint; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(24, y); ctx.stroke(); ctx.setLineDash([]); run('start', `11px ${TH.ui}`, TH.muted, 30, y); }
          y += 15;
        }
        if (y < 72 && S.morphPaths !== false && !morphHasDeriv()) {
          ctx.strokeStyle = TH.muted; ctx.lineWidth = 1.25; ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(23, y); ctx.moveTo(19.5, y - 3); ctx.lineTo(23.5, y); ctx.lineTo(19.5, y + 3); ctx.stroke();
          let x = run('t', `italic 500 12px ${TH.math}`, TH.muted, 30, y);
          x = run(' ↦ ', `11px ${TH.ui}`, TH.muted, x, y);
          x = run('H', `italic 500 12px ${TH.math}`, TH.muted, x, y);
          x = run('t', `italic 500 9px ${TH.math}`, TH.muted, x, y + 3);
          x = run('(', `12px ${TH.math}`, TH.muted, x, y);
          x = run('z', `italic 500 12px ${TH.math}`, TH.muted, x, y);
          run(')', `12px ${TH.math}`, TH.muted, x, y);
        }
        return;
      }
      if (S.fov !== false && lFlat() && y < 68) { ctx.strokeStyle = TH.fov; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(8, y); ctx.lineTo(24, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = TH.muted; ctx.fillText('left view', 30, y); }
      return;
    }
    // hue ring: arg increases counterclockwise from red at 1
    const { cx, cy, R, r0, sx, sy, sw, sh } = LEG;
    for (let i = 0; i < 360; i++) {
      const a0 = i * DEG, a1 = (i + 1.5) * DEG;
      const f = i / 30, k = Math.floor(f) % 12, t = f - Math.floor(f);
      const c0 = WHEEL_RGB[k], c1 = WHEEL_RGB[(k + 1) % 12];
      ctx.fillStyle = `rgb(${c0.map((v, j) => Math.round(255 * (v + (c1[j] - v) * t))).join(',')})`;
      ctx.beginPath(); ctx.arc(cx, cy, R, -a0, -a1, true); ctx.arc(cx, cy, r0, -a1, -a0, false); ctx.fill();
    }
    ctx.strokeStyle = TH.lineStrong; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.beginPath(); ctx.arc(cx, cy, r0, 0, TAU); ctx.stroke();
    // labels outside the ring, "−1" right-aligned so it ends 3px from the ring and starts inside the chip
    ctx.font = `italic 500 11px ${TH.math}`; ctx.fillStyle = TH.ink2;
    ctx.textAlign = 'left'; ctx.fillText('1', cx + R + 3, cy);
    ctx.textAlign = 'right'; ctx.fillText('−1', cx - R - 3, cy);
    ctx.textAlign = 'center'; ctx.fillText('i', cx, cy - R - 6); ctx.fillText('−i', cx, cy + R + 7);
    const n = S.sectors || 12;
    // one right-aligned run: words in Archivo, the variables (F, F′, w) in STIX italic as on the ring
    // (H with a subscript t, the deformation's map: H in STIX italic, t a smaller italic below the baseline)
    const caption = (t) => {
      const parts = t.split(/(Hₜ|F′|F|(?<![A-Za-z])[wf](?![A-Za-z]))/).filter(Boolean).flatMap((p) => (p === 'Hₜ' ? [['H', `italic 500 12px ${TH.math}`, 0], ['t', `italic 500 9px ${TH.math}`, 3]] : [[p, /^(F′?|w|f)$/.test(p) ? `italic 500 12px ${TH.math}` : `600 10.5px ${TH.ui}`, 0]]));
      let x = LEG.W - 8;
      for (const [p, f] of parts) { ctx.font = f; x -= ctx.measureText(p).width; }
      ctx.fillStyle = TH.ink2; ctx.textAlign = 'left';
      for (const [p, f, dy] of parts) { ctx.font = f; ctx.fillText(p, x, 62 + dy); x += ctx.measureText(p).width; }
    };
    // the deformation paints H_t (merged-views review)
    const homL = morphOn() && lPaintsF();
    // the Phase style has no modulus bands: no strip
    const Fl = homL ? 'Hₜ' : S.focus === 0 ? 'F' : focusDeriv() ? 'w' : 'f';
    // the landscape paints Tiles unless the style is Plain (P10)
    const plainL = S.dc === 'phase';
    if (kind !== '3d' && plainL) { caption(`arg ${Fl}`); return; }
    // modulus strip
    st.strip = !(kind === 'color' && S.dc === 'classic');
    if (kind === 'color' && S.dc === 'classic') {
      const g = ctx.createLinearGradient(sx, 0, sx + sw, 0);
      g.addColorStop(0, '#000000'); g.addColorStop(0.5, '#8a8f93'); g.addColorStop(1, '#ffffff');
      ctx.fillStyle = g; ctx.fillRect(sx, sy, sw, sh);
      ctx.fillStyle = TH.muted; ctx.font = `10px ${TH.mono}`; ctx.textAlign = 'left';
      ctx.fillText('0', sx, sy + 18); ctx.textAlign = 'right'; ctx.fillText('∞', sx + sw, sy + 18);
      ctx.strokeStyle = TH.ink; ctx.beginPath(); ctx.moveTo(sx + sw / 2, sy - 2); ctx.lineTo(sx + sw / 2, sy + sh + 2); ctx.stroke();
    } else {
      for (let b = 0; b < 3; b++) {
        const g = ctx.createLinearGradient(sx + b * sw / 3, 0, sx + (b + 1) * sw / 3, 0);
        g.addColorStop(0, TH.dark ? '#3a4650' : '#9aa4ab'); g.addColorStop(1, TH.dark ? '#c9d2d8' : '#eef2f4');
        ctx.fillStyle = g; ctx.fillRect(sx + b * sw / 3, sy, sw / 3, sh);
      }
      ctx.strokeStyle = TH.lineStrong; ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
      // words in Archivo, the factor in B612 Mono (spec 3)
      ctx.fillStyle = TH.muted; ctx.textAlign = 'left';
      const word = (t, y) => { ctx.font = `11px ${TH.ui}`; ctx.fillText(t, sx, y); };
      const num = (t, y) => { ctx.font = `10px ${TH.mono}`; ctx.fillText(t, sx, y); };
      if (kind === '3d') { word('contours', sy - 9); num('×1.69', sy + 19); }
      else { num(n === 12 ? '×1.69' : `×${CX.fmtNum(Math.exp(TAU / n), 3)}`, sy - 9); word('per band', sy + 19); }
    }
    const Fn = homL ? 'Hₜ' : S.focus === 0 ? 'F' : focusDeriv() ? 'w' : 'f';
    caption(kind === '3d' ? ({ abs: `height |${Fn}|`, re: `height Re ${Fn}`, im: `height Im ${Fn}` }[S.height] || `height log |${Fn}|`) : `arg and |${Fn}|`);
  }
  function togglePlay() {
    morph.playing = !morph.playing;
    morph.last = 0;
    if (!morph.playing) { scheduleFix(); requestRender('R'); }
    if (morph.playing && morph.T >= morphLen()) morph.T = 0;
    morph.seg = null; morph.hold = 0;
    setPlayIcon();
    requestRender('R');
  }

  // ---------------- tools ----------------
  const tsvg = (inner) => `<svg class="tic" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const grip = (x, y) => `<rect x="${x - 1.75}" y="${y - 1.75}" width="3.5" height="3.5" fill="currentColor" stroke="none"/>`;
  const AREA = 'fill="currentColor" fill-opacity=".16"';
  const plusC = (x, y) => `<path d="M${x - 2.5} ${y}h5M${x} ${y - 2.5}v5" stroke-width="1"/>`;
  const ICON = {
    select: tsvg('<path d="M5.5 3.5V15l3.1-2.9 2.1 4.5 1.9-.8-2.1-4.5h4.1z"/>'),
    point: tsvg('<circle cx="10" cy="10" r="2.25" fill="currentColor" stroke="none"/><path d="M10 3.5v2M10 14.5v2M3.5 10h2M14.5 10h2"/>'),
    segment: tsvg('<path d="M5 15L15 5"/>' + grip(5, 15) + grip(15, 5)),
    line: tsvg('<path d="M1 17.9L19 2.1"/>' + grip(7, 12.6) + grip(13, 7.4)),
    ray: tsvg('<path d="M5 15L19 2.7"/>' + grip(5, 15)),
    circle: tsvg('<circle cx="10" cy="10" r="6.5"/>' + plusC(10, 10)),
    arc: tsvg('<path d="M3.5 14.5A7.5 7.5 0 0 1 16.5 14.5"/>' + grip(3.5, 14.5) + grip(16.5, 14.5) + grip(10, 7)),
    curve: tsvg('<path d="M3 14c2.2-4.8 4.2-.4 6.2-3.6S13 5.6 17 7.5"/>'),
    disc: tsvg(`<circle cx="10" cy="10" r="6.5" ${AREA}/>`),
    rect: tsvg(`<rect x="3.5" y="5.5" width="13" height="9" rx=".5" ${AREA}/>` + grip(3.5, 5.5) + grip(16.5, 14.5)),
    polygon: tsvg(`<path d="M4 14.5L6.5 5 14 4.5l2.5 7L10 16z" ${AREA}/>` + grip(4, 14.5) + grip(6.5, 5) + grip(14, 4.5) + grip(16.5, 11.5) + grip(10, 16)),
    lasso: tsvg(`<path d="M5.2 12.8C3 9.6 5 4.8 9.6 4.5s7.4 2.6 6.4 6.2-5.6 4.9-8.6 4.3c-1-.2-1.7-1-2.2-2.2z" ${AREA}/><path d="M5 13l-1.5 3.5"/>`),
    halfplane: tsvg('<rect x="0" y="0" width="20" height="10.5" fill="currentColor" fill-opacity=".16" stroke="none"/><path d="M0 10.5h20M14.5 8.5l2 2-2 2"/>'),
    annulus: tsvg(`<path fill-rule="evenodd" d="M10 3a7 7 0 1 0 0 14 7 7 0 1 0 0-14zm0 3.75a3.25 3.25 0 1 0 0 6.5 3.25 3.25 0 1 0 0-6.5z" ${AREA}/>`),
    sector: tsvg(`<path d="M4 16h13A13 13 0 0 0 13.2 6.8z" ${AREA}/>` + grip(4, 16)),
    formula: tsvg('<text x="3" y="15" font-family="STIX Two Text, serif" font-style="italic" font-size="14" fill="currentColor" stroke="none">f</text><path d="M12 7h5M12 11h5"/>'),
    cgrid: tsvg('<path stroke-width="1" d="M4 4v12M8 4v12M12 4v12M16 4v12M4 4h12M4 8h12M4 12h12M4 16h12"/>'),
    pgrid: tsvg('<g stroke-width="1"><circle cx="10" cy="10" r="3"/><circle cx="10" cy="10" r="6.5"/><path d="M10 3.5v13M3.5 10h13M5.4 5.4l9.2 9.2M14.6 5.4l-9.2 9.2"/></g>'),
  };
  const TOOLS = [
    ['select', 'Select', 'V', 'Drag a shape to move it and its handles to reshape. Drag empty space to pan (on a sphere, to turn it).'],
    ['point', 'Point', 'P', 'Click to place a point; its images are labelled a′, a″, …'],
    ['segment', 'Segment', 'S', 'Drag from one end to the other.'],
    ['line', 'Line', 'L', 'Drag through two points; the line extends to infinity.'],
    ['ray', 'Ray', 'R', 'Drag from the start in the direction of the ray.'],
    ['circle', 'Circle', 'C', 'Drag from the center outward.'],
    ['arc', 'Arc', 'A', 'Drag between the ends, then move the middle handle to bend it.'],
    ['curve', 'Freehand', 'F', 'Hold and draw an open curve.'],
    ['disc', 'Disc', 'D', 'Drag from the center outward.'],
    ['rect', 'Rectangle', 'B', 'Drag between opposite corners.'],
    ['polygon', 'Polygon', 'G', 'Click the vertices; click the first one or press Enter to close.'],
    ['lasso', 'Lasso', 'O', 'Hold and draw a closed region.'],
    ['halfplane', 'Half-plane', 'H', 'Drag along the boundary; the region is to the left of the arrow.'],
    ['annulus', 'Annulus', 'N', 'Drag from the center to the outer radius.'],
    ['sector', 'Sector', 'K', 'Drag from the vertex; edit the angles in the shape list.'],
    ['formula', 'Formula', 'T', 'Type a set such as |z − 1| < 2, or a curve such as Re z = 0, below.'],
    ['cgrid', 'Grid', '', 'Drag a rectangle to fill with grid lines.'],
    ['pgrid', 'Polar grid', '', 'Drag from the center to set the radius.'],
  ];
  function buildTools() {
    const host = $('tools'), rail = $('railTools');
    host.innerHTML = '';
    if (rail) rail.innerHTML = '';
    for (const [id, label, key, desc] of TOOLS) {
      const tip = key ? `${label}  ${key}` : label;
      // the description is the tooltip's second line (item 3: no hint line under the tools)
      host.append(h('button', { class: 'tool' + (tool === id ? ' on' : ''), 'data-tool': id, 'data-tip': tip, 'data-desc': desc, 'aria-label': label, 'aria-description': desc, 'aria-pressed': String(tool === id), onclick: () => setTool(id), html: `${ICON[id]}<span>${label}</span>` }));
      if (rail) rail.append(h('button', { class: 'tool rail-tool' + (tool === id ? ' on' : ''), 'data-tool': id, 'data-tip': tip, 'data-desc': desc, 'aria-label': label, 'aria-description': desc, onclick: () => setTool(id), html: ICON[id] }));
    }
    // Snap: the last button of the collapsed rail, so it stays reachable with the drawer collapsed (P3)
    if (rail) rail.append(h('button', { class: 'icon-btn rail-snap', id: 'railSnap', 'aria-pressed': String(!!(S && S.snap)), 'data-tip': 'Snap while drawing', 'aria-label': 'Snap while drawing', html: ICONS.snap, onclick: () => { S.snap = !S.snap; syncSnapUnit(); save(); } }));
    updateToolHint();
  }
  function setTool(id) {
    if (id === 'formula') { setPanels(false, S.hideRight); const f = $('formulaInput'); f.focus(); f.select(); return; }
    tool = id;
    draft = null;
    for (const b of document.querySelectorAll('.tool[data-tool]')) { const on = b.dataset.tool === id; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); }
    // shapes are drawn in the z-plane (Image also draws targets in the right plane at any focus)
    if (id !== 'select' && leftStage() > 0 && !targetsEditable()) setFocus(0);
    updateToolHint();
    // the right readout's idle hint names the tool (drawing a target, or the scale)
    if (!probe) { const ro = $('rightReadout'); if (ro && !ro.classList.contains('copied') && !(rHover && rImage() && tool === 'select')) ro.innerHTML = idleRight(); }
    // the left readout's idle hint names the tool on a globe and on the landscape (panels.md 3, 9.1)
    if (!probe && !hov.w && (lGlobe() || lLand())) { const lr = $('leftReadout'); if (lr && !lr.classList.contains('copied')) lr.innerHTML = idleLeft(); }
    // an editable globe's graticule is the snap net of the tool (P3b): it is redrawn
    requestRender('OL', 'OR', globeEdit('L') ? 'L' : null, globeEdit('R') ? 'R' : null);
  }
  // the tool's cursors (the hint line under the tools is gone, item 3: descriptions are the tools' tooltips)
  function updateToolHint() {
    updateDraftChips();
    if (paneL) setCursor(paneL, 'L');
    if (paneR) setCursor(paneR, 'R');
  }

  // ---------------- shapes ----------------
  // target: a shape of the w-plane (Preimage), kept in S.targets; its colors start further along the palette
  function newShape(kind, params, target) {
    const ci = target ? TARGET_CI[S.targets.length % TARGET_CI.length] : S.shapes.length % 8;
    const s = Object.assign({ id: 's' + S.nextId++, kind, ci, visible: true }, params);
    return s;
  }
  function addShape(s, target) {
    (target ? S.targets : S.shapes).push(s);
    selected = s.id; zpSel = null;
    if (target) targetsChanged(true); else shapesChanged(true);
    commit();
  }
  function deleteShape(id) {
    const target = S.targets.some((s) => s.id === id);
    if (target) S.targets = S.targets.filter((s) => s.id !== id);
    else { S.shapes = S.shapes.filter((s) => s.id !== id); dropShapeGPU(id); }
    if (selected === id) selected = null;
    if (target) targetsChanged(true); else shapesChanged(true);
    commit();
    undoToast(target ? 'Target deleted.' : 'Shape deleted.');
  }
  // targets change only the preimages and the right plane's targets: no meshes, no refit
  function targetsChanged(structural) {
    noteChange();
    if (structural) { buildShapeList(); updateFocusUI(); } else updateShapeList();
    requestRender('L', 'R');
  }
  // ---------------- menus (popover lists) ----------------
  // items: {label, icon?, swatch?, key?, danger?, run} | 'sep' ; a 'kids' array opens a submenu beside its item.
  // run() may return the element that should take the focus; otherwise it goes back to the menu's opener.
  // sub (internal): {opener, okey, parent, label} for a submenu, so Esc and ← lead back to a live element.
  function openMenu(anchor, items, cls, sub) {
    const opener = sub ? sub.opener : anchor;
    // re-clicking the button that opened a menu closes it
    if (!sub && popEl && popEl.classList.contains('menu') && popEl._opener === anchor) { closePalette(); return null; }
    const okey = sub ? sub.okey : focusKey(anchor);
    const ar = anchor.getBoundingClientRect(); // before closePalette detaches a submenu's parent item
    closePalette();
    const pop = h('div', { class: 'pop menu' + (cls ? ' ' + cls : ''), role: 'menu', 'aria-label': sub ? sub.label : null });
    pop._opener = opener;
    const add = (host, list) => {
      for (const it of list) {
        if (it === 'sep') { host.append(h('div', { class: 'msep', role: 'separator' })); continue; }
        const ic = it.swatch ? `<span class="swatch" style="--c0:${it.swatch.c0};--c1:${it.swatch.alt};--k:${it.swatch.edge}"></span>` : it.icon ? ICONS[it.icon] || '' : '';
        const b = h('button', { class: 'mi' + (it.danger ? ' danger' : '') + (it.kids ? ' has-sub' : ''), role: 'menuitem', disabled: it.disabled || null, 'aria-haspopup': it.kids ? 'menu' : null,
          onclick: (e) => {
            e.stopPropagation();
            if (it.kids) { openMenu(b, it.kids, cls, { opener, okey, parent: items, label: it.label }); return; }
            closePalette();
            const r = it.run();
            if (r instanceof Element && r.isConnected) r.focus({ preventScroll: true }); else focusBack(opener, okey);
          } },
          h('span', { class: 'mi-ic', html: ic }), h('span', { class: 'mi-label' }, it.label), h('span', { class: 'mi-key' }, it.key || ''));
        host.append(b);
      }
    };
    add(pop, items);
    $('popHost').append(pop);
    popEl = pop;
    if (sub) {
      // beside the parent item, flipped to its left near the window edge
      const pw = pop.offsetWidth, ph = pop.offsetHeight;
      let x = ar.right + 2;
      if (x + pw > window.innerWidth - 12) x = Math.max(12, ar.left - pw - 2);
      pop.style.left = x + 'px';
      pop.style.top = Math.max(12, Math.min(window.innerHeight - ph - 12, ar.top - 4)) + 'px';
    } else placePop(pop, ar);
    const first = pop.querySelector('.mi:not([disabled])');
    if (first) first.focus();
    pop.addEventListener('keydown', (e) => {
      const its = [...pop.querySelectorAll('.mi:not([disabled])')];
      const i = its.indexOf(document.activeElement), cur = its[i];
      if (e.key === 'ArrowDown') { e.preventDefault(); its[(i + 1) % its.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); its[(i - 1 + its.length) % its.length].focus(); }
      if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); its[e.key === 'Home' ? 0 : its.length - 1].focus(); }
      if (e.key === 'ArrowRight' && cur && cur.classList.contains('has-sub')) { e.preventDefault(); cur.click(); }
      if (e.key === 'ArrowLeft' && sub && sub.parent) {
        e.preventDefault();
        closePalette();
        openMenu(opener, sub.parent, cls);
        const back = popEl && [...popEl.querySelectorAll('.mi')].find((b) => b.querySelector('.mi-label').textContent === sub.label);
        if (back) back.focus();
      }
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); focusBack(opener, okey); }
    });
    armOutside(opener);
    return pop;
  }
  // anchor: an element or a rect measured earlier
  function placePop(pop, anchor) {
    const r = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
    const pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = Math.min(window.innerWidth - pw - 12, Math.max(12, r.left));
    let y = r.bottom + 6;
    if (y + ph > window.innerHeight - 12) y = Math.max(12, r.top - ph - 6);
    pop.style.left = x + 'px'; pop.style.top = y + 'px';
  }
  function armOutside(anchor) {
    const pop = popEl;
    setTimeout(() => {
      const off = (e) => {
        if (!popEl || popEl !== pop) { document.removeEventListener('pointerdown', off, true); return; }
        // a press in the Argand pad opened from this popover is inside it
        if (!popEl.contains(e.target) && !(anchor && anchor.contains(e.target)) && !(padEl && padEl.contains(e.target))) { closePalette(); document.removeEventListener('pointerdown', off, true); }
      };
      document.addEventListener('pointerdown', off, true);
    }, 0);
  }

  const shapeRows = new Map();
  function swatchStyle(s) {
    const ink = shapeInk(s);
    return `--c0:${ink.c0};--c1:${ink.alt};--k:${ink.edge}`;
  }
  function shapeName(s, counts) {
    if (s.kind === 'point' && s.label) return s.label;
    return `${Region.KINDS[s.kind].label} ${counts[s.kind]}`;
  }
  function moveShape(id, d) {
    const target = S.targets.some((x) => x.id === id), list = target ? S.targets : S.shapes;
    const i = list.findIndex((x) => x.id === id), j = i + d;
    if (i < 0 || j < 0 || j >= list.length) return;
    const [x] = list.splice(i, 1);
    list.splice(j, 0, x);
    if (target) targetsChanged(true); else shapesChanged(true);
    commit();
  }
  // remove the shapes and/or the targets, with undo
  function clearGroup(shapes, targets) {
    const ds = shapes && S.shapes.length, dt = targets && S.targets.length;
    if (!ds && !dt) return;
    // (the selection goes only with its own group: 'Clear targets' keeps a selected shape selected)
    if (selected && ((ds && S.shapes.some((s) => s.id === selected)) || (dt && S.targets.some((s) => s.id === selected)))) selected = null;
    if (ds) { S.shapes = []; dropAllGPU(); }
    if (dt) S.targets = [];
    if (ds) shapesChanged(true);
    if (dt) targetsChanged(true);
    buildPipeline(); commit();
    undoToast(ds && dt ? 'Shapes and targets cleared.' : ds ? 'Shapes cleared.' : 'Targets cleared.');
  }
  function buildShapeList() {
    const host = $('shapeList');
    host.innerHTML = '';
    shapeRows.clear();
    const rc = $('railCount');
    if (rc) rc.textContent = String(S.shapes.length);
    // Clear is faint and inert with nothing to clear (U-a review); it stays a button so the heading does not shift
    const cb = $('clearShapes');
    if (cb) {
      const none = !S.shapes.length && !S.targets.length;
      cb.setAttribute('aria-disabled', String(none));
      cb.title = none ? 'Nothing to clear' : 'Remove all shapes and targets';
    }
    // two groups, always both shown: the shapes of the z-plane and the targets of the w-plane (wₖ with step k
    // focused), each with its rows or an empty note of the same form
    host.append(h('div', { class: 'shapes-sub', role: 'heading', 'aria-level': '3', html: '<span><i>z</i>-plane</span>' }));
    if (!S.shapes.length) host.append(h('div', { class: 'empty-note' }, h('div', null, h('span', { html: 'No shapes yet. Draw one in the <i>z</i>-plane.' }))));
    const counts = {};
    S.shapes.forEach((s) => { counts[s.kind] = (counts[s.kind] || 0) + 1; host.append(shapeRow(s, shapeName(s, counts), false)); });
    // the targets drawn in the w-plane, listed (and edited) like shapes; their preimages show in every view
    {
      const out = S.focus === 0 ? '<i>w</i>' : wHtml(rightStage());
      host.append(h('div', { class: 'shapes-sub', role: 'heading', 'aria-level': '3', html: `<span>${out}-plane</span>` }));
      if (!S.targets.length) host.append(h('div', { class: 'empty-note' }, h('div', null, h('span', { html: `No targets yet. Draw one in the ${out}-plane.` }))));
      const tc = {};
      S.targets.forEach((s, i) => {
        tc[s.kind] = (tc[s.kind] || 0) + 1;
        // targets are named apart from the domain's shapes: point targets by letter (p, q, …), the rest "Target disc 1"
        const label = s.kind === 'point' ? `Point ${targetLabel(s, S.targets.filter((x) => x.kind === 'point').indexOf(s))}` : `Target ${Region.KINDS[s.kind].label.toLowerCase()} ${tc[s.kind]}`;
        host.append(shapeRow(s, label, true, i));
      });
    }
    updateShapeList();
  }
  function shapeRow(s, label, target) {
    const list = target ? S.targets : S.shapes;
    const changed = () => (target ? targetsChanged(true) : shapesChanged(true));
    const hidden = s.visible === false;
    const sw = h('span', { class: 'swatch', 'data-kind': kindType(s), style: swatchStyle(s) });
    const d = h('span', { class: 'd' });
    const eye = h('button', { class: 'icon-btn eye', 'aria-label': `${hidden ? 'Show' : 'Hide'} ${label}`, 'data-tip': hidden ? 'Show' : 'Hide', html: hidden ? ICONS.eyeOff : ICONS.eye,
      onclick: (e) => { e.stopPropagation(); s.visible = hidden; changed(); commit(); } });
    const more = h('button', { class: 'icon-btn more', 'aria-label': `More actions for ${label}`, 'aria-haspopup': 'menu', 'data-tip': 'More', html: ICONS.more,
      onclick: (e) => {
        e.stopPropagation();
        const items = [];
        // a curve of the domain: its line integral (as a right click on the curve opens it)
        if (!target && kindType(s) !== 'point' && s.kind !== 'cgrid' && s.kind !== 'pgrid') {
          const anchor = e.currentTarget;
          items.push({ label: `Integrate ${fnText()} along it`, run: () => { const r = anchor.getBoundingClientRect(); return openIntegralPop(s.id, r.right, r.top); } }, 'sep');
        }
        if (kindType(s) === 'area') items.push({ label: s.complement ? 'Use the set itself' : 'Use complement', run: () => { s.complement = !s.complement; changed(); commit(); } });
        items.push({ label: 'Duplicate', run: () => { const c = JSON.parse(JSON.stringify(s)); c.id = 's' + S.nextId++; c.ci = target ? TARGET_CI[list.length % TARGET_CI.length] : list.length % 8; delete c.color; delete c.label; Region.translate(c, C(0.25, -0.25)); list.push(c); selected = c.id; zpSel = null; changed(); commit(); } });
        items.push({ label: 'Color', kids: [...TH.c.map((cc, i) => ({ label: `Preset ${i + 1}`, swatch: cc, run: () => { s.ci = i; delete s.color; changed(); commit(); } })), { label: 'Custom color…', run: () => pickColor(s) }] });
        items.push({ label: 'Bring forward', disabled: list.indexOf(s) === list.length - 1, run: () => moveShape(s.id, 1) });
        items.push({ label: 'Send backward', disabled: list.indexOf(s) === 0, run: () => moveShape(s.id, -1) });
        items.push('sep');
        items.push({ label: target ? 'Clear targets' : 'Clear shapes', run: () => clearGroup(!target, target) });
        items.push({ label: 'Delete', icon: 'trash', key: '⌫', danger: true, run: () => deleteShape(s.id) });
        openMenu(e.currentTarget, items);
      } });
    const name = h('span', { class: 'k' }, label);
    // the name is the row's button; the eye and ⋯ buttons sit beside it, not inside it
    const nameBtn = h('div', { class: 'shape-name', role: 'button', tabindex: 0, 'aria-pressed': String(selected === s.id),
      onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); } } }, name, d);
    const row = h('div', { class: 'shape-row',
      onclick: () => { selected = selected === s.id ? null : s.id; zpSel = null; if (leftStage() > 0 && !target) setFocus(0); buildShapeList(); requestRender('L', 'R'); },
      onpointerenter: () => { hoverShape = s.id; requestRender('L', 'R'); },
      onpointerleave: () => { if (hoverShape === s.id) { hoverShape = null; requestRender('L', 'R'); } } },
    sw, nameBtn, eye, more);
    const box = h('div', { class: 'shape' + (selected === s.id ? ' sel' : '') + (hidden ? ' hidden-shape' : ''), 'data-id': s.id }, row);
    const ed = selected === s.id ? shapeEditor(s) : null;
    if (ed) box.append(ed);
    shapeRows.set(s.id, { d, box, sw, ed, kind: rowKind(s) });
    return box;
  }
  function pickColor(s) {
    const inp = h('input', { type: 'color', value: s.color || shapeInk(s).c0, style: 'position:fixed;left:-100px;top:0;opacity:0' });
    document.body.append(inp);
    inp.addEventListener('input', () => { s.color = inp.value; shapesChanged(false); const r = shapeRows.get(s.id); if (r) r.sw.style.cssText = swatchStyle(s); });
    inp.addEventListener('change', () => { commit(); inp.remove(); });
    inp.click();
  }
  // the kind a row was built for: a shape slid over ∞ on a globe changes kind (panels.md 9.4), and its row's name and
  // editor fields follow
  const rowKind = (s) => s.kind + (s.complement ? '~' : '');
  function updateShapeList() {
    for (const s of S.shapes.concat(S.targets)) {
      const r = shapeRows.get(s.id);
      if (r && r.kind !== rowKind(s)) { buildShapeList(); return; }
    }
    for (const s of S.shapes.concat(S.targets)) {
      const r = shapeRows.get(s.id);
      if (!r) continue;
      if (r.ed && r.ed._sync) r.ed._sync();
      r.sw.style.cssText = swatchStyle(s);
      let tex;
      try { tex = shapeTexOf(s); } catch (e) { tex = '\\text{?}'; }
      if (s.complement) tex = `\\text{not }${tex}`;
      // a target is a set in Y, written in Y's variable (P13: w, or w_k with step k focused), so the row states what
      // X shades (the stored target is unchanged)
      if (isTarget(s)) { const yv = S.focus === 0 ? 'w' : `w_{${rightStage()}}`; tex = tex.replace(/(^|[^\\a-zA-Z])z(?![a-zA-Z])/g, `$1${yv}`); }
      r.d.title = tex;
      if (s._err) { r.d.innerHTML = ''; r.d.append(h('span', { class: 'err-msg' }, s._err)); } else TeX.set(r.d, tex);
    }
  }
  function shapeEditor(s) {
    const box = h('div', { class: 'shape-edit' });
    const target = isTarget(s);
    const shapesChanged = (structural) => (target ? targetsChanged(structural) : shapesChangedAll(structural));
    const lab = (t) => h('label', { html: t });
    const errEl = (fieldEl) => { let e = fieldEl.querySelector('.field-err'); if (!e) { e = h('div', { class: 'field-err', role: 'alert' }); fieldEl.append(e); } return e; };
    const showErr = (fieldEl, inp, msg) => {
      inp.classList.toggle('bad', !!msg); inp.setAttribute('aria-invalid', String(!!msg));
      if (msg) errEl(fieldEl).textContent = msg; else { const e = fieldEl.querySelector('.field-err'); if (e) e.remove(); }
    };
    const fmtNumIn = (x) => String(+(+x).toPrecision(6));
    // the fields follow a shape edited on the canvas (a drag, a slide on a globe); the field being typed in and an
    // invalid entry keep their text
    const syncs = [];
    box._sync = () => { for (const f of syncs) f(); };
    const follow = (inp, text) => syncs.push(() => {
      if (document.activeElement === inp || inp.classList.contains('bad')) return;
      let t;
      try { t = text(); } catch (e) { return; }
      if (t != null && inp.value !== t) inp.value = t;
    });
    const ptField = (key, label) => {
      const inp = h('input', { class: 'inp mono', value: CX.fmt(C(s[key][0], s[key][1]), 6), spellcheck: 'false', autocomplete: 'off' });
      follow(inp, () => (s[key] ? CX.fmt(C(s[key][0], s[key][1]), 6) : null));
      const f = h('div', { class: 'field' }, lab(label), inp);
      let start = JSON.stringify(s[key]);
      inp.addEventListener('focus', () => { start = JSON.stringify(s[key]); });
      inp.addEventListener('input', () => {
        try { const v = Expr.constValue(inp.value); s[key] = [v.re, v.im]; showErr(f, inp, ''); shapesChanged(false); } catch (e) { showErr(f, inp, 'Expected a number like 1+2i or e^{i\\pi/4}'); }
      });
      inp.addEventListener('change', () => {
        if (inp.classList.contains('bad')) { inp.value = CX.fmt(C(s[key][0], s[key][1]), 6); showErr(f, inp, ''); return; }
        if (JSON.stringify(s[key]) !== start) commit();
      });
      return f;
    };
    // positive radii, whole counts in range; an invalid value is shown but never applied
    const LIMITS = { r: [s.kind === 'sector' ? 0 : 1e-9, Infinity, s.kind === 'sector' ? 'The radius must be 0 (unbounded) or more' : 'The radius must be positive'],
      r1: [0, Infinity, 'Radii must be 0 or more'], r2: [0, Infinity, 'Radii must be 0 or more'],
      n: [1, 60, 'Use a whole number from 1 to 60'], nc: [1, 60, 'Use a whole number from 1 to 60'], nr: [1, 60, 'Use a whole number from 1 to 60'] };
    const numField = (key, label, step = 'any') => {
      const inp = h('input', { class: 'inp mono', type: 'number', step, value: fmtNumIn(s[key]) });
      follow(inp, () => (s[key] != null ? fmtNumIn(s[key]) : null));
      const l = lab(label);
      const f = h('div', { class: 'field' }, l, inp);
      let start = s[key];
      inp.addEventListener('focus', () => { start = s[key]; });
      const check = (v) => {
        if (!Number.isFinite(v)) return 'Enter a number';
        const lim = LIMITS[key];
        if (!lim) return '';
        if (step === 1 && !Number.isInteger(v)) return lim[2];
        return v < lim[0] || v > lim[1] ? lim[2] : '';
      };
      inp.addEventListener('input', () => {
        const v = Number(inp.value), msg = inp.value.trim() === '' ? 'Enter a number' : check(v);
        showErr(f, inp, msg);
        if (!msg) { s[key] = v; shapesChanged(false); }
      });
      inp.addEventListener('change', () => {
        if (inp.classList.contains('bad')) { inp.value = fmtNumIn(s[key]); showErr(f, inp, ''); return; }
        if (s[key] !== start) commit();
      });
      scrubbable(l, inp, step === 1 ? 1 : 0.01, step === 1);
      return f;
    };
    switch (s.kind) {
      case 'point': box.append(ptField('p', target ? '<i>w</i>' : '<i>z</i>')); break;
      case 'segment': case 'line': case 'ray': box.append(ptField('a', 'start <i>a</i>'), ptField('b', 'end <i>b</i>')); break;
      case 'halfplane': box.append(ptField('a', 'from <i>a</i>'), ptField('b', 'to <i>b</i>')); break;
      case 'rect': box.append(ptField('a', 'corner <i>a</i>'), ptField('b', 'corner <i>b</i>')); break;
      case 'circle': case 'disc': box.append(ptField('c', 'center <i>c</i>'), numField('r', 'radius <i>r</i>')); break;
      case 'annulus': box.append(ptField('c', 'center <i>c</i>'), numField('r1', '<i>r</i>₁'), numField('r2', '<i>r</i>₂')); break;
      case 'sector': box.append(ptField('c', 'vertex <i>c</i>'), numField('t1', '<i>θ</i>₁ (°)'), numField('t2', '<i>θ</i>₂ (°)'), numField('r', 'radius (0 = ∞)')); break;
      case 'arc': box.append(ptField('a', 'start'), ptField('m', 'through'), ptField('b', 'end')); break;
      case 'cgrid': box.append(ptField('a', 'corner <i>a</i>'), ptField('b', 'corner <i>b</i>'), numField('n', 'divisions', 1)); break;
      case 'pgrid': box.append(ptField('c', 'center <i>c</i>'), numField('r', 'radius <i>r</i>'), numField('nc', 'circles', 1), numField('nr', 'rays', 1)); break;
      case 'formula': {
        const inp = h('input', { class: 'inp math-src', value: s.expr, spellcheck: 'false', autocomplete: 'off' });
        inp.addEventListener('input', () => {
          try { Expr.compileLevel(Expr.parse(inp.value, { allowRel: true })); s.expr = inp.value; inp.classList.remove('bad'); shapesChanged(false); } catch (e) { inp.classList.add('bad'); }
        });
        inp.addEventListener('change', () => commit());
        box.append(h('div', { class: 'field wide' }, lab('set'), inp));
        break;
      }
      case 'fcurve': {
        // the equation stays a curve while typed (an area or a refused equation keeps the last good one); the notes
        // are the curve engine's: the formula's own and this window's trace's (budget, touching zeros)
        const inp = h('input', { class: 'inp math-src', value: s.expr, spellcheck: 'false', autocomplete: 'off' });
        const fld = h('div', { class: 'field wide' }, lab('equation'), inp);
        const nt = h('div', { class: 'lbl note' });
        const notes = () => {
          let t = [];
          try {
            const d = Region.curveDesc(s);
            t = d.notes.slice();
            for (const x of Region.fcurveTrace(s, target ? targetWin() : clipWin).notes) if (!t.includes(x)) t.push(x);
          } catch (e) { t = []; }
          nt.textContent = t.join(' ');
          nt.hidden = !t.length;
        };
        inp.addEventListener('input', () => {
          let msg = '';
          try { Curves.fromFormula(inp.value); } catch (e) { msg = e.message; }
          showErr(fld, inp, msg);
          if (!msg) { s.expr = inp.value; shapesChanged(false); notes(); }
        });
        inp.addEventListener('change', () => { if (inp.classList.contains('bad')) { inp.value = s.expr; showErr(fld, inp, ''); return; } commit(); });
        notes();
        box.append(fld, nt);
        break;
      }
    }
    if (s.kind === 'point') {
      const inp = h('input', { class: 'inp', value: s.label || '', placeholder: 'a', spellcheck: 'false' });
      inp.addEventListener('input', () => { s.label = inp.value; requestRender('L', 'R'); });
      inp.addEventListener('change', () => { commit(); buildShapeList(); });
      box.append(h('div', { class: 'field' }, lab('label'), inp));
    }
    if (kindType(s) === 'area') box.append(checkEl('cmp_' + s.id, s.complement, 'Use complement', (v) => { s.complement = v; shapesChanged(true); commit(); }));
    let unb = false;
    try { unb = kindType(s) === 'area' && !Region.bboxOf(s); } catch (e) { unb = true; }
    if (unb) box.append(h('div', { class: 'lbl note' }, 'Unbounded: drawn about 200 view-widths out, faded at the edge.'));
    return box;
  }

  // ---------------- formula region input ----------------
  // a spoken name for a short set formula: |\Re z|<\frac{\pi}{2}, \Im z>0 → "absolute Re z less than pi over 2, and Im z greater than 0"
  function texSpeech(t) {
    let s = t;
    for (let i = 0; i < 3; i++) s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '$1 over $2');
    s = s.replace(/<=|\\leq?\b/g, ' at most ').replace(/>=|\\geq?\b/g, ' at least ').replace(/</g, ' less than ').replace(/>/g, ' greater than ')
      .replace(/\|([^|]+)\|/g, ' absolute $1 ').replace(/\\(Re|Im|arg|pi|theta)\b/g, ' $1 ').replace(/\\[a-zA-Z]+/g, ' ')
      .replace(/\^\{?([^{}\s]+)\}?/g, ' to the power $1 ').replace(/,/g, ', and ').replace(/[{}]/g, '').replace(/\//g, ' over ')
      .replace(/-/g, ' minus ').replace(/\+/g, ' plus ');
    return s.replace(/\s+/g, ' ').replace(/\s,/g, ',').trim();
  }
  // example sets offered by the command palette's "Region formulas" group (the sidebar has no example chips, item 4)
  const REGION_EXAMPLES = ['|z|<1', '0<\\Im z<\\pi', '1<|z|<2', '|\\arg z|<\\pi/4', '|z-1|+|z+1|<3', '\\Re z>0', '|z^2-1|<1', '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0'];
  // the plane a formula's set lives in, from its variable: 'w' (a target of the w-plane), 'z' (a shape of the
  // z-plane; also a set in neither variable), or 'both' (an error: use z or w)
  function formulaPlane(v) {
    const t = String(v).replace(/\\[a-zA-Z]+/g, ' ');
    const w = /w/.test(t), z = /z/.test(t);
    return w && z ? 'both' : w ? 'w' : 'z';
  }
  // ---- curve formulas (equations: 1-dimensional regions, notes/curves-design.md 4) ----
  // curvePlan(src) -> {desc, shapes: [shape params], what (a phrase: 'a line', '2 circles', 'a traced curve'), notes}
  // An equation whose every piece Curves recognizes exactly becomes the app's own shapes (line, ray, segment, circle,
  // arc, point: with their handles); otherwise one 'fcurve' shape holds the source text (its exact pieces are still
  // drawn exactly, the rest traced per window). A lone exact shape keeps the formula as its row's TeX (srcTex) while
  // its geometry is as recognized (srcKey). Throws the classification's message (Expr.REL_MSG) for a refused equation.
  // Isolated zeros (|z^2 - 1| = 0, |\sin z| = 0) become point shapes: the ones in win (the plane's view; a periodic
  // set has infinitely many).
  function curvePlan(src, win) {
    const desc = Curves.fromFormula(src);
    const notes = desc.notes.slice();
    let shapes = [];
    let someZeros = false;
    if (desc.pieces.every((pc) => pc.exact || pc.kind === 'zeros')) {
      // one shape per distinct exact shape: 'Re z = 0 or Re z = 0' is one line
      const keys = new Set();
      for (const pc of desc.pieces) for (const sh of pc.exact || []) {
        const k = JSON.stringify(sh);
        if (keys.has(k)) continue;
        keys.add(k);
        shapes.push(JSON.parse(k));
      }
      if (desc.pieces.some((pc) => pc.kind === 'zeros') && win) {
        const seen = new Set(shapes.filter((x) => x.kind === 'point').map((x) => x.p.join(',')));
        const tr = Curves.trace(desc, win);
        for (const t of tr.notes) if (/^Only some of the zeros/.test(t)) { someZeros = true; if (!notes.includes(t)) notes.push(t); }
        for (const { p } of tr.points) {
          const k = [p.re, p.im].join(',');
          if (seen.has(k)) continue;
          if (shapes.length >= 64) { someZeros = true; continue; }
          seen.add(k);
          shapes.push({ kind: 'point', p: [p.re, p.im] });
        }
      }
      if (!shapes.length) throw new Error(notes[0] && !desc.pieces.some((pc) => pc.kind === 'zeros') ? notes[0] : 'This equation has no points in view');
      if (shapes.length === 1 && shapes[0].kind !== 'point') shapes[0].srcTex = desc.tex;
    } else {
      shapes = [{ kind: 'fcurve', expr: src }];
      // a traced curve with nothing in view says so (instead of an empty row)
      if (win) {
        let tr = null;
        try { tr = Curves.trace(desc, win); } catch (e) { tr = null; }
        if (tr && !tr.polys.length && !tr.points.length && !tr.notes.length) notes.push('Nothing of this curve was found in view: it lies elsewhere, or it is too small or too thin to trace here.');
      }
    }
    const n = {};
    for (const sh of shapes) n[sh.kind] = (n[sh.kind] || 0) + 1;
    const NAME = { line: ['a line', 'lines'], ray: ['a ray', 'rays'], segment: ['a segment', 'segments'], circle: ['a circle', 'circles'], arc: ['an arc', 'arcs'], point: ['a point', 'points'], fcurve: ['a traced curve', 'traced curves'] };
    let what = Object.entries(n).map(([k, c]) => (c === 1 ? NAME[k][0] : `${c} ${NAME[k][1]}`)).join(' and ');
    if (desc.pieces.some((pc) => pc.kind === 'zeros')) what += someZeros ? ' (some of the zeros in view)' : ' (the zeros in view)';
    return { desc, shapes, what, notes };
  }
  // the shapes of curvePlan(src), added as one undoable step (target: in the w-plane)
  function addCurveShapes(plan, target) {
    let last = null;
    for (const p of plan.shapes) {
      const s = newShape(p.kind, p, target);
      if (s.srcTex) s.srcKey = shapeKey(s);
      (target ? S.targets : S.shapes).push(s);
      last = s;
    }
    if (!last) return;
    selected = last.id; zpSel = null;
    if (target) targetsChanged(true); else shapesChanged(true);
    commit();
  }
  // a shape's TeX: a shape added from an equation shows the equation while its geometry is unchanged
  function shapeTexOf(s) {
    if (s.srcTex && s.srcKey === shapeKey(s)) return s.srcTex;
    return Region.KINDS[s.kind].tex(s);
  }
  function setupFormula() {
    const inp = $('formulaInput'), prev = $('formulaPrev'), tag = $('formulaPlane'), note = $('formulaNote');
    let plan = null;
    const setNote = (t) => { if (!note) return; note.textContent = t || ''; note.hidden = !t; };
    // one Add (item 4): the set's variable decides where it goes, and the tag at the end of the preview names that
    // plane before Add (z: a shape of the z-plane; w: a target of the w-plane, wₖ with step k focused)
    const plane = () => formulaPlane(inp.value);
    const check = () => {
      const v = inp.value.trim();
      tag.textContent = '';
      plan = null;
      setNote('');
      if (!v) { prev.innerHTML = ''; prev.dataset.tex = ''; inp.classList.remove('bad'); return null; }
      try {
        const pl = plane();
        if (pl === 'both') throw new Error('Use z or w, not both: z adds a shape, w adds a target');
        const ast = Expr.parse(v, { allowRel: true });
        // an equation is a curve (Curves), inequalities an area (as before); anything else says why not
        const dm = typeof Curves !== 'undefined' ? Curves.dimOf(ast) : { dim: 'area' };
        if (dm.dim === 'curve') {
          plan = curvePlan(v, pl === 'w' ? targetWin() : viewBox(S.srcView));
          setNote(`Adds ${plan.what}${pl === 'w' ? ' as a target' : ''}.${plan.notes.length ? ' ' + plan.notes.join(' ') : ''}`);
        } else if (dm.dim === 'error') throw new Error(dm.error);
        else Expr.compileLevel(ast);
        inp.classList.remove('bad');
        TeX.set(prev, Expr.toTex(ast, pl === 'w' ? { s: 'w', p: 4 } : undefined).s);
        tag.textContent = pl === 'w' ? `w${S.focus === 0 ? '' : sub(rightStage())}-plane` : 'z-plane';
        return v;
      } catch (e) {
        plan = null;
        setNote('');
        inp.classList.add('bad');
        prev.dataset.tex = '';
        prev.innerHTML = '';
        prev.append(h('span', { class: 'err' }, e.message));
        return null;
      }
    };
    const add = () => {
      const v = check();
      if (!v) return;
      const w = plane() === 'w';
      if (plan) { if (!w && leftStage() > 0) setFocus(0); addCurveShapes(plan, w); }
      else if (w) addShape(newShape('formula', { expr: v }, true), true);
      else { if (leftStage() > 0) setFocus(0); addShape(newShape('formula', { expr: v })); }
      inp.value = ''; check();
    };
    // a formula wider than the well fades out at its end until it is scrolled there (U-a review)
    const ovf = () => prev.classList.toggle('ovf', prev.scrollLeft + prev.clientWidth < prev.scrollWidth - 1);
    try { new MutationObserver(ovf).observe(prev, { childList: true, subtree: true, characterData: true }); new ResizeObserver(ovf).observe(prev); } catch (e) { /* older browsers: no fade */ }
    prev.addEventListener('scroll', ovf, { passive: true });
    inp.addEventListener('input', check);
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
    $('formulaAdd').addEventListener('click', add);
    // the tag names wₖ with step k focused: refresh it when the focus changes
    setupFormula.refresh = check;
  }

  // ---------------- pipeline (function chain) ----------------
  const cardRefs = [];
  let dragStep = 0;
  const fsub = (k) => `<i>f</i><sub>${k}</sub>`;
  const wsub = (k) => (k === 0 ? '<i>z</i>' : `<i>w</i><sub>${k}</sub>`);
  function connector(k) {
    // the arrow between stage k-1 and stage k; its + inserts a new step at that position
    const where = k === 1 ? 'at the start' : `after f${sub(k - 1)}`;
    const plus = h('button', { class: 'conn-add', 'data-tip': `Insert a function ${where}`, 'aria-label': `Insert a function ${where}`, html: ICONS.plus,
      onclick: (e) => { e.stopPropagation(); openPalette(e.currentTarget, k - 1, { fnOnly: true }); } });
    const el = h('div', { class: 'conn', 'data-conn': k },
      h('span', { class: 'conn-var', html: wsub(k - 1) }),
      h('span', { class: 'conn-line', html: '<svg viewBox="0 0 36 10" aria-hidden="true"><path d="M1 5h31M28 1.5L32.5 5 28 8.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>' }),
      h('span', { class: 'conn-f', html: k <= S.steps.length ? (isDerivStep(S.steps[k - 1]) ? 'd/d<i>z</i>' : fsub(k)) : '' }), plus);
    // dropping a dragged card here moves it to position k
    el.addEventListener('dragover', (e) => { if (dragStep) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; el.classList.add('drop'); } });
    el.addEventListener('dragleave', () => el.classList.remove('drop'));
    el.addEventListener('drop', (e) => {
      e.preventDefault(); el.classList.remove('drop');
      const from = dragStep; dragStep = 0;
      if (!from) return;
      const to = from < k ? k - 2 : k - 1; // index after removal
      if (to === from - 1) return;
      const [st] = S.steps.splice(from - 1, 1);
      S.steps.splice(to, 0, st);
      chainChanged(true); setFocus(to + 1); commit();
    });
    return el;
  }
  function regionSummary() {
    const n = S.shapes.length, hid = S.shapes.filter((s) => s.visible === false).length;
    if (!n) return 'No shapes yet';
    return `${n} shape${n === 1 ? '' : 's'}${hid ? `, ${hid} hidden` : ''}`;
  }
  function updateRegionCard() {
    const c0 = document.querySelector('#pipeline .region-card');
    if (!c0) return;
    c0.querySelector('.note').textContent = regionSummary();
    const sw = c0.querySelector('.swatches');
    sw.innerHTML = '';
    for (const s of S.shapes.slice(0, 10)) sw.append(h('span', { class: 'swatch' + (s.visible === false ? ' off' : ''), 'data-kind': kindType(s), style: swatchStyle(s) }));
  }
  function buildPipeline() {
    const host = $('pipeline');
    host.innerHTML = '';
    thumbs.clear();
    cardRefs.length = 0;
    // region card (stage 0)
    const c0 = h('div', { class: 'card region-card' + (S.focus === 0 ? ' focus' : ''), 'data-k': 0, tabindex: 0, role: 'button', 'aria-label': 'Region: show the whole chain', 'data-tip': 'Show the whole chain',
      onclick: () => setFocus(0), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setFocus(0); } } },
    h('div', { class: 'card-head' }, h('span', { class: 'idx', html: '<i>z</i>' }), h('span', { class: 'nm' }, 'Region')),
    h('div', { class: 'thumb' }, h('canvas'), h('span', { class: 'thumb-var', html: '<i>z</i>' })),
    h('div', { class: 'note' }), h('div', { class: 'swatches' }));
    host.append(c0);
    thumbs.set(0, new Pane(c0.querySelector('canvas')));
    S.steps.forEach((st, i) => {
      const k = i + 1;
      host.append(connector(k));
      const card = makeCard(st, k);
      host.append(card.root);
      cardRefs[k] = card;
      thumbs.set(k, new Pane(card.canvas));
    });
    host.append(connector(S.steps.length + 1));
    host.lastChild.classList.add('conn-last');
    host.append(h('button', { class: 'add-card', id: 'addStepBtn', 'data-tip': 'Add a function  +', onclick: (e) => openPalette(e.currentTarget, S.steps.length, { fnOnly: true }) },
      h('span', { html: ICONS.plus }), h('span', null, S.steps.length ? 'Add function' : 'Add the first function'), h('span', { class: 'kbd' }, '+')));
    updateRegionCard();
    updateCards();
    updateFocusUI();
    renderComposeTex();
    requestRender('T');
  }
  // a step of a type this build does not know still gets a card (its error comes from Funcs.build)
  const defOf = (st) => Funcs.DEFS[st.type] || { label: String(st.type), params: [] };
  const cardButton = (k) => document.querySelector(`#pipeline .card[data-k="${k}"] .nm`);
  function stepMenu(anchor, k) {
    const st = S.steps[k - 1], d = defOf(st);
    const items = [
      { label: 'Move left', icon: 'chevL', disabled: k === 1, run: () => moveStep(k, -1) },
      { label: 'Move right', icon: 'chevR', disabled: k === S.steps.length, run: () => moveStep(k, 1) },
      { label: 'Duplicate', icon: 'copy', run: () => duplicateStep(k) },
      { label: 'Replace with derivative', disabled: isDerivStep(st, built[k - 1]), run: () => derivativeAction(k) },
      { label: 'Insert d/dz after it', disabled: !Funcs.DEFS.deriv, run: () => addStep('deriv', null, k) },
    ];
    if (d.presets) items.push({ label: 'Presets', kids: d.presets.map((p) => ({ label: p.label, run: () => { Object.assign(st.params, p.params); chainChanged(true); commit(); } })) });
    // a polynomial or rational map by its zeros and poles (dragged in the input plane), and back
    const bk = built[k - 1];
    if (Funcs.DEFS.zp && (st.type === 'poly' || st.type === 'rational' || (st.type === 'custom' && bk && !bk.error && bk.props && bk.props.rational && !bk.usesCut))) items.push({ label: 'Write by zeros and poles', disabled: !!(bk && (bk.error || (bk.props && bk.props.constant))), run: () => convertZp(k, true) });
    if (st.type === 'zp') items.push({ label: 'Write by coefficients', disabled: !!(bk && bk.error), run: () => convertZp(k, false) });
    items.push('sep', { label: 'Remove', icon: 'trash', danger: true, run: () => removeStep(k) });
    openMenu(anchor, items);
  }
  function cardClick(k) {
    if (S.compact) { if (S.focus !== k) setFocus(k); openCardPop(k); return; }
    setFocus(S.focus === k ? 0 : k);
  }
  function makeCard(st, k) {
    const d = defOf(st);
    const stop = (e) => e.stopPropagation();
    const off = st.on === false;
    const invBtn = h('button', { class: 'icon-btn txt', 'data-tip': 'Replace with the inverse', 'aria-label': 'Replace with the inverse function', html: '<i>f</i><sup>−1</sup>', onclick: (e) => { stop(e); inverseAction(k); } });
    // a d/dz step differentiates the chain so far: no parameters, no inverse
    if (isDerivStep(st)) invBtn.hidden = true;
    const byp = h('button', { class: 'icon-btn bypass', 'aria-pressed': String(off), 'data-tip': off ? 'Turn this step back on' : 'Bypass this step', 'aria-label': 'Bypass this step', html: ICONS.bypass,
      onclick: (e) => { stop(e); st.on = st.on === false; chainChanged(true); commit(); if (st.on) startTransition(k); } });
    const more = h('button', { class: 'icon-btn more', 'data-tip': 'More', 'aria-label': `More actions for f${sub(k)}`, 'aria-haspopup': 'menu', html: ICONS.more, onclick: (e) => { stop(e); stepMenu(e.currentTarget, k); } });
    // the card is a group; its name is the button that focuses the step, beside (not around) the other controls
    const root = h('div', { class: 'card', 'data-k': k, role: 'group', 'aria-label': `f${sub(k)}: ${d.label}`,
      onclick: () => cardClick(k),
      onpointerenter: () => hiStep(k, true), onpointerleave: () => hiStep(k, false) });
    const nm = h('span', { class: 'nm', role: 'button', tabindex: 0, 'aria-label': `f${sub(k)}: ${d.label}`,
      onkeydown: (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardClick(k); }
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); e.stopPropagation(); removeStep(k); }
      } }, d.label);
    const head = h('div', { class: 'card-head', draggable: 'true' },
      h('span', { class: 'grip', html: ICONS.grip, 'aria-hidden': 'true' }),
      h('span', { class: 'idx', html: fsub(k) }),
      nm,
      h('span', { class: 'acts' }, invBtn, byp, more));
    head.addEventListener('dragstart', (e) => {
      if (e.target.closest && e.target.closest('button')) { e.preventDefault(); return; }
      dragStep = k; root.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move';
      try { e.dataTransfer.setData('text/plain', String(k)); e.dataTransfer.setDragImage(root, 24, 14); } catch (err) { /* ignore */ }
    });
    head.addEventListener('dragend', () => { dragStep = 0; root.classList.remove('dragging'); for (const c of document.querySelectorAll('.conn.drop')) c.classList.remove('drop'); });
    const canvas = h('canvas');
    const ftex = h('div', { class: 'ftex' });
    const btag = h('span', { class: 'btag' });
    const params = h('div', { class: 'params' + (st.type === 'mobius' ? ' matrix2' : '') + (st.type === 'zp' ? ' zp' : ''), onclick: stop });
    if (st.type === 'zp' && Funcs.DEFS.zp) params.append(zpFields(st, k, 'p'));
    else for (const q of d.params) params.append(paramField(st, k, q));
    const errEl = h('div', { class: 'err-msg' });
    const note = h('div', { class: 'note' });
    const chips = h('div', { class: 'pchips' });
    root.append(head, h('div', { class: 'thumb' }, canvas, h('span', { class: 'thumb-var', html: wsub(k) })), h('div', { class: 'ftex-row' }, ftex, btag), params, note, errEl, chips);
    if (S.focus === k) root.classList.add('focus');
    if (off) root.classList.add('off');
    return { root, canvas, ftex, btag, errEl, note, chips, invBtn, params };
  }
  // compact mode: a card's parameters open in a popover above it
  function openCardPop(k) {
    closePalette();
    const st = S.steps[k - 1], d = defOf(st);
    const card = document.querySelector(`#pipeline .card[data-k="${k}"]`);
    if (!card || !d.params.length) return;
    const params = h('div', { class: 'params' + (st.type === 'mobius' ? ' matrix2' : '') + (st.type === 'zp' ? ' zp' : '') });
    if (st.type === 'zp' && Funcs.DEFS.zp) params.append(zpFields(st, k, 'pp'));
    else for (const q of d.params) params.append(paramField(st, k, q, 'pp'));
    const pop = h('div', { class: 'pop card-pop', 'data-k': k, role: 'dialog', 'aria-label': `Parameters of f${sub(k)}` },
      h('div', { class: 'pop-title', html: `<span class="idx">${fsub(k)}</span> ${d.label}` }), params);
    $('popHost').append(pop);
    popEl = pop;
    const r = card.getBoundingClientRect(), pw = pop.offsetWidth, ph = pop.offsetHeight;
    let y = r.top - ph - 6;
    if (y < 8) y = r.bottom + 6;
    pop.style.left = Math.max(8, Math.min(window.innerWidth - pw - 8, r.left)) + 'px';
    pop.style.top = Math.max(8, y) + 'px';
    const back = card.querySelector('.nm'), bkey = focusKey(back);
    pop.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      if (padEl) { closePad(); return; } // Esc closes the Argand pad first
      closePalette(); focusBack(back, bkey);
    });
    const first = pop.querySelector('input,select');
    if (first) first.focus({ preventScroll: true });
    armOutside(card);
  }
  // dragging horizontally on a label changes a numeric field
  function scrubbable(label, input, step, isInt) {
    label.classList.add('scrub');
    label.title = (label.title ? label.title + ' · ' : '') + 'drag to change';
    label.style.touchAction = 'pan-y'; // a sideways touch scrubs instead of scrolling the chain
    label.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const x0 = e.clientX, v0 = Number(input.value) || 0;
      let moved = 0;
      try { label.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      const move = (ev) => {
        const dx = ev.clientX - x0;
        moved = Math.max(moved, Math.abs(dx));
        let v = v0 + Math.round(dx / (ev.shiftKey ? 12 : 4)) * step;
        if (isInt) v = Math.round(v);
        if (input.min !== '' && v < +input.min) v = +input.min;
        if (String(v) !== input.value) { input.value = +v.toFixed(6); input.dispatchEvent(new Event('input')); }
      };
      // an ended, cancelled or lost pointer all finish the scrub once: what it applied is committed
      const ends = ['pointerup', 'pointercancel', 'lostpointercapture'];
      const up = () => {
        label.removeEventListener('pointermove', move);
        for (const t of ends) label.removeEventListener(t, up);
        // after a real scrub, the click that follows would activate the label and focus the field, where ⌘Z is
        // the field's own (empty) undo: swallow that one click, so the app's undo takes back the scrub
        if (moved > 2) {
          const swallow = (ce) => { ce.preventDefault(); ce.stopPropagation(); };
          label.addEventListener('click', swallow, { capture: true, once: true });
          setTimeout(() => label.removeEventListener('click', swallow, { capture: true }), 0);
          if (document.activeElement === input) input.blur();
        }
        input.dispatchEvent(new Event('change'));
      };
      label.addEventListener('pointermove', move);
      for (const t of ends) label.addEventListener(t, up);
    });
  }
  // a small Argand diagram to pick a complex value by dragging
  let padEl = null, padOff = null;
  function closePad() {
    if (padOff) { document.removeEventListener('pointerdown', padOff, true); padOff = null; }
    if (padEl) { padEl.remove(); padEl = null; }
  }
  function openArgandPad(anchor, input) {
    closePad();
    let v;
    try { v = Expr.constValue(input.value); } catch (e) { v = C(0, 0); }
    const R = Math.max(2, Axes.niceStep(Math.max(Math.abs(v.re), Math.abs(v.im)) * 1.6 || 2));
    const S2 = 200;
    const cv = h('canvas', { width: S2 * 2, height: S2 * 2, style: `width:${S2}px;height:${S2}px`, tabindex: 0, role: 'application', 'aria-roledescription': 'Argand diagram',
      'aria-label': 'Complex value. Arrow keys move the point, Shift for fine steps; Enter or Esc closes.' });
    const read = h('div', { class: 'pad-read mono', 'aria-live': 'polite' });
    const pad = h('div', { class: 'pop pad', role: 'dialog', 'aria-label': 'Pick a complex value' }, cv, read, h('div', { class: 'lbl' }, 'Drag the point, or use the arrow keys. Hold Shift for fine steps.'));
    $('popHost').append(pad);
    padEl = pad;
    const ctx = cv.getContext('2d');
    const toPx = (z) => [S2 / 2 + z.re / R * S2 / 2, S2 / 2 - z.im / R * S2 / 2];
    const draw = () => {
      ctx.setTransform(2, 0, 0, 2, 0, 0);
      ctx.fillStyle = TH.plane; ctx.fillRect(0, 0, S2, S2);
      const st = Axes.niceStep(R / 4);
      ctx.strokeStyle = TH.gridMajor; ctx.lineWidth = 1;
      for (let x = -R; x <= R + 1e-9; x += st) { const [px] = toPx(C(x, 0)); ctx.beginPath(); ctx.moveTo(px + 0.5, 0); ctx.lineTo(px + 0.5, S2); ctx.stroke(); const [, py] = toPx(C(0, x)); ctx.beginPath(); ctx.moveTo(0, py + 0.5); ctx.lineTo(S2, py + 0.5); ctx.stroke(); }
      ctx.strokeStyle = TH.axis;
      ctx.beginPath(); ctx.moveTo(S2 / 2 + 0.5, 0); ctx.lineTo(S2 / 2 + 0.5, S2); ctx.moveTo(0, S2 / 2 + 0.5); ctx.lineTo(S2, S2 / 2 + 0.5); ctx.stroke();
      ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(S2 / 2, S2 / 2, S2 / 2 / R, 0, TAU); ctx.stroke(); ctx.setLineDash([]);
      const [px, py] = toPx(v);
      ctx.strokeStyle = TH.accent; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(S2 / 2, S2 / 2); ctx.lineTo(px, py); ctx.stroke();
      ctx.fillStyle = TH.accent; ctx.beginPath(); ctx.arc(px, py, 5.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = TH.plane; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = TH.label; ctx.font = `10px ${TH.mono}`; ctx.textAlign = 'right'; ctx.fillText(`±${CX.fmtNum(R, 3)}`, S2 - 4, S2 - 5);
      read.textContent = `${CX.fmt(v, 4)}   |·| ${CX.fmtNum(CX.abs(v), 4)}   arg ${CX.fmtNum(Math.atan2(v.im, v.re) / DEG, 2)}°`;
    };
    draw();
    const set = (e) => {
      const r = cv.getBoundingClientRect();
      const x = (e.clientX - r.left) / S2 * 2 - 1, y = 1 - (e.clientY - r.top) / S2 * 2;
      const st = e.shiftKey ? R / 400 : R / 40;
      v = C(Math.round(x * R / st) * st, Math.round(y * R / st) * st);
      v = C(+v.re.toPrecision(6), +v.im.toPrecision(6));
      input.value = CX.fmt(v, 6).replace(/\s/g, '');
      input.dispatchEvent(new Event('input'));
      draw();
    };
    cv.addEventListener('pointerdown', (e) => {
      try { cv.setPointerCapture(e.pointerId); } catch (err) { /* pointer already gone */ }
      set(e);
      const ends = ['pointerup', 'pointercancel', 'lostpointercapture'];
      const mv = (ev) => set(ev);
      const up = () => { cv.removeEventListener('pointermove', mv); for (const t of ends) cv.removeEventListener(t, up); input.dispatchEvent(new Event('change')); };
      cv.addEventListener('pointermove', mv); for (const t of ends) cv.addEventListener(t, up);
    });
    // keyboard: arrows nudge on the same grid as dragging; Enter or Esc closes and returns to the opener
    const back = () => { closePad(); if (anchor.isConnected) anchor.focus({ preventScroll: true }); };
    pad.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (e.key !== 'Tab') e.stopPropagation();
      if (d) {
        e.preventDefault();
        const st = e.shiftKey ? R / 400 : R / 40;
        const q = (x, dx) => +Math.max(-R, Math.min(R, Math.round(x / st) * st + dx * st)).toPrecision(6);
        v = C(q(v.re, d[0]), q(v.im, d[1]));
        input.value = CX.fmt(v, 6).replace(/\s/g, '');
        input.dispatchEvent(new Event('input'));
        draw();
      } else if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); back(); }
    });
    pad.addEventListener('keyup', (e) => { if (e.key.startsWith('Arrow')) input.dispatchEvent(new Event('change')); });
    const r = anchor.getBoundingClientRect();
    const pw = pad.offsetWidth, ph = pad.offsetHeight;
    let y = r.top - ph - 6;
    if (y < 12) y = r.bottom + 6;
    pad.style.left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left - pw / 2)) + 'px';
    pad.style.top = Math.max(12, Math.min(window.innerHeight - ph - 12, y)) + 'px';
    cv.focus({ preventScroll: true });
    setTimeout(() => {
      if (padEl !== pad) return;
      // a press outside closes the pad; a press on its opener (or the icon inside it) is the opener's toggle
      padOff = (e) => { if (padEl && !padEl.contains(e.target) && !anchor.contains(e.target)) closePad(); };
      document.addEventListener('pointerdown', padOff, true);
    }, 0);
  }
  // short symbols for parameter labels (the full name is the tooltip)
  const PSYM = { cut: ['θ', 'Cut angle, in degrees'], k: ['k', 'Sheet (branch index)'], branch: ['br', 'Branch'],
    co: ['aₖ', 'Coefficients aₙ, …, a₀, highest degree first'], p: ['p', 'Numerator coefficients, highest degree first'], q: ['q', 'Denominator coefficients, highest degree first'] };
  function paramField(st, k, q, pre = 'p') {
    const val = st.params[q.key] ?? q.def;
    const upd = (v) => { st.params[q.key] = v; chainChanged(false); syncParam(k, q.key, pre); };
    let input, extra = null;
    const id = `${pre}${k}_${q.key}`;
    if (q.type === 'choice') {
      input = h('select', { class: 'inp', id, onchange: (e) => { upd(e.target.value); commit(); } }, ...q.choices.map(([v, l]) => h('option', { value: v }, l)));
      input.value = val;
    } else if (q.type === 'int' || q.type === 'angle') {
      input = h('input', { class: 'inp', id, type: 'number', step: '1', value: val, min: q.min });
      // an empty or unreadable field (Number('') is 0) is flagged and never applied; leaving it shows the value in use again
      const unread = () => input.value.trim() === '' || !!(input.validity && input.validity.badInput) || !Number.isFinite(Number(input.value));
      input.addEventListener('input', () => {
        if (unread()) {
          input.classList.add('bad'); input.setAttribute('aria-invalid', 'true');
          input.setAttribute('data-tip', `Enter a number; ${q.label} stays ${st.params[q.key] ?? q.def}`);
          return;
        }
        const v = Number(input.value);
        const okInt = q.type !== 'int' || (Number.isInteger(v) && (q.min == null || v >= q.min));
        input.classList.toggle('bad', !okInt); input.setAttribute('aria-invalid', String(!okInt));
        if (!okInt) input.setAttribute('data-tip', `Uses ${Math.max(q.min ?? -Infinity, Math.round(v))}: ${q.label} must be a whole number${q.min != null ? ` ≥ ${q.min}` : ''}`); else input.removeAttribute('data-tip');
        upd(q.type === 'int' ? Math.round(v) : v);
      });
      input.addEventListener('change', () => {
        if (unread()) input.value = st.params[q.key] ?? q.def;
        const v = Number(input.value);
        if (q.type === 'int' && Number.isFinite(v)) { const r = Math.min(q.max ?? Infinity, Math.max(q.min ?? -Infinity, Math.round(v))); if (r !== v) { input.value = r; upd(r); } }
        input.classList.remove('bad'); input.removeAttribute('data-tip'); input.removeAttribute('aria-invalid');
        commit();
      });
      if (q.key === 'cut' && pre === 'p') input.dataset.cutStep = k;
    } else {
      input = h('input', { class: 'inp', id, value: val, spellcheck: 'false', autocomplete: 'off' });
      input.addEventListener('input', () => {
        if (q.type === 'cx') { try { Expr.constValue(input.value); input.classList.remove('bad'); } catch (e) { input.classList.add('bad'); } }
        upd(input.value);
      });
      input.addEventListener('change', () => commit());
      if (q.type === 'cx') extra = h('button', { class: 'icon-btn argand', 'data-tip': 'Pick on an Argand diagram', 'aria-label': `Pick ${q.label} on an Argand diagram`, html: ICONS.argand, onclick: (e) => { e.preventDefault(); e.stopPropagation(); if (padEl) closePad(); else openArgandPad(e.currentTarget, input); } });
    }
    input.dataset.pkey = q.key;
    const wide = q.type === 'expr' || q.type === 'coeffs';
    const sym = PSYM[q.key];
    const labelText = sym ? sym[0] : q.label;
    const lab = h('label', { class: 'pl', for: id, 'data-tip': sym ? sym[1] : q.label }, labelText);
    if (q.type === 'int' || q.type === 'angle') scrubbable(lab, input, 1, q.type === 'int');
    return h('div', { class: 'pf' + (wide ? ' wide' : '') + (q.type === 'cx' ? ' cx' : '') }, lab, extra ? h('div', { class: 'pair' }, input, extra) : input);
  }
  // keep the card's field and the compact popover's field in step
  function syncParam(k, key, from) {
    const v = S.steps[k - 1] && S.steps[k - 1].params[key];
    for (const el of document.querySelectorAll(`[id$="${k}_${key}"][data-pkey="${key}"]`)) {
      if (el.id === `${from}${k}_${key}` || document.activeElement === el) continue;
      if (String(el.value) !== String(v)) el.value = v;
    }
  }
  const CHIP_DEFS = [['analytic', 'A', 'Analytic'], ['entire', 'E', 'Entire'], ['rational', 'R', 'Rational'], ['polynomial', 'P', 'Polynomial'], ['mobius', 'M', 'Möbius'], ['proper', 'Pr', 'Proper'], ['injective', 'I', 'Injective (a homeomorphism onto its image)']];
  function branchTag(st, b) {
    if (st.params.cut == null || !b.cuts.some((c) => c.editable)) return '';
    let deg = ((+st.params.cut % 360) + 360) % 360;
    if (deg > 180) deg -= 360; // same convention as the θ field: (−180°, 180°]
    let t = `cut ${String(+deg.toFixed(1)).replace('-', '−')}°`;
    const kk = Math.round(+st.params.k || 0);
    if (st.type === 'root') { const n = Math.max(2, Math.round(+st.params.n || 2)); t += `, sheet ${((kk % n) + n) % n}/${n}`; }
    else if (kk) t += `, sheet ${kk}`;
    return t;
  }
  function updateCards() {
    S.steps.forEach((st, i) => {
      const k = i + 1;
      const c = cardRefs[k];
      if (!c) return;
      const b = built[i];
      const bad = !!(b && b.error);
      c.root.classList.toggle('off', st.on === false);
      c.root.classList.toggle('bad', bad);
      // text is written only when it changes, so a scrub tick does not dirty the layout of every card
      const setText = (el, t) => { if (el.textContent !== t) el.textContent = t; };
      setText(c.errEl, bad ? `f${sub(k)} (${b.def ? b.def.label : Funcs.DEFS[st.type].label}): ${b.error}` : '');
      // f⁻¹ always answers: the inverse when there is a single-valued one, otherwise why not (and the preimages)
      c.invBtn.disabled = !b || bad;
      const invTip = b && b.inverse ? 'Replace with the inverse' : 'No single inverse: show why';
      if (c.invBtn.dataset.tip !== invTip) { c.invBtn.dataset.tip = invTip; c.invBtn.setAttribute('aria-label', b && b.inverse ? 'Replace with the inverse function' : 'Why this step has no single inverse'); }
      if (b && !bad) {
        const tx = b.tex({ s: wvar(k - 1), p: 4 }).s;
        TeX.set(c.ftex, `w_{${k}}=${tx}`);
        setText(c.btag, branchTag(st, b));
        c.btag.hidden = !c.btag.textContent;
        const drags = b.cuts.some((x) => x.editable) ? 'Drag the seam in the input plane' : st.type === 'zp' ? 'Drag the zeros and poles in the input plane' : null;
        setText(c.note, [b.branchNote, drags].filter(Boolean).map((x) => x.replace(/\.$/, '')).join('. ') + (b.branchNote || drags ? '.' : ''));
        // property chips are built once and then only toggled (a scrub calls this on every tick); a d/dz card shows
        // what the chain so far guarantees after differentiating (the fold of Funcs.composeProps)
        if (c.chips.childElementCount !== CHIP_DEFS.length) { c.chips.innerHTML = ''; for (const [, ab] of CHIP_DEFS) c.chips.append(h('span', { class: 'pchip' }, ab)); }
        const pr = isDerivStep(st, b) ? Funcs.composeProps(activeSteps().filter((j) => j <= k).map((j) => built[j - 1].props)) : b.props;
        CHIP_DEFS.forEach(([key, , title], j) => {
          const el = c.chips.children[j], on = !!pr[key];
          if (el.classList.contains('on') === on && el.dataset.tip) return;
          el.classList.toggle('on', on);
          el.setAttribute('data-tip', `${title}: ${on ? 'guaranteed' : 'not guaranteed'}`);
        });
      } else {
        c.ftex.innerHTML = ''; c.ftex.dataset.tex = '';
        c.btag.textContent = ''; c.btag.hidden = true;
        c.note.textContent = '';
        c.chips.innerHTML = '';
      }
    });
    renderComposeTex();
    requestRender('T');
  }
  function renderComposeTex() {
    const act = activeSteps();
    const el = $('composeTex');
    if (!act.length) { TeX.set(el, 'F=\\mathrm{id}'); return; }
    // a d/dz step differentiates the composite so far: [f₁, f₂, d/dz, f₃] reads F = f₃ ∘ (f₂ ∘ f₁)′
    let acc = '';
    for (const k of act) {
      if (isDeriv(k)) acc = acc ? (/\\circ/.test(acc) ? `\\left(${acc}\\right)'` : `${acc}'`) : '\\mathrm{id}\'';
      else acc = acc ? `f_{${k}}\\circ ${acc}` : `f_{${k}}`;
    }
    TeX.set(el, `F=${acc}`);
  }
  function addStep(type, params, at) {
    const st = { type, params: Object.assign(Funcs.defaults(type), params || {}), on: true };
    if (at == null) at = S.focus > 0 ? S.focus : S.steps.length;
    at = Math.max(0, Math.min(S.steps.length, at));
    S.steps.splice(at, 0, st);
    chainChanged(true);
    setFocus(at + 1);
    commit();
    startTransition(at + 1);
    noteRecent(type);
    const card = document.querySelector(`#pipeline .card[data-k="${at + 1}"]`);
    if (card) card.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    return cardButton(at + 1);
  }
  function removeStep(k) {
    const name = defOf(S.steps[k - 1]).label;
    S.steps.splice(k - 1, 1);
    if (S.focus >= k) S.focus = Math.max(0, S.focus === k ? 0 : S.focus - 1);
    chainChanged(true);
    setFocus(S.focus);
    commit();
    undoToast(`Removed f${sub(k)} (${name}).`);
  }
  function duplicateStep(k) {
    const st = S.steps[k - 1];
    S.steps.splice(k, 0, JSON.parse(JSON.stringify(st)));
    chainChanged(true);
    setFocus(k + 1);
    commit();
    return cardButton(k + 1); // the new card takes the keyboard focus
  }
  function moveStep(k, d) {
    const j = k - 1 + d;
    if (j < 0 || j >= S.steps.length) return null;
    const [st] = S.steps.splice(k - 1, 1);
    S.steps.splice(j, 0, st);
    chainChanged(true);
    setFocus(j + 1);
    commit();
    return cardButton(j + 1); // the moved card keeps the keyboard focus
  }
  function invertStep(k) {
    const b = built[k - 1];
    if (!b || !b.inverse) return;
    const st = S.steps[k - 1];
    st.type = b.inverse.type;
    st.params = Object.assign(Funcs.defaults(b.inverse.type), b.inverse.params);
    chainChanged(true);
    setFocus(k);
    commit();
    undoToast(`Replaced f${sub(k)} with its inverse (${defOf(st).label}).`);
  }
  // f⁻¹ on a card (and "Inverse of f_k" in the palette): the inverse step when the step has a single-valued one on
  // its branch; otherwise the reason, with the way to see every preimage instead
  function inverseAction(k) {
    const b = built[k - 1], st = S.steps[k - 1];
    if (!b || b.error || !st || isDerivStep(st, b)) return;
    if (b.inverse) { invertStep(k); return cardButton(k); }
    const why = b.inverseNote || `${defOf(st).label} takes some values more than once, so it has no single inverse.`;
    toast(why.replace(/\.?$/, '.'), 'Show preimages', () => {
      // a target point at 0 (unless there is one) shows every preimage of it in the left plane
      if (S.focus !== k) setFocus(k);
      if (!S.targets.some((t) => t.visible !== false && t.kind === 'point')) addShape(newShape('point', { p: [0, 0] }, true), true);
      fitLeftToSolutions();
    });
    return null;
  }
  // "Show preimages" promises every solution of f(w) = p: for a rational step of known degree d, widen the left
  // view (up to 2⁸ times) until the point targets' d solutions are all in it
  function fitLeftToSolutions() {
    const deg = focusDegree();
    if (!deg || !hasCalc('zerosPoles') || !paneL || !(paneL.w > 0) || !lFlat()) return;
    const pts = S.targets.filter((s) => s.visible !== false && s.kind === 'point');
    if (!pts.length) return;
    const F = focusF(), b0 = paneBox(paneL, leftView());
    const cx = (b0.x0 + b0.x1) / 2, cy = (b0.y0 + b0.y1) / 2, hw = (b0.x1 - b0.x0) / 2, hh = (b0.y1 - b0.y0) / 2;
    const all = [];
    let done = false;
    // (bounded in time: about 0.8 s on the main thread at most; a search cut short counts as not done)
    const t0 = performance.now();
    for (let j = 0; j <= 8 && !done; j++) {
      if (j && performance.now() - t0 > 800) break;
      const m = 2 ** j, box = { x0: cx - hw * m, x1: cx + hw * m, y0: cy - hh * m, y1: cy + hh * m };
      all.length = 0; done = true;
      for (const s of pts) {
        let sols = [];
        try { sols = zerosPolesTimed(F, box, { target: { re: s.p[0], im: s.p[1] }, max: 40 }, Math.max(30, 150 / pts.length)); } catch (e) { sols = []; }
        const zs = sols.filter((r) => r && r.kind !== 'pole' && r.z && CX.isFin(r.z));
        all.push(...zs);
        // a polynomial has all d in ℂ; a rational map may send ∞ to p, so d − 1 is enough for it
        if (zs.reduce((a, r) => a + (r.mult || 1), 0) < deg.d - (deg.poly ? 0 : 1)) done = false;
      }
      if (j === 0 && done) return; // already in view
    }
    if (!all.length) return;
    const xs = [b0.x0, b0.x1], ys = [b0.y0, b0.y1];
    for (const r of all) { xs.push(r.z.re); ys.push(r.z.im); }
    const b = { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
    const m = 0.08 * Math.max(b.x1 - b.x0, b.y1 - b.y0);
    paneL.setView(leftView());
    const target = boxView(paneL, { x0: b.x0 - m, x1: b.x1 + m, y0: b.y0 - m, y1: b.y1 + m });
    if (leftStage() > 0) leftAuto = false;
    tweenView(leftView(), target, 260, () => sourceViewChanged());
  }
  // "Replace with derivative": the step becomes f′ (a custom step on the same branch), as one undoable change
  function derivativeAction(k) {
    const st = S.steps[k - 1];
    if (!st) return null;
    if (typeof Funcs.derivativeStep !== 'function') { toast('Derivatives are not available in this build.'); return null; }
    let r;
    try { r = Funcs.derivativeStep(st); } catch (e) { r = { error: e.message || String(e) }; }
    if (!r || r.error || !r.step) { toast((r && r.error) || `f${sub(k)} has no derivative here.`); return null; }
    const type = Funcs.DEFS[r.step.type] ? r.step.type : 'custom';
    S.steps[k - 1] = { type, params: Object.assign(Funcs.defaults(type), r.step.params || {}), on: st.on !== false };
    chainChanged(true);
    setFocus(k);
    commit();
    // the math note, without its "Derivative of …" preamble (the toast already says so)
    const note = String(r.note || '').replace(/^Derivative of [^;:]*[;:]?\s*/, '').replace(/\.$/, '');
    undoToast(`Replaced f${sub(k)} with its derivative${note ? ` (${note})` : ''}.`);
    return cardButton(k);
  }
  // ---------------- command palette ----------------
  const FN_INFO = {
    mul: ['Rotation and scaling; conformal on ℂ', 'scale rotate rotation multiply dilation'],
    add: ['Translation; conformal on ℂ', 'translate shift move'],
    affine: ['Rotate, scale and shift; conformal on ℂ', 'linear affine'],
    recip: ['A rotation of the Riemann sphere; circles to circles', 'inverse reciprocal inversion 1/z'],
    mobius: ['Circles to circles; ad − bc ≠ 0', 'mobius möbius fractional linear cayley bilinear'],
    blaschke: ['Automorphism of the unit disk', 'disk automorphism blaschke'],
    pown: ['n-fold cover of ℂ ∖ {0}; angles multiply by n', 'power square cube z^2 z^3'],
    root: ['Branch of the n-th root with a movable cut', 'sqrt root square root cube root nth root'],
    powa: ['z^α on a chosen branch', 'complex power exponent'],
    exp: ['Conformal on ℂ; injective on strips of height 2π', 'exponential e^z'],
    log: ['Branch of the logarithm with a movable cut', 'logarithm ln log'],
    sin: ['Half-strip to half-plane', 'sine'], cos: ['Half-strip to half-plane', 'cosine'], tan: ['Strip to the slit sphere', 'tangent'],
    sinh: ['Rotated sine', 'hyperbolic sine'], cosh: ['Rotated cosine', 'hyperbolic cosine'], tanh: ['Rotated tangent', 'hyperbolic tangent'],
    arcsin: ['Principal branch; cuts on the real axis beyond ±1', 'asin inverse sine'], arccos: ['Principal branch; cuts on the real axis beyond ±1', 'acos inverse cosine'], arctan: ['Principal branch; cuts on the imaginary axis beyond ±i', 'atan inverse tangent'],
    arsinh: ['Principal branch', 'asinh'], arcosh: ['Principal branch', 'acosh'], artanh: ['Principal branch', 'atanh'],
    joukowski: ['Circles through ±1 to airfoils', 'joukowski joukowsky airfoil'],
    ijouk: ['Branch of the inverse Joukowski map', 'inverse joukowski joukowsky'],
    conj: ['Reflection in the real axis; not analytic', 'conjugate reflection bar conj'],
    poly: ['Coefficients from the highest degree down', 'polynomial'],
    rational: ['Quotient of two polynomials', 'rational p/q'],
    zp: ['Drag its zeros and poles in the input plane', 'zeros poles roots factored polynomial rational drag place'],
    custom: ['Any formula in LaTeX or plain text', 'custom formula latex expression'],
    deriv: ['Derivative of the chain so far: w = (previous stage)′', 'derivative differentiate prime d/dz dz derivative of the chain'],
  };
  const RECENT_KEY = lsk('cmw-recent');
  function recentTypes() {
    try { return (JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') || []).filter((t) => Funcs.DEFS[t]).slice(0, 4); } catch (e) { return []; }
  }
  function noteRecent(t) {
    try { localStorage.setItem(RECENT_KEY, JSON.stringify([t, ...recentTypes().filter((x) => x !== t)].slice(0, 4))); } catch (e) { /* ignore */ }
  }
  const defaultPropsCache = new Map();
  function defaultProps(type) {
    if (!defaultPropsCache.has(type)) {
      const b = Funcs.build({ type, params: Funcs.defaults(type), on: true });
      defaultPropsCache.set(type, b && !b.error ? b.props : {});
    }
    return defaultPropsCache.get(type);
  }
  let popEl = null, palState = null;
  function closePalette() {
    closePad(); // the Argand pad never outlives the popover or menu around it
    if (!popEl) return;
    const back = palState && palState.opener;
    const onClose = popEl._onClose;
    popEl.remove(); popEl = null;
    if (onClose) onClose();
    if (palState) { clearTimeout(palState.pvTimer); palState = null; }
    if (back && back.isConnected && document.activeElement === document.body) back.focus({ preventScroll: true });
  }
  function paletteItems(q, fnOnly) {
    q = q.trim();
    const ql = q.toLowerCase();
    const items = [];
    const score = (text) => {
      if (!ql) return 1;
      const t = text.toLowerCase();
      if (t.startsWith(ql)) return 3;
      if (t.split(/[\s/,;()]+/).some((w) => w.startsWith(ql))) return 2;
      return t.includes(ql) ? 1 : 0;
    };
    // a formula typed into the search becomes a custom step (or a region, for a relation)
    // (a function's own name, such as d/dz, is not read as a formula)
    if (q && /[z(\\^|<>]/.test(q) && !Object.values(Funcs.DEFS).some((d) => String(d.label).toLowerCase() === ql)) {
      try {
        const ast = Expr.parse(q, { allowRel: true });
        if (Expr.hasBool(ast)) {
          const dm = !fnOnly && typeof Curves !== 'undefined' ? Curves.dimOf(ast) : { dim: 'area' };
          if (dm.dim === 'error') throw new Error(dm.error);
          if (!fnOnly && dm.dim === 'curve') {
            // an equation: a curve in the z-plane (the app's own shapes when recognized exactly)
            const plan = curvePlan(q, viewBox(S.srcView));
            items.push({ kind: 'region', group: 'Curve formulas', tex: Expr.toTex(ast).s, label: 'Add this curve', desc: `Adds ${plan.what} in the z-plane`, q: q.replace(/\s+/g, ''), run: () => { if (leftStage() > 0) setFocus(0); addCurveShapes(plan, false); } });
          } else if (!fnOnly) { Expr.compileLevel(ast); items.push({ kind: 'region', group: 'Region formulas', tex: Expr.toTex(ast).s, label: 'Add this region', desc: 'A set in the z-plane', q: q.replace(/\s+/g, ''), run: () => { if (leftStage() > 0) setFocus(0); addShape(newShape('formula', { expr: q })); } }); }
        } else if (Expr.depends(ast) && [...Expr.usesVars(ast)].every((v) => v === 'z')) {
          const cb = Funcs.build({ type: 'custom', params: { expr: q, cut: 180 }, on: true });
          items.push({ kind: 'fn', type: 'custom', params: { expr: q }, group: 'Custom formula', tex: `f(z)=${Expr.toTex(ast).s}`, label: 'Custom formula', desc: cb.error ? cb.error : 'Adds this formula as a step', props: cb.error ? {} : cb.props, run: (at) => addStep('custom', { expr: q }, at) });
        }
      } catch (e) { items.parseErr = e.message; } // shown when nothing else matches
    }
    const fnItem = (d, group, sc) => {
      const [desc] = FN_INFO[d.id] || [''];
      return { kind: 'fn', type: d.id, group, tex: d.menuTex, label: d.label, desc, sc, props: defaultProps(d.id), run: (at) => addStep(d.id, null, at) };
    };
    if (!ql) for (const t of recentTypes()) items.push(fnItem(Funcs.DEFS[t], 'Recently used', 1));
    const fns = [];
    for (const g of Funcs.GROUPS) {
      for (const d of Object.values(Funcs.DEFS).filter((x) => x.group === g)) {
        const [desc, alias] = FN_INFO[d.id] || ['', ''];
        const ls = score(d.label);
        const sc = Math.max(ls ? ls + 1 : 0, score(alias), score(d.id), ql && score(desc) ? 0.5 : 0);
        if (ql && sc < 0.5) continue;
        fns.push(fnItem(d, g, sc));
      }
    }
    // d/dz: an operator on the chain so far, listed even when its group is not one of the function groups
    const dd = Funcs.DEFS.deriv;
    if (dd && !Funcs.GROUPS.includes(dd.group)) {
      const [desc, alias] = FN_INFO.deriv;
      const sc = Math.max(score(dd.label) ? score(dd.label) + 1 : 0, score(alias), score('deriv'), ql && score(desc) ? 0.5 : 0);
      if (!ql || sc >= 0.5) fns.push(fnItem(dd, 'Calculus', sc));
    }
    if (ql) fns.sort((a, b) => b.sc - a.sc);
    items.push(...fns);
    if (!fnOnly) {
      const typed = items.find((x) => x.kind === 'region');
      for (const c of REGION_EXAMPLES) if ((!ql || score(c)) && !(typed && typed.q === c.replace(/\s+/g, ''))) items.push({ kind: 'region', group: 'Region formulas', tex: c, label: 'Add region', desc: '', run: () => { if (leftStage() > 0) setFocus(0); addShape(newShape('formula', { expr: c })); } });
      EX.forEach((ex, i) => { if (!exOk(ex)) return; if (!ql || score(ex.name.replace(/\\[a-z]+/g, ' ')) || score(ex.blurb || '')) items.push({ kind: 'ex', i, group: 'Examples', tex: ex.tex || '', label: ex.name.replace(/\$/g, ''), desc: ex.blurb || '', run: () => loadExample(i) }); });
      // every step's inverse and derivative (a d/dz step has neither)
      S.steps.forEach((st, i) => {
        const k = i + 1, nm = defOf(st).label;
        if (isDerivStep(st, built[i])) return;
        for (const [what, run] of [['Inverse', () => inverseAction(k)], ['Derivative', () => derivativeAction(k)]]) {
          const label = `${what} of f${sub(k)} (${nm})`;
          if (!ql || score(`${what} of f${k} ${nm}`) || score(label)) items.push({ kind: 'cmd', group: 'Steps', label, key: '', run });
        }
      });
      // the views are also found by what they are for (roots, contour integrals, …)
      // (U8: the panes' views, with the words of the earlier single view control as aliases)
      // (comma-separated phrases, each matched on its own: a query that starts a phrase scores 3, one that starts a
      // word 2, so multi-word aliases such as 'phase portrait' and 'domain colouring' are found)
      const VIEW_ALIAS = {
        xy: 'x to y, x -> y, split, both planes, domain and image, shapes and images, planes',
        lplane: 'left plane, domain, z-plane, shapes, regions', lsphere: 'left sphere, riemann sphere, globe, infinity, domain sphere, z-sphere, phase sphere',
        land: 'left landscape, landscape, 3d, surface, riemann surface, modulus surface, height, relief, sheets',
        phase: 'phase portrait, domain colouring, domain coloring, colouring, coloring, color, colour, phase, argument, modulus, left phase',
        rplane: 'right plane, image, image plane, map, targets, preimages, w-plane', rsphere: 'right sphere, riemann sphere, globe, infinity, image sphere, w-sphere',
      };
      const aliasScore = (alias) => Math.max(0, ...alias.split(',').map((p) => score(p.trim())));
      const view = [
        ['View: X → Y', () => setMain('xy'), '1', VIEW_ALIAS.xy],
        ['View: Phase portrait', () => setMain('phase'), '2', VIEW_ALIAS.phase],
        ['View: Landscape', () => setMain('land'), '3', VIEW_ALIAS.land],
        [S.view.main === 'phase' ? 'Phase: Plane' : 'X: Plane', () => { if (lLand()) setMain('xy'); setView('L', 'plane'); }, lLand() ? '' : '⇧1', VIEW_ALIAS.lplane],
        [S.view.main === 'phase' ? 'Phase: Sphere' : 'X: Sphere', () => { if (lLand()) setMain('xy'); setView('L', 'sphere'); }, lLand() ? '' : '⇧2', VIEW_ALIAS.lsphere],
        ['Y: Plane', () => { setMain('xy'); setView('R', 'plane'); }, S.view.main === 'xy' ? '⇧3' : '', VIEW_ALIAS.rplane],
        ['Y: Sphere', () => { setMain('xy'); setView('R', 'sphere'); }, S.view.main === 'xy' ? '⇧4' : '', VIEW_ALIAS.rsphere],
        [morph.open ? 'Deformation off' : 'Deformation on (play the homotopy)', () => toggleTransport(), 'M', 'morph deformation homotopy animate animation merge'],
        [S.morphPaths !== false ? 'Deformation: hide the paths t ↦ H_t(z)' : 'Deformation: show the paths t ↦ H_t(z)', () => setMorphPaths(!(S.morphPaths !== false)), morphOn() && S.view.main === 'xy' ? 'P' : '', 'paths trajectories arrows homotopy deformation lines'],
        [S.homAll ? 'Deformation: the steps one after another' : 'Deformation: all steps at once', () => setHomAll(!S.homAll), '', 'deformation order steps simultaneous together sequence homotopy at once'],
        ['Integrate along the selected curve', () => integrateSelected(), '', 'contour line integral integrate residue residues winding number argument principle cauchy'],
        ['Show the roots: a target at 0', () => { if (S.targets.some((t) => t.visible !== false && t.kind === 'point' && t.p[0] === 0 && t.p[1] === 0)) return; addShape(newShape('point', { p: [0, 0] }, true), true); }, '', 'roots zeros poles solve solutions equation preimages target'],
        ...(Funcs.DEFS.deriv ? [['Derivative of the chain: add d/dz', () => addStep('deriv', null, S.focus > 0 ? S.focus : S.steps.length), '', 'derivative prime differentiate d/dz']] : []),
        ['Fit both planes', () => $('leftFit').click() || $('rightFit').click(), 'Z'],
        ['Unit circle on or off', () => $('unitChk').click(), ''],
        ['Snap while drawing on or off', () => $('snapBtn').click(), ''],
        ['Switch theme', () => $('themeBtn').click(), ''],
        ['Region tools panel', () => setPanels(!S.hideLeft, S.hideRight), '['],
        ['Guarantees panel', () => setPanels(S.hideLeft, !S.hideRight), ']'],
      ];
      for (const [label, run, key, alias] of view) if (!ql || score(label) || (alias && aliasScore(alias) >= 2)) items.push({ kind: 'cmd', group: 'View', label, key, run });
      const acts = [
        ['Undo', () => $('undoBtn').click(), '⌘Z'],
        ['Redo', () => $('redoBtn').click(), '⇧⌘Z'],
        ['Clear the chain', () => $('clearChain').click(), ''],
        ['Clear all shapes and targets', () => $('clearShapes').click(), ''],
        ['Open the guide', () => openGuide(), '?'],
      ];
      for (const [label, run, key] of acts) if (!ql || score(label)) items.push({ kind: 'cmd', group: 'Actions', label, key, run });
    }
    return items;
  }
  const PROP_LETTERS = CHIP_DEFS;
  function openPalette(anchor, at, opt = {}) {
    // re-clicking the control that opened it closes it
    if (popEl && popEl.classList.contains('palette') && anchor && palState && palState.opener === anchor) { closePalette(); return; }
    closePalette();
    const explicit = at != null;
    const insertAt = explicit ? at : (S.focus > 0 ? S.focus : S.steps.length);
    const ctxText = explicit ? (at === 0 ? 'Insert at the start' : `Insert after f${sub(at)}`) : (S.focus > 0 ? `Insert after f${sub(S.focus)}` : 'Append to the chain');
    const input = h('input', { class: 'pal-input', id: 'palInput', placeholder: opt.fnOnly ? 'Search functions, or type a formula in z' : 'Search functions, regions, examples, commands', spellcheck: 'false', autocomplete: 'off', 'aria-label': 'Search', role: 'combobox', 'aria-expanded': 'true', 'aria-controls': 'palList' });
    const list = h('div', { class: 'pal-list', role: 'listbox', id: 'palList' });
    const pvCanvas = h('canvas', { width: 368, height: 368 });
    const pvCap = h('div', { class: 'pal-cap' });
    const preview = h('div', { class: 'pal-preview', 'aria-hidden': 'true' }, pvCanvas, pvCap);
    const pop = h('div', { class: 'pop palette', role: 'dialog', 'aria-modal': 'true', 'aria-label': opt.fnOnly ? 'Add a function' : 'Command palette' },
      h('div', { class: 'pal-head' }, h('span', { class: 'pal-icon', html: ICONS.search }), input, h('span', { class: 'pal-ctx', html: ctxText.replace(/f([₀-₉]+)/, (m, d) => `<i>f</i><sub>${[...d].map((c) => SUB.indexOf(c)).join('')}</sub>`) }), h('span', { class: 'kbd' }, 'Esc')),
      h('div', { class: 'pal-body' }, list, preview),
      h('div', { class: 'pal-foot' }, h('span', null, h('span', { class: 'kbd' }, '↑'), h('span', { class: 'kbd' }, '↓'), ' to move'), h('span', null, h('span', { class: 'kbd' }, 'Enter'), ' to add'), h('span', null, h('span', { class: 'kbd' }, 'Shift Enter'), ' to insert before'), h('span', null, h('span', { class: 'kbd' }, 'Esc'), ' to close')));
    const opener = anchor || document.activeElement, okey = focusKey(opener);
    palState = { at: insertAt, before: explicit ? at : (S.focus > 0 ? S.focus - 1 : 0), sel: 0, items: [], opener, pvTimer: 0 };
    const runItem = (it, before) => {
      const where = before ? palState.before : palState.at;
      closePalette();
      const r = it.run(where);
      // a new step's card takes the focus; anything else returns it to the opener when the run rebuilt it away
      if (r instanceof Element && r.isConnected && (it.kind === 'fn' || document.activeElement === document.body)) r.focus({ preventScroll: true });
      else focusBack(opener, okey);
    };
    const render = () => {
      const items = paletteItems(input.value, opt.fnOnly);
      palState.items = items;
      palState.sel = Math.min(palState.sel, Math.max(0, items.length - 1));
      list.innerHTML = '';
      let group = null;
      items.forEach((it, i) => {
        if (it.group !== group) { group = it.group; list.append(h('div', { class: 'pal-group', role: 'presentation' }, group)); }
        const t = h('span', { class: 'pal-tex' });
        if (it.tex) TeX.set(t, it.tex);
        const props = h('span', { class: 'pal-props' });
        if (it.props) for (const [key, ab, title] of PROP_LETTERS) props.append(h('span', { class: 'pp' + (it.props[key] ? ' on' : ''), title }, ab));
        else if (it.key) props.append(h('span', { class: 'kbd' }, it.key));
        const row = h('div', { class: 'pal-item' + (i === palState.sel ? ' sel' : ''), role: 'option', id: `pal-o${i}`, 'aria-selected': String(i === palState.sel), 'data-i': i,
          onpointermove: () => { if (palState.sel !== i) { palState.sel = i; mark(false); } },
          onclick: (e) => runItem(it, e.shiftKey) },
        t, h('span', { class: 'pal-main' }, h('span', { class: 'pal-label' }, it.label), it.desc ? h('span', { class: 'pal-desc' }, it.desc) : ''), props);
        list.append(row);
      });
      // a query that looks like a formula but does not parse gets the parser's message and its suggestions
      if (items.parseErr && !items.some((x) => x.group === 'Custom formula' || x.group === 'Region formulas' || x.group === 'Curve formulas')) list.prepend(h('div', { class: 'pal-empty', role: 'presentation' }, h('span', { class: 'err' }, `Not a formula yet: ${items.parseErr}`)));
      else if (!items.length) list.append(h('div', { class: 'pal-empty' }, opt.fnOnly ? 'No match. Type a formula in z, such as e^{z^2}, to add it as a step.' : 'No match. Type a formula in z to add it as a step, a set such as |z| < 1, or a curve such as Re z = 0.'));
      mark(false);
    };
    const mark = (scroll = true) => {
      for (const el of list.querySelectorAll('.pal-item')) {
        const on = +el.dataset.i === palState.sel;
        el.classList.toggle('sel', on);
        el.setAttribute('aria-selected', String(on));
        if (on && scroll) el.scrollIntoView({ block: 'nearest' });
      }
      input.setAttribute('aria-activedescendant', `pal-o${palState.sel}`);
      schedulePreview();
    };
    const schedulePreview = () => {
      clearTimeout(palState.pvTimer);
      const it = palState.items[palState.sel];
      palState.pvTimer = setTimeout(() => { if (popEl === pop) drawPalettePreview(pvCanvas, pvCap, it); }, 60);
    };
    input.addEventListener('input', () => { palState.sel = 0; render(); });
    input.addEventListener('keydown', (e) => {
      const n = palState.items.length;
      if (e.key === 'ArrowDown') { e.preventDefault(); if (n) palState.sel = (palState.sel + 1) % n; mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (n) palState.sel = (palState.sel - 1 + n) % n; mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = palState.items[palState.sel]; if (it) runItem(it, e.shiftKey); }
      else if (e.key === 'Escape') { e.preventDefault(); closePalette(); focusBack(opener, okey); }
      else if (e.key === 'Tab') {
        // Tab cycles groups
        e.preventDefault();
        if (!n) return;
        const g = palState.items[palState.sel].group;
        const order = [...new Set(palState.items.map((x) => x.group))];
        const gi = order.indexOf(g), next = order[(gi + (e.shiftKey ? order.length - 1 : 1)) % order.length];
        palState.sel = palState.items.findIndex((x) => x.group === next);
        mark();
      }
    });
    $('popHost').append(pop);
    popEl = pop;
    render();
    // centred 14vh from the top; a bottom sheet on phones
    if (window.innerWidth < 768) pop.classList.add('sheet');
    else {
      pop.style.left = Math.max(12, (window.innerWidth - pop.offsetWidth) / 2) + 'px';
      pop.style.top = Math.round(window.innerHeight * 0.14) + 'px';
    }
    input.focus({ preventScroll: true });
    armOutside(anchor || null);
  }
  // the preview plate: the region pushed through the chain with the candidate inserted (CPU, coarse mesh)
  const pvMeshes = new Map();
  function drawPalettePreview(cv, cap, it) {
    const ctx = cv.getContext('2d');
    const W = cv.width, Hh = cv.height;
    if (!it || (it.kind !== 'fn' && it.kind !== 'ex')) {
      ctx.fillStyle = TH.plane; ctx.fillRect(0, 0, W, Hh);
      cap.textContent = it && it.kind === 'region' ? 'Adds a shape to the z-plane' : '';
      return;
    }
    if (it.kind === 'ex') {
      cap.textContent = 'Example';
      const url = exThumbs.get(it.i);
      ctx.fillStyle = TH.plane; ctx.fillRect(0, 0, W, Hh);
      if (url) { const img = new Image(); img.onload = () => { const s = Math.min(W / img.width, Hh / img.height); ctx.drawImage(img, (W - img.width * s) / 2, (Hh - img.height * s) / 2, img.width * s, img.height * s); }; img.src = url; }
      return;
    }
    const b = Funcs.build({ type: it.type, params: Object.assign(Funcs.defaults(it.type), it.params || {}), on: true });
    if (!b || b.error) { ctx.fillStyle = TH.plane; ctx.fillRect(0, 0, W, Hh); cap.textContent = b ? b.error : ''; return; }
    const pre = stageF(palState ? palState.at : S.steps.length), f = b.f;
    // d/dz differentiates the chain up to the insertion point
    const F = isDerivStep({ type: it.type }, b) || typeof f !== 'function' ? circleDeriv(pre) : (z) => f(pre(z));
    const pane = new Pane(cv);
    pane.w = W / 2; pane.h = Hh / 2; pane.dpr = 2;
    const xs = [], ys = [], jobs = [];
    const core = Region.expandBox(clipWin, 1.05);
    for (const s of S.shapes) {
      if (s.visible === false) continue;
      const t = kindType(s), ink = shapeInk(s), r = shapeGPU(s);
      if (t === 'point') { const w = F(C(s.p[0], s.p[1])); if (CX.isFin(w)) { xs.push(w.re); ys.push(w.im); jobs.push({ pt: w, ink }); } continue; }
      if (t === 'area') {
        const key = shapeKey(s) + '|' + JSON.stringify(clipWin);
        let mesh = pvMeshes.get(s.id);
        if (!mesh || mesh.key !== key) { try { mesh = Region.buildMesh(s, clipWin, 24); mesh.key = key; } catch (e) { mesh = null; } pvMeshes.set(s.id, mesh); }
        if (mesh) {
          const mm = Region.mapMesh(mesh, F);
          for (let i = 0; i < mm.pos.length; i += 2) {
            if (mesh.stretched) { const x = mesh.src[i], y = mesh.src[i + 1]; if (x < core.x0 || x > core.x1 || y < core.y0 || y > core.y1) continue; }
            if (Math.abs(mm.pos[i]) < 1e9 && Math.abs(mm.pos[i + 1]) < 1e9) { xs.push(mm.pos[i]); ys.push(mm.pos[i + 1]); }
          }
          jobs.push({ mm, ink });
        }
      }
      for (const p of r.polys || []) {
        const n = p.length / 2, stride = Math.max(1, Math.floor(n / 500)), pts = [];
        for (let i = 0; i < n; i += stride) pts.push(F(C(p[2 * i], p[2 * i + 1])));
        jobs.push({ line: pts, ink });
      }
    }
    const bx = robustBox(xs, ys);
    if (bx) pane.fitBox(bx, 0.1); else pane.fitBox({ x0: -2, x1: 2, y0: -2, y1: 2 });
    pane.begin(TH.plane);
    Axes.draw(pane, Object.assign({}, TH, { label: 'rgba(0,0,0,0)' }), { unitCircle: false, labels: false });
    for (const j of jobs) {
      if (j.mm) {
        ctx.fillStyle = j.ink.c0; ctx.globalAlpha = Math.min(0.9, S.alpha);
        ctx.beginPath();
        const P = j.mm.pos, T = j.mm.tri;
        for (let t = 0; t < T.length; t += 3) {
          const [ax, ay] = pane.w2sxy(P[2 * T[t]], P[2 * T[t] + 1]), [bx2, by] = pane.w2sxy(P[2 * T[t + 1]], P[2 * T[t + 1] + 1]), [cx2, cy] = pane.w2sxy(P[2 * T[t + 2]], P[2 * T[t + 2] + 1]);
          if (Math.abs(ax) > 4e4 || Math.abs(ay) > 4e4) continue;
          ctx.moveTo(ax, ay); ctx.lineTo(bx2, by); ctx.lineTo(cx2, cy); ctx.closePath();
        }
        ctx.fill();
        ctx.globalAlpha = 1;
      } else if (j.line) {
        ctx.strokeStyle = j.ink.edge; ctx.lineWidth = 1.25; ctx.lineJoin = 'round';
        ctx.beginPath();
        let pen = false, px = 0, py = 0;
        for (const w of j.line) {
          if (!CX.isFin(w)) { pen = false; continue; }
          const [x, y] = pane.w2s(w);
          if (Math.abs(x) > 4e4 || Math.abs(y) > 4e4 || (pen && Math.hypot(x - px, y - py) > 60)) { pen = false; continue; }
          if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y);
          pen = true; px = x; py = y;
        }
        ctx.stroke();
      } else if (j.pt) {
        const [x, y] = pane.w2s(j.pt);
        ctx.fillStyle = j.ink.edge; ctx.beginPath(); ctx.arc(x, y, 3, 0, TAU); ctx.fill();
      }
    }
    cap.innerHTML = `Image after adding ${fsub((palState ? palState.at : S.steps.length) + 1)}`;
  }

  // ---------------- guarantees panel ----------------
  const BADGES = [
    ['analytic', 'Analytic', 'Holomorphic at every point of its natural domain D.'],
    ['entire', 'Entire', 'D = ℂ and F is holomorphic everywhere.'],
    ['rational', 'Rational', 'Agrees on D with P(z)/Q(z) for polynomials P and Q.'],
    ['polynomial', 'Polynomial', 'A polynomial in z.'],
    ['mobius', 'Möbius', 'F(z) = (az + b)/(cz + d) with ad − bc ≠ 0.'],
    ['proper', 'Proper', 'Preimages of compact sets in ℂ are compact in D, so |F(z)| → ∞ as z → ∂D or z → ∞.'],
    ['homeo', 'Homeomorphism onto image', 'Injective and continuous on the open set D, so a homeomorphism D → F(D) by invariance of domain.'],
    ['conformal', 'Conformal onto image', 'Analytic and injective: a biholomorphism D → F(D), with F′ ≠ 0.'],
  ];
  // which matrix column backs each lamp
  const LAMP_COL = { analytic: 'analytic', entire: 'entire', rational: 'rational', polynomial: 'polynomial', mobius: 'mobius', proper: 'proper', homeo: 'injective', conformal: 'injective' };
  let lastWords = null, openLamp = null;
  function copyText(t) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(() => fallbackCopy(t)); } catch (e) { /* fall through */ }
    fallbackCopy(t);
    return Promise.resolve();
  }
  function fallbackCopy(t) {
    const ta = h('textarea', { style: 'position:fixed;left:-9999px;top:0' });
    ta.value = t; document.body.append(ta); ta.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    ta.remove();
  }
  function hiCol(col, on) {
    for (const el of document.querySelectorAll(`#propsPanel [data-col="${col}"]`)) el.classList.toggle('hi-col', on);
    for (const [key] of BADGES) if (LAMP_COL[key] === col) { const li = document.querySelector(`#propsPanel .lamp[data-lamp="${key}"]`); if (li) li.classList.toggle('hi', on); }
  }
  // The panel is built once per chain structure (steps, on/off, errors) and then updated in place: lamps, count,
  // qualifiers and matrix cells are set on every change, so a lit lamp never outlives the chain that implied it;
  // formulas go through TeX.set, which skips unchanged nodes and, during a scrub or drag, waits for input to
  // pause (TeX.hush). A hidden panel costs nothing: only the rail lamps update, and the panel catches up when shown.
  const PROPS = { sig: null, stale: false, texF: '', rail: '', ro: null, el: null };
  function renderRail(words) {
    const rl = $('railLamps');
    if (!rl) return;
    const sig = BADGES.map(([k]) => (words[k] ? 1 : 0)).join('');
    if (sig === PROPS.rail && rl.childElementCount === BADGES.length) return;
    PROPS.rail = sig;
    rl.innerHTML = '';
    for (const [key, name] of BADGES) rl.append(h('span', { class: 'rl' + (words[key] ? ' on' : ''), 'data-tip': `${name}: ${words[key] ? 'guaranteed' : 'not guaranteed'}`, role: 'img', 'aria-label': `${name}: ${words[key] ? 'guaranteed' : 'not guaranteed'}` }));
  }
  function renderProps() {
    const act = activeSteps();
    const P = Funcs.composeProps(act.map((k) => built[k - 1].props));
    const words = Object.assign({}, P, { homeo: P.injective, conformal: P.analytic && P.injective });
    // the collapsed rail still reports
    renderRail(words);
    const host = $('propsPanel');
    if (!host) return;
    if (!PROPS.ro && window.ResizeObserver) {
      PROPS.ro = new ResizeObserver(() => { if (PROPS.stale && !S.hideRight) requestRender('P'); });
      PROPS.ro.observe(host);
    }
    if (S.hideRight) { PROPS.stale = true; return; }
    PROPS.stale = false;
    const sig = S.steps.map((st, i) => `${st.on === false ? 0 : 1}${built[i].error ? 'e' + built[i].error : ''}${built[i].def ? built[i].def.label : st.type}`).join('|') +
      '#' + act.join(',') + '#' + act.map((k) => (built[k - 1].domain ? 1 : 0)).join('');
    if (sig !== PROPS.sig || !PROPS.el || !host.contains(PROPS.el.sec1)) { buildProps(host, act); PROPS.sig = sig; }
    fillProps(act, P, words);
  }
  function buildProps(host, act) {
    host.innerHTML = '';
    const E = PROPS.el = { chain: [], lamps: {}, dom: [], rows: [] };
    // 1. composite map
    const copyBtn = h('button', { class: 'icon-btn', 'data-tip': 'Copy LaTeX', 'aria-label': 'Copy the formula as LaTeX', html: ICONS.copy });
    copyBtn.addEventListener('click', () => { copyText(exactTexF()); copyBtn.innerHTML = ICONS.check; copyBtn.classList.add('copied'); setTimeout(() => { copyBtn.innerHTML = ICONS.copy; copyBtn.classList.remove('copied'); }, 1200); });
    const sec1 = E.sec1 = h('section', { class: 'psec' }, h('h2', null, h('span', { class: 'grow' }, 'Composite map'), copyBtn,
      h('button', { class: 'icon-btn', 'data-tip': 'Hide panel  ]', 'aria-label': 'Hide guarantees', onclick: () => setPanels(S.hideLeft, true), html: ICONS.chevR })));
    const fbox = h('div', { class: 'fbox well' });
    E.ftex = h('div', { class: 'ftex-main' });
    E.flong = h('span', { class: 'lbl', hidden: true }, 'The expanded formula is long; the steps below list it piece by piece.');
    fbox.append(E.ftex, E.flong);
    if (S.steps.length) {
      const ol = h('ol', { class: 'chainlist' });
      S.steps.forEach((st, i) => {
        const k = i + 1, b = built[i];
        const li = h('li', { 'data-k': k, onpointerenter: () => hiStep(k, true), onpointerleave: () => hiStep(k, false) }, h('span', { class: 'idx', html: fsub(k) }));
        if (st.on === false) li.append(h('span', { class: 'lbl' }, 'bypassed'));
        else if (b.error) li.append(h('span', { class: 'err-msg' }, b.error));
        else { const t = h('span'); E.chain.push([k, t]); li.append(t); }
        ol.append(li);
      });
      fbox.append(ol);
    }
    sec1.append(fbox);
    host.append(sec1);
    // 2. guarantees: warnings first, then the eight lamps in a fixed order
    E.count = h('span', { class: 'count', 'data-tip': 'Guaranteed properties' });
    const sec2 = h('section', { class: 'psec' }, h('h2', null, h('span', { class: 'grow' }, 'Guarantees'), E.count));
    E.warnEls = []; E.warnSig = null;
    const list = h('ul', { class: 'lamps' });
    for (const [key, name] of BADGES) {
      const li = h('li', { class: 'lamp' + (openLamp === key ? ' open' : ''), 'data-lamp': key, tabindex: 0, role: 'button', 'aria-expanded': String(openLamp === key),
        onpointerenter: () => hiCol(LAMP_COL[key], true), onpointerleave: () => hiCol(LAMP_COL[key], false) });
      const q = h('span', { class: 'lampq' }), desc = h('div', { class: 'lampdesc' });
      li.append(h('span', { class: 'lampmark', 'aria-hidden': 'true' }), h('span', { class: 'lampname' }, name), q, h('span', { class: 'lampchev', html: ICONS.chevR, 'aria-hidden': 'true' }), desc);
      const toggle = () => {
        openLamp = openLamp === key ? null : key;
        for (const el of list.children) { const o = el.dataset.lamp === openLamp; el.classList.toggle('open', o); el.setAttribute('aria-expanded', String(o)); }
        for (const el of host.querySelectorAll('.matrix .hi-sel')) el.classList.remove('hi-sel');
        if (openLamp) for (const el of host.querySelectorAll(`.matrix [data-col="${LAMP_COL[openLamp]}"]`)) el.classList.add('hi-sel');
      };
      li.addEventListener('click', toggle);
      li.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
      E.lamps[key] = { li, q, desc, on: null };
      list.append(li);
    }
    E.lampList = list;
    sec2.append(list, h('div', { class: 'lamp-key' }, 'Lit: guaranteed by the chain. Unlit: not implied by the steps (it may still hold).'));
    host.append(sec2);
    // 3. natural domain
    const sec3 = h('section', { class: 'psec' }, h('h2', null, h('span', { class: 'grow', html: 'Natural domain <i>D</i>' })));
    const dom = h('div', { class: 'well domain' });
    const nConds = act.filter((k) => built[k - 1].domain).length;
    if (!nConds) { E.domLbl = h('div', { class: 'lbl' }); dom.append(E.domLbl); }
    else {
      const ul = h('ul', { class: 'domlist' });
      for (let i = 0; i < nConds; i++) { const li = h('li'); E.dom.push(li); ul.append(li); }
      dom.append(h('div', { class: 'lbl', html: 'All <i>z</i> for which:' }), ul);
    }
    sec3.append(dom);
    if (nConds && act.length > 1) sec3.append(h('div', { class: 'foot', html: '<i>w</i><sub>k</sub> is the value after step <i>k</i>; <i>w</i><sub>0</sub> = <i>z</i>.' }));
    host.append(sec3);
    // 4. step by step: indicator matrix
    const sec4 = h('section', { class: 'psec' }, h('h2', null, h('span', { class: 'grow' }, 'Step by step')));
    const tbl = h('table', { class: 'matrix' });
    const head = h('tr', null, h('th', { class: 'stepcol' }, 'step'));
    for (const [key, ab, t] of CHIP_DEFS) head.append(h('th', { 'data-col': key, 'data-tip': t, onpointerenter: () => hiCol(key, true), onpointerleave: () => hiCol(key, false) }, ab));
    tbl.append(h('thead', null, head));
    const body = h('tbody');
    const cell = (key) => h('td', { 'data-col': key, onpointerenter: () => hiCol(key, true), onpointerleave: () => hiCol(key, false) }, h('span', { class: 'sq', role: 'img' }));
    for (const k of act) {
      const cells = CHIP_DEFS.map(([key]) => cell(key));
      E.rows.push([k, cells]);
      body.append(h('tr', { 'data-k': k, onpointerenter: () => hiStep(k, true), onpointerleave: () => hiStep(k, false) },
        h('td', { class: 'stepcol' }, h('span', { class: 'idx', html: fsub(k) }), h('span', { class: 'nm', 'data-tip': isDeriv(k) ? 'An operator, not a map: its row shows what the chain through it guarantees' : null }, built[k - 1].def.label)), ...cells));
    }
    const total = CHIP_DEFS.map(([key]) => cell(key));
    E.rows.push([0, total]);
    body.append(h('tr', { class: 'total' }, h('td', { class: 'stepcol', html: '<i>F</i>' }), ...total));
    tbl.append(body);
    sec4.append(tbl);
    if (openLamp) for (const el of tbl.querySelectorAll(`[data-col="${LAMP_COL[openLamp]}"]`)) el.classList.add('hi-sel');
    sec4.append(h('details', { class: 'how' },
      h('summary', null, 'How these are decided'),
      h('p', null, 'A property is listed only when every active step has it and composition preserves it on the natural domain. Compositions of analytic, entire, rational, polynomial, Möbius, injective and proper (into ℂ) maps keep that property.'),
      h('p', null, 'Each step is judged on its own natural domain, off its branch cut. So log is injective but exp is not; z ↦ 1/z is Möbius but not proper into ℂ, since |1/z| stays bounded as z → ∞.'),
      h('p', null, 'The list is sound but not complete. For example, exp followed by log returns z, yet neither step is rational, so "rational" is not claimed.'),
      h('p', null, 'Custom formulas are classified from their expression tree: only z, constants, +, −, ×, ÷ and integer powers count as rational. A polynomial formula has its exact degree found numerically before "proper" is claimed.')));
    host.append(sec4);
  }
  // the copied formula: constants that parse back exactly, and a note for every non-principal branch
  function exactTexF() {
    const act = activeSteps();
    let arg = { s: 'z', p: 4 };
    const notes = [];
    CX.setTexExact(true);
    try {
      for (const k of act) {
        const b = built[k - 1], st = S.steps[k - 1];
        arg = b.tex(arg);
        const usesCut = b.cuts && b.cuts.some((c) => c.editable) || b.usesCut;
        const cut = st.params.cut, kk = Math.round(+st.params.k || 0);
        if (usesCut && cut != null && (+cut !== 180 || kk)) notes.push(`f_{${k}}\\text{: cut }${CX.texNum(+cut)}^\\circ${kk ? `\\text{, sheet }${kk}` : ''}`);
      }
    } finally { CX.setTexExact(false); }
    return `F(z)=${arg.s}` + (notes.length ? `\\quad(${notes.join(',\\ ')})` : '');
  }
  // ---- export: plane images (PNG) and the map with its guarantees (LaTeX) ----
  // Files go through the viewer's downloads capability in claude.ai (the viewer confirms each save); a copy of the
  // page opened on its own saves with a plain download link.
  let dlNs = null, dlAsked = null, dlDone = false;
  function getDownloads() {
    if (!window.claude || typeof window.claude.use !== 'function') { dlDone = true; dlNs = 'local'; return Promise.resolve('local'); }
    if (!dlAsked) dlAsked = window.claude.use('downloads').then((d) => { dlNs = d; dlDone = true; return d; }).catch(() => { dlDone = true; return null; });
    return dlAsked;
  }
  async function saveFile(filename, data) {
    const d = await getDownloads();
    if (d === 'local') {
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain' });
      const url = URL.createObjectURL(blob), a = h('a', { href: url, download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      toast(`Saved ${filename}.`);
      return;
    }
    if (!d) { toast('Saving files is not available in this view.'); return; }
    try {
      const r = await d.save({ filename, data });
      if (r && r.status === 'saved') toast(`Saved ${filename}.`);
    } catch (e) {
      const code = e && e.code;
      if (code === 'declined') return;
      toast(code === 'rate_limited' ? 'Another save is still waiting for your answer.' : 'The file could not be saved in this view.');
    }
  }
  // ---- article figures ----
  // A figure as a journal would print it: each plane re-rendered at print resolution in the light theme and placed
  // in a thin frame with inward ticks; tick numbers, axis titles, panel letters and the caption typeset by MathJax
  // in the TeX fonts (as vector paths, so the SVG and PDF need no fonts); a colour bar where colour carries a value;
  // a caption written from the chain (regions, the map, the shading, the natural domain, the guarantees). Sizes are
  // set for the printed width: 1 unit = 1/96 in, so text is 8 to 9 pt at 100 %.
  const FIG_DPI = 300;
  const PT = 96 / 72;                  // px per point
  const mjCache = new Map();
  // TeX as a MathJax SVG (vector paths): {markup, w, h, va} at font size px; null without MathJax
  function mj(tex, px, color = '#000') {
    const key = `${px}|${color}|${tex}`;
    if (mjCache.has(key)) return mjCache.get(key);
    const MJ = window.MathJax;
    let out = null;
    if (tex && MJ && typeof MJ.tex2svg === 'function') {
      try {
        const node = MJ.tex2svg(tex, { display: false });
        const svg = node && node.querySelector('svg');
        if (svg) {
          const ex = px * 0.431;
          const w = parseFloat(svg.getAttribute('width')) * ex, hh = parseFloat(svg.getAttribute('height')) * ex;
          const va = (parseFloat(String(svg.style.verticalAlign || '0').replace('ex', '')) || 0) * ex;
          svg.setAttribute('width', w.toFixed(3)); svg.setAttribute('height', hh.toFixed(3));
          svg.removeAttribute('style'); svg.removeAttribute('role'); svg.removeAttribute('focusable');
          // glyphs are filled paths: a zero-width stroke prints as a hairline in PDF viewers (text looks bold)
          let markup = new XMLSerializer().serializeToString(svg).replace(/currentColor/g, color).replace(/\sstroke="[^"]*"/g, ' stroke="none"').replace(/\sstroke-width="[^"]*"/g, '');
          if (!/^<svg[^>]*\sxmlns="/.test(markup)) markup = markup.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
          if (w > 0 && hh > 0) out = { markup, w, h: hh, va };
        }
      } catch (e) { out = null; }
    }
    if (!out) {
      // without MathJax: the TeX source as plain serif text (rare: MathJax loads with the page)
      const t = String(tex).replace(/\\(operatorname|text|mathrm|textbf)\{([^}]*)\}/g, '$2').replace(/[{}\\]/g, '').replace(/\^/g, '').replace(/_/g, '');
      const w = t.length * px * 0.5, hh = px * 1.2;
      out = { markup: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${hh}"><text x="0" y="${px}" font-family="Times New Roman, Times, serif" font-style="italic" font-size="${px}" fill="${color}">${t.replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'))}</text></svg>`, w, h: hh, va: -px * 0.2 };
    }
    if (mjCache.size > 2000) mjCache.clear();
    mjCache.set(key, out);
    return out;
  }
  // place a typeset item with its baseline at (x, y); anchor: 'start' | 'middle' | 'end'
  function mjAt(it, x, y, anchor = 'start') {
    const left = anchor === 'middle' ? x - it.w / 2 : anchor === 'end' ? x - it.w : x;
    const top = y - it.h - it.va;
    return it.markup.replace('<svg', `<svg x="${left.toFixed(2)}" y="${top.toFixed(2)}"`);
  }
  // SPEC 10.6: prepareExport(panels, alive) -> true when the export may draw, false when it was cancelled (alive()
  // turned false: an option changed or the dialog closed). Asynchronous and time-sliced: it refines the lines and
  // waits (bounded, polling every 25 ms, never blocking) for the inverse programs that each panel's current view draws
  // with: the right plane or the w-globe (role R), the left plane at a focused stage or the z-globe (role L, also at
  // stage 0), so renderOff then draws exact images synchronously. P5: dims {pw (figure px per panel), dpr}: the
  // SphereMesh jobs of the flat panels' forward shapes at the export's resolution (smPrepareExport).
  async function prepareExport(panels, alive = () => true, morphFig = false, dims = null) {
    // the lines' settle-time refinement, if it has not landed yet (a figure never carries today's samples)
    try { if (!(await refineAllNow(alive))) return false; } catch (e) { console.error('line refinement', e); }
    if (!alive()) return false;
    if (dims && smOn()) {
      const panes = [];
      for (const side of panels) {
        const real = side === 'L' ? paneL : paneR, v = side === 'L' ? leftView() : V.right;
        if (side === 'R' ? !rImage() || (morphOn() && !morphFig) : !(lPlain() && leftStage() > 0)) continue;
        const k = dims.pw / effW(side), ph = dims.pw * real.h / effW(side);
        panes.push({ role: side, map: stageMap(side === 'R' ? rightStage() : leftStage()), pane: { view: { cx: v.cx, cy: v.cy, s: v.s * k }, dpr: dims.dpr, pw: Math.max(1, Math.round(dims.pw * dims.dpr)), ph: Math.max(1, Math.round(ph * dims.dpr)) } });
      }
      try { if (!(await smPrepareExport(panes, alive, dims.gen || 0))) return false; } catch (e) { console.error('SphereMesh export', e); }
    }
    if (!GLR.ok || !GLR.inverseRequest || S.exactImages === false) return true;
    const kinds = new Set();
    const need = (role, kind, map) => {
      if (!PHASE[role][kind]) return;
      if (S.shapes.some((s) => s.visible !== false && kindType(s) === 'area' && pathOf(s, map, role, kind, { status: true }).path === 'pending')) kinds.add(kind);
    };
    // (the deformation figure draws the region at t = end: the stage map, exact; morph-figure.md 6.4)
    if (panels.includes('R') && (!morphOn() || morphFig)) need('R', rGlobe() ? 'globe' : 'flat', stageMap(rightStage()));
    if (panels.includes('L') && (lPlain() || (lGlobe() && !lPhase()))) need('L', lGlobe() ? 'globe' : 'flat', stageMap(leftStage()));
    const t0 = performance.now();
    while (kinds.size && performance.now() - t0 < 4000) {
      if (!alive()) return false;
      if (![...kinds].map((k) => GLR.inverseRequest(S.alpha, k)).includes('pending')) break;
      await new Promise((r) => setTimeout(r, 25));
    }
    return alive();
  }
  // a canvas as a PNG data URL, encoded off the main thread (toBlob), so a 300 dpi raster does not block the page
  function canvasURL(cv) {
    return new Promise((res, rej) => {
      try {
        cv.toBlob((b) => {
          if (!b) { try { res(cv.toDataURL('image/png')); } catch (e) { rej(e); } return; }
          const fr = new FileReader();
          fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error);
          fr.readAsDataURL(b);
        }, 'image/png');
      } catch (e) { rej(e); }
    });
  }
  // a pane's CSS width for the export: a pane hidden by a merged view (merged-views.md) takes the width it has in the
  // split view, half of the wide panel beside the gutter
  function effW(side) {
    const real = side === 'L' ? paneL : paneR, other = side === 'L' ? paneR : paneL;
    return real.w > 20 || !(other.w > 20) ? real.w : Math.max(1, (other.w - 8) / 2);
  }
  // a plane drawn off-screen at print size: views scaled so the same window shows; selection, hover and probe off
  function renderOff(side, w, h, dpr) {
    const real = side === 'L' ? paneL : paneR;
    const cv = document.createElement('canvas'), ov = document.createElement('canvas');
    const off = new Pane(cv, ov);
    off.w = w; off.h = h; off.dpr = dpr;
    cv.width = ov.width = Math.max(1, Math.round(w * dpr)); cv.height = ov.height = Math.max(1, Math.round(h * dpr));
    const k = w / effW(side);
    const scaled = new Map();
    for (const v of [S.srcView, V.left, V.right]) if (v && !scaled.has(v)) { scaled.set(v, v.s); v.s *= k; }
    // (the outline of the left view in the image is a screen aid, not part of a figure; so is the colour key under the
    // Y plane (the Key switch): a figure's Y panel would carry colours its caption and key do not explain)
    const keep = { L: paneL, R: paneR, probe, rHover, selected, hoverShape, draft, hw: hov.w, hl: hov.list, fov: S.fov, wKey: S.wKey };
    probe = null; rHover = null; selected = null; hoverShape = null; draft = null; hov.w = null; hov.list = null; S.fov = false; S.wKey = false; figMode = true;
    // numbers drawn inside the plot (landscape axes, labels) in the serif of the figure, not the app's monospace
    const mono = TH.mono; TH.mono = TH.math;
    // exact images (SPEC 10.6): prepareExport has waited for the inverse programs; one still compiling (normally
    // none) is waited for here, and only then
    const wait = GLR.ok && GLR.inverseStatus && (GLR.inverseStatus(S.alpha, 'flat') === 'pending' || GLR.inverseStatus(S.alpha, 'globe') === 'pending');
    offRender = true;
    if (wait) GLR.syncCompile = true;
    try {
      if (side === 'L') { paneL = off; renderLeft(); } else { paneR = off; renderRight(); }
      // labels are placed in a microtask on screen; here they are needed before the pixels are read
      if (off.labels) flushLabels(off, off.labels);
    } finally {
      if (wait) GLR.syncCompile = false;
      offRender = false;
      paneL = keep.L; paneR = keep.R;
      for (const [v, s] of scaled) v.s = s;
      probe = keep.probe; rHover = keep.rHover; selected = keep.selected; hoverShape = keep.hoverShape; draft = keep.draft; hov.w = keep.hw; hov.list = keep.hl; S.fov = keep.fov; S.wKey = keep.wKey; figMode = false; TH.mono = mono;
    }
    return cv;
  }
  // the world window a plane panel shows at width w (figure px)
  function panelBox(side, w, h) {
    const real = side === 'L' ? paneL : paneR;
    const v = side === 'L' ? leftView() : V.right;
    const s = v.s * w / effW(side);
    return { x0: v.cx - w / 2 / s, x1: v.cx + w / 2 / s, y0: v.cy - h / 2 / s, y1: v.cy + h / 2 / s };
  }
  // export takes each pane's view (U-b): a plane panel is X Plane (with or without Phase) or Y Plane
  const isPlanePanel = (side) => (side === 'L' ? lFlat() : rImage());
  // the variable of a panel's coordinates, in TeX
  function panelVar(side) {
    if (side === 'L') return leftStage() === 0 ? 'z' : `w_{${leftStage()}}`;
    return S.focus === 0 ? 'w' : `w_{${rightStage()}}`;
  }
  // a tick number in TeX: as few decimals as the step needs; powers of ten far from 1
  function tickTex(v, step) {
    if (Math.abs(v) < step * 1e-9) return '0';
    const av = Math.abs(v);
    if (av >= 1e5 || step < 1e-4) {
      const e = Math.floor(Math.log10(av)), m = v / 10 ** e;
      const ms = (+m.toFixed(Math.max(0, Math.min(6, e - Math.floor(Math.log10(step)))))).toString();
      return ms === '1' ? `10^{${e}}` : ms === '-1' ? `-10^{${e}}` : `${ms}\\times 10^{${e}}`;
    }
    const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    let t = v.toFixed(Math.min(dec, 8));
    if (t.includes('.')) t = t.replace(/\.?0+$/, '');
    return t;
  }
  // the colour key of a panel, when colour carries a value: arg F (phase), the stretch factor (Image, Stretch)
  function panelKey(side) {
    const stopsFrom = (f) => Array.from({ length: 25 }, (_, i) => [i / 24, f(i / 24)]);
    const hueAt = (t) => { // t in [0, 1] -> arg from -pi to pi, colours of the legend wheel (OKLCH stops every 30 deg)
      const deg = (((t * 360 - 180) % 360) + 360) % 360, f = deg / 30, i = Math.floor(f) % 12, u = f - Math.floor(f);
      const a = GLR.hexRGB(WHEEL_STOPS[i]), b = GLR.hexRGB(WHEEL_STOPS[(i + 1) % 12]);
      return '#' + a.map((x, j) => Math.round(255 * (x + (b[j] - x) * u)).toString(16).padStart(2, '0')).join('');
    };
    const Fn = side === 'L' && morphOn() && lPaintsF() ? 'H_t' : S.focus === 0 ? 'F' : focusDeriv() ? `w_{${S.focus}}` : `f_{${S.focus}}`;
    if (side === 'L' && lColor() && S.dc !== 'classic') return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.25, '-\\frac{\\pi}{2}'], [0.5, '0'], [0.75, '\\frac{\\pi}{2}'], [1, '\\pi']] };
    if (side === 'L' && lColor()) return { title: `|${Fn}|`, stops: [[0, '#000000'], [0.5, '#8a8f93'], [1, '#ffffff']], ticks: [[0, '0'], [0.5, '1'], [1, '\\infty']] };
    if (side === 'R' && rImage() && S.pattern === 'stretch') return { title: `|${Fn}'|`, stops: [[0, TH.stretchShrink], [0.5, TH.stretchMid], [1, TH.stretchGrow]], ticks: [[0, '\\tfrac18'], [0.5, '1'], [1, '8']] };
    if (side === 'L' && lGlobe() && lPhase()) return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.5, '0'], [1, '\\pi']] };
    if (side === 'L' && lLand() && lPhase()) return { title: `\\arg ${Fn}`, stops: stopsFrom(hueAt), ticks: [[0, '-\\pi'], [0.5, '0'], [1, '\\pi']] };
    return null;
  }
  // ---- the caption, as segments: {t: text} and {m: TeX}; also as LaTeX source ----
  const texEsc = (s) => String(s).replace(/\\/g, '\\textbackslash{}').replace(/([#$%&_{}])/g, '\\$1').replace(/~/g, '\\textasciitilde{}').replace(/\^/g, '\\textasciicircum{}');
  function shapePhrase(s, idx) {
    let tex = '';
    try { tex = shapeTexOf(s); } catch (e) { tex = ''; }
    const P = (a) => CX.tex(C(a[0], a[1]), 3);
    const segs = (() => {
      // a shape added from an equation, as recognized: by its equation
      if (s.srcTex && tex === s.srcTex && s.kind !== 'point') return [{ t: `the ${Region.KINDS[s.kind].label.toLowerCase()} ` }, { m: tex }];
      switch (s.kind) {
        case 'point': {
          // (a label that is a word, "trailing edge", is set as text, not as a product of italic letters)
          const lab = s.label ? (/[A-Za-z]{2}|\s/.test(s.label) ? `\\text{${texEsc(s.label)}}` : s.label.replace(/₀/g, '_0').replace(/₁/g, '_1').replace(/₂/g, '_2')) : 'abcdefghjkmnpqrstuv'[idx % 19];
          return [{ t: 'the point ' }, { m: `${lab}=${P(s.p)}` }];
        }
        case 'segment': return [{ t: 'the segment ' }, { m: `[${P(s.a)},\\,${P(s.b)}]` }];
        // (a line stored from a cap on a globe has a unit direction and is written by its equation, Region normalTex)
        case 'line': return tex && !/^\\text\{line through/.test(tex) ? [{ t: 'the line ' }, { m: tex }] : [{ t: 'the line through ' }, { m: P(s.a) }, { t: ' and ' }, { m: P(s.b) }];
        case 'ray': return [{ t: 'the ray from ' }, { m: P(s.a) }, { t: ' through ' }, { m: P(s.b) }];
        case 'circle': return [{ t: 'the circle ' }, { m: tex }];
        case 'arc': return [{ t: 'the arc from ' }, { m: P(s.a) }, { t: ' through ' }, { m: P(s.m) }, { t: ' to ' }, { m: P(s.b) }];
        case 'curve': return [{ t: 'a freehand curve' }];
        case 'disc': return [{ t: 'the disc ' }, { m: tex }];
        case 'rect': return [{ t: 'the rectangle ' }, { m: tex }];
        case 'polygon': return [{ t: `a polygon with ${s.pts.length} vertices` }];
        case 'halfplane': return [{ t: 'the half-plane ' }, { m: tex }];
        case 'annulus': return [{ t: 'the annulus ' }, { m: tex }];
        case 'sector': return [{ t: 'the sector ' }, { m: tex }];
        case 'formula': return [{ t: 'the set ' }, { m: tex }];
        case 'fcurve': return [{ t: 'the curve ' }, { m: tex }];
        case 'cgrid': return [{ t: 'a Cartesian grid on ' }, { m: tex.replace(/^\\text\{grid \}\s*/, '') }];
        case 'pgrid': return [{ t: 'a polar grid in ' }, { m: tex.replace(/^\\text\{polar grid\},\s*/, '') }];
        default: return [{ t: `a ${Region.KINDS[s.kind] ? Region.KINDS[s.kind].label.toLowerCase() : 'shape'}` }];
      }
    })();
    if (s.complement && kindType(s) === 'area') return [{ t: 'the complement of ' }, ...segs];
    return segs;
  }
  const joinList = (items) => { // [[segs], ...] -> segs joined with commas and "and"
    const out = [];
    items.forEach((it, i) => {
      if (i) out.push({ t: i === items.length - 1 ? (items.length > 2 ? ', and ' : ' and ') : ', ' });
      out.push(...it);
    });
    return out;
  };
  const cap1 = (segs) => { const s = segs.slice(); if (s[0] && s[0].t) s[0] = { t: s[0].t.charAt(0).toUpperCase() + s[0].t.slice(1) }; return s; };
  function compositeTexShort() {
    const act = activeSteps();
    let arg = { s: 'z', p: 4 };
    for (const j of act) arg = built[j - 1].tex(arg);
    return act.length ? (arg.s.length <= 320 ? arg.s : null) : 'z';
  }
  // the sentence on the image's shading (the pattern carried from the z-plane)
  function patternSegs(Fname) {
    const cell = CX.fmtNum(patternCell(), 3);
    return {
      checker: [{ t: ' Regions are shaded by a checkerboard of cell ' }, { m: cell }, { t: ' in the ' }, { m: 'z' }, { t: '-plane, carried by the map.' }],
      polar: [{ t: ' Regions are shaded by a log-polar checkerboard in the ' }, { m: 'z' }, { t: '-plane, whose cells stay square under conformal maps.' }],
      tiles: [{ t: ' Regions are shaded by tiles marked with the letter F, which show rotation, scaling and reflection.' }],
      grid: [{ t: ' Lines are the coordinate lines of the ' }, { m: 'z' }, { t: '-plane, spaced ' }, { m: cell }, { t: '.' }],
      polargrid: [{ t: ' Lines are circles about 0 and rays from 0 in the ' }, { m: 'z' }, { t: '-plane.' }],
      phase: [{ t: ' Regions are coloured by the argument of the source point.' }],
      stretch: [{ t: ' The colour shows the local scale factor ' }, { m: `|${Fname}'|` }, { t: ' (bar).' }],
      sphere: [{ t: ' Regions are shaded by a checkerboard of ' }, { m: String(sphN()) }, { t: ' longitude sectors and ' }, { m: String(sphN() / 2) }, { t: ' latitude bands of the Riemann sphere of the ' }, { m: 'z' }, { t: '-plane, carried by the map.' }],
      solid: [],
    }[S.pattern] || [];
  }
  function figureCaption(panels) {
    const out = [];
    const push = (...xs) => out.push(...xs);
    const both = panels.length === 2;
    const vis = S.shapes.filter((s) => s.visible !== false);
    let pi = 0;
    const shapeList = joinList(vis.map((s) => { const r = shapePhrase(s, s.kind === 'point' ? pi : 0); if (s.kind === 'point') pi++; return r; }));
    const lv = panelVar('L'), Fname0 = S.focus === 0 ? 'F' : `f_{${S.focus}}`;
    const Ftex = S.focus === 0 ? compositeTexShort() : (built[S.focus - 1] && !built[S.focus - 1].error ? built[S.focus - 1].tex({ s: lv, p: 4 }).s : null);
    const mapF = Ftex ? `${Fname0}(${lv})=${Ftex}` : `${Fname0}`;
    // the deformation drawn in one panel (Phase or Landscape of H_t, or X → Y's merged globe): the picture is H_t at
    // the current t, so the caption names H_t and says which t and which homotopy (merged-views review)
    const hm = morphOn() && (panels.includes('L') ? lPaintsF() : true);
    const Fname = hm ? 'H_t' : Fname0, mapM = hm ? 'H_t' : mapF;
    const homDef = () => {
      const m = morphLen(), hom = morphHomSegs(m);
      return [{ t: ' Shown at ' }, { m: `t=${morph.T.toFixed(2)}` }, { t: ', where ' }, { m: 'H_t' }, { t: ' deforms the identity (' }, { m: 't=0' }, { t: ') into ' }, { m: mapF }, { t: ' (' }, { m: `t=${m}` }, { t: ') along ' }, ...hom.segs, { t: '.' }];
    };
    const planeName = leftStage() === 0 ? [{ t: 'the ' }, { m: 'z' }, { t: '-plane' }] : [{ t: 'the ' }, { m: lv }, { t: '-plane, the input of ' }, { m: Fname }];
    const lab = (c) => (both ? [{ b: `(${c})` }, { t: ' ' }] : []);
    // (a): X, with its view (U-b): the shapes, or what X's paint shows of the map
    const phaseText = (onWhat) => {
      const st = S.dc, r = [];
      r.push({ t: 'The phase portrait of ' }, { m: mapM }, ...onWhat);
      if (st === 'classic') r.push({ t: 'brightness increases with ' }, { m: `|${Fname}|` }, { t: ', so zeros are black and poles white.' });
      else if (st === 'phase') r.push({ t: 'the colour shows ' }, { m: `\\arg ${Fname}` }, { t: ' (bar).' });
      else if (st === 'modulus') r.push({ t: 'the colour shows ' }, { m: `\\arg ${Fname}` }, { t: ' (bar); lines are level curves of ' }, { m: `|${Fname}|` }, { t: ' and of ' }, { m: `\\arg ${Fname}` }, { t: '.' });
      else if (st === 'grid') r.push({ t: 'the colour shows ' }, { m: `\\arg ${Fname}` }, { t: ' (bar); lines are the preimages of the coordinate lines of the image plane.' });
      else if (st === 'cauchy') r.push({ t: 'the Cauchy integral ' }, { m: '\\frac{1}{2\\pi i}\\oint_\\gamma \\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta' }, { t: ' over the selected closed curve, which equals ' }, { m: 'F' }, { t: ' inside and ' }, { m: '0' }, { t: ' outside.' });
      else r.push({ t: 'the colour shows ' }, { m: `\\arg ${Fname}` }, { t: ' (bar), and the shading steps in ' }, { m: `|${Fname}|` }, { t: ' by factors of ' }, { m: `e^{2\\pi/${S.sectors || 12}}\\approx ${CX.fmtNum(Math.exp(TAU / (S.sectors || 12)), 2)}` }, { t: ', so phase lines and modulus lines meet in near-squares where the map is conformal.' });
      return r;
    };
    if (panels.includes('L')) {
      if (lColor()) push(...lab('a'), ...phaseText([{ t: ' on ' }, ...planeName, { t: ': ' }]));
      else if (lGlobe() && lPhase()) push(...lab('a'), { t: 'The phase portrait of ' }, { m: mapM }, { t: ' on the Riemann sphere, with ' }, { m: '\\infty' }, { t: ' at the north pole.' });
      else if (lLand()) {
        const ht = { log: `\\log|${Fname}|`, abs: `|${Fname}|`, re: `\\operatorname{Re} ${Fname}`, im: `\\operatorname{Im} ${Fname}` }[S.height || 'log'];
        push(...lab('a'), { t: 'The landscape of ' }, { m: mapM }, { t: ' over ' }, ...planeName, { t: ': the height is ' }, { m: ht }, ...(lPhase() ? [{ t: ' and the colour ' }, { m: `\\arg ${Fname}` }, { t: ' (bar)' }] : []), { t: S.sheets ? '; all sheets of the Riemann surface are shown.' : '; zeros are pits and poles are peaks.' });
      } else if (vis.length) push(...lab('a'), ...cap1(shapeList), { t: ' in ' }, ...planeName, { t: lGlobe() ? ', on the Riemann sphere.' : '.' });
      else push(...lab('a'), ...cap1(planeName), { t: '.' });
      if (both) push({ t: ' ' });
    }
    // (b): Y, the images
    if (panels.includes('R') && hm) {
      const r = [{ t: 'The deformation ' }, { m: 'H_t' }, ...(rGlobe() ? [{ t: ' on the Riemann sphere, with ' }, { m: '\\infty' }, { t: ' at the north pole' }] : [])];
      if (vis.length) r.push({ t: ': the image of ' }, ...shapeList, { t: ' under ' }, { m: 'H_t' }, { t: ', over the set itself in grey.' });
      else r.push({ t: '.' });
      push(...r);
    } else if (panels.includes('R')) {
      const r = [];
      const named = vis.length && (!panels.includes('L') || !lPlain() && !(lGlobe() && !lPhase()));
      if (rGlobe()) r.push({ t: vis.length ? (named ? 'The images of ' : 'Their images under ') : 'The image under ' }, ...(named ? [...shapeList, { t: ' under ' }] : []), { m: mapM }, { t: ' on the Riemann sphere, with ' }, { m: '\\infty' }, { t: ' at the north pole.' });
      else if (named) r.push({ t: 'The images of ' }, ...shapeList, { t: ' under ' }, { m: mapM }, { t: '.' });
      else r.push({ t: vis.length ? 'Their images under ' : 'The map ' }, { m: mapM }, { t: '.' });
      push(...lab('b'), ...r);
    }
    // the shading (Image)
    if (panels.includes('R') && rImage() && vis.some((s) => kindType(s) === 'area')) push(...patternSegs(Fname));

    if (vis.some((s) => kindType(s) === 'area' && Region.isOpen && Region.isOpen(s))) push({ t: ' Dashed boundaries do not belong to the sets.' });
    if (hm) push(...homDef());
    // the chain, when F has several steps
    const act = activeSteps();
    if (act.length > 1 && S.focus === 0) {
      const defs = act.map((j) => {
        const b = built[j - 1];
        if (isDeriv(j)) return [{ m: `w_{${j}}=\\frac{d w_{${j - 1}}}{dz}` }];
        return [{ m: `f_{${j}}(${j === 1 ? 'z' : 'w'})=${b.tex({ s: j === 1 ? 'z' : 'w', p: 4 }).s}` }];
      });
      const hasD = act.some((j) => isDeriv(j));
      push({ t: hasD ? ' Here the chain is built step by step from ' : ' Here ' }, ...(hasD ? [{ m: 'w_0=z' }, { t: ': ' }] : [{ m: `F=${act.slice().reverse().map((j) => `f_{${j}}`).join('\\circ ')}` }, { t: ' with ' }]), ...joinList(defs), { t: '.' });
    }
    // the natural domain and the guarantees
    const P = Funcs.composeProps(act.map((j) => built[j - 1].props));
    const words = Object.assign({}, P, { homeo: P.injective, conformal: P.analytic && P.injective });
    const conds = [];
    for (const j of act) { const b = built[j - 1]; if (b.domain) conds.push(b.domain(wvar(j - 1))); }
    const deg = P.deg != null ? (P.degExact ? ` of degree ${P.deg}` : ` of degree at most ${P.deg}`) : '';
    const props = [];
    if (words.mobius) props.push([{ t: 'a Möbius transformation' }]);
    else if (words.polynomial) props.push([{ t: `a polynomial${deg}` }]);
    else if (words.rational) props.push([{ t: `rational${deg}` }]);
    if (words.entire && !words.polynomial && !words.mobius) props.push([{ t: 'entire' }]);
    else if (words.analytic && !words.entire && !words.rational && !words.polynomial && !words.mobius) props.push([{ t: 'analytic' }]);
    if (words.proper) props.push([{ t: 'proper' }]);
    if (words.conformal) props.push([{ t: 'conformal onto its image' }]);
    else if (words.homeo) props.push([{ t: 'a homeomorphism onto its image' }]);
    if (act.length) {
      const generic = conds.filter((c) => /^\\text\{the formula is defined at/.test(c)), sets = conds.filter((c) => !generic.includes(c));
      conds.length = 0; conds.push(...sets);
      const onD = !conds.length && generic.length ? [{ t: ' Where the formula is defined, ' }] : conds.length ? [{ t: ' On its natural domain ' }, { m: `D=\\{z : ${conds.join(',\\ ')}\\}` }, { t: (conds.some((c) => /w_\{/.test(c)) ? ' (with ' : '') }, ...(conds.some((c) => /w_\{/.test(c)) ? [{ m: 'w_k' }, { t: ' the value after step ' }, { m: 'k' }, { t: ')' }] : []), { t: ', ' }] : [{ t: ' ' }];
      if (props.length) push(...onD, { m: 'F' }, { t: ' is ' }, ...joinList(props), { t: props.length > 1 ? '; these properties are guaranteed by the chain.' : '; this is guaranteed by the chain.' });
      else push(...onD, { t: conds.length ? 'the chain guarantees none of the tracked properties.' : 'The chain guarantees none of the tracked properties.' });
    }
    return out;
  }
  // the caption as LaTeX source (for \caption{...})
  function captionLatex(segs) {
    return segs.map((s) => (s.m != null ? `$${s.m}$` : s.b != null ? `\\textbf{${texEsc(s.b)}}` : texEsc(s.t).replace(/Möbius/g, 'M\\"obius'))).join('').replace(/\s+/g, ' ').trim();
  }
  // lay the caption out in lines of width W (justified, the last line ragged); returns {markup, h}
  // ragged: ragged-right lines (the deformation's captions, morph-figure.md 5), else justified with capped gaps
  function layoutCaption(segs, x0, y0, W, px, ragged = false) {
    const items = [];
    const sp = mj('\\text{a b}', px).w - mj('\\text{ab}', px).w || px * 0.33;
    for (const s of segs) {
      if (s.m != null) { items.push({ it: mj(s.m, px), glue: false }); continue; }
      const text = s.b != null ? s.b : s.t;
      const parts = text.split(/(\s+)/);
      for (const p of parts) {
        if (!p) continue;
        if (/^\s+$/.test(p)) { items.push({ space: true }); continue; }
        const tex = s.b != null ? `\\textbf{${texEsc(p)}}` : `\\text{${texEsc(p)}}`;
        items.push({ it: mj(tex, px) });
      }
    }
    // words joined by no space stay together (a word followed by math, "z-plane")
    const words = [];
    let cur = [];
    for (const i of items) {
      if (i.space) { if (cur.length) { words.push(cur); cur = []; } continue; }
      cur.push(i.it);
    }
    if (cur.length) words.push(cur);
    const lineH = px * 1.42;
    const lines = [];
    let line = [], lw = 0;
    for (const wd of words) {
      const ww = wd.reduce((a, it) => a + it.w, 0);
      if (line.length && lw + sp + ww > W) { lines.push({ words: line, w: lw }); line = []; lw = 0; }
      line.push({ parts: wd, w: ww });
      lw += (line.length > 1 ? sp : 0) + ww;
    }
    if (line.length) lines.push({ words: line, w: lw, last: true });
    let markup = '', y = y0 + px;
    for (const ln of lines) {
      const gaps = ln.words.length - 1;
      const extra = !ragged && !ln.last && gaps > 0 ? (W - ln.w) / gaps : 0;
      let x = x0;
      ln.words.forEach((wd, i) => {
        for (const it of wd.parts) { markup += mjAt(it, x, y); x += it.w; }
        x += sp + (i < gaps ? Math.min(extra, sp * 3) : 0);
      });
      y += lineH;
    }
    return { markup, h: lines.length ? (lines.length - 1) * lineH + px * 1.35 : 0 };
  }
  // the whole figure as an SVG document; opt: {panels: ['L'] | ['R'] | ['L', 'R'], widthIn, caption, morph, upTo}
  // opt.alive(): false once the figure is no longer wanted (the dialog's token moved on): -> null, nothing drawn after
  // opt.morph (the deformation open, morph-figure.md 5): the right panel is the deformation, one plane with X, its
  // image and the paths, for 0 <= t <= end (or up to the current t with opt.upTo), whatever the scrubber shows
  const mfFigCache = { key: '', sel: null };
  // (the export meshes of smPrepareExport live only while the figure draws; f.partial counts the forward images whose
  // mesh ended on a budget, which the dialog's note reports)
  // (each call tags its export meshes with its own generation, so a cancelled call's cleanup never drops the meshes
  // of the call that replaced it)
  async function buildFigure(opt) {
    const gen = ++sm.exportGen;
    try {
      const f = await buildFigureNow(Object.assign({}, opt, { expGen: gen }));
      if (f) f.partial = sm.exportPartial | 0;
      return f;
    } finally { smDropExport(gen); }
  }
  async function buildFigureNow(opt) {
    const alive = opt.alive || (() => true);
    const panels = opt.panels, W = Math.round(opt.widthIn * 96), dpr = FIG_DPI / 96;
    const isMorph = !!opt.morph && morphOn() && rImage() && !morphHasDeriv();
    const mEnd = morphLen(), Tend = isMorph ? (opt.upTo ? Math.max(1e-3, morph.T) : mEnd) : 0;
    const TICK = 8 * PT, LAB = 9 * PT, CAP = 9 * PT;
    const black = '#000', frameW = 0.75, tickW = 0.6;
    // margins (px): left room for tick numbers and the rotated axis title; bottom for numbers and the title
    const mL = (side) => (isPlanePanel(side) ? 40 : 0), mB = (side) => (isPlanePanel(side) ? 30 : 0);
    const both = panels.length === 2, arrowGap = both && rImage() && isPlanePanel('L') && !isMorph ? 40 : both ? 18 : 0;
    const topLetter = both ? 16 : 4, right = 6;
    const sumMargins = panels.reduce((a, s) => a + mL(s), 0) + arrowGap + right;
    const pw = (W - sumMargins) / panels.length;
    // the inverse programs the panels draw with, before the theme switch (no frame runs while it is in effect)
    if (!(await prepareExport(panels, alive, isMorph && !opt.upTo, { pw, dpr, gen: opt.expGen || 0 }))) return null;
    // One panel per task, in the light theme for print (switched for that panel only, so no frame on screen runs in
    // it), and every raster's encoding in a task of its own: toBlob reads the pixels back synchronously and waits
    // for the GPU to finish what was drawn before. Two 300 dpi globe panels and the first readback in one task
    // blocked the main thread for 51-60 ms (P3 review); a task here is one panel's draw, or one readback.
    const nextTask = () => new Promise((r) => setTimeout(r, 0));
    const drawn = [];
    for (const side of panels) {
      if (drawn.length) { await nextTask(); if (!alive()) return null; }
      const real = side === 'L' ? paneL : paneR;
      const ph = pw * real.h / effW(side);
      const wasDark = TH.dark, attr = document.documentElement.getAttribute('data-theme');
      if (wasDark) { document.documentElement.setAttribute('data-theme', 'light'); readTheme(); }
      // the deformation panel is drawn at t = Tend, paused (the region exact at the end, normalizeMap)
      const mKeep = { T: morph.T, playing: morph.playing };
      if (isMorph && side === 'R') { morph.T = Tend; morph.playing = false; }
      figVec = isMorph && side === 'R';
      try {
        drawn.push({ side, ph, cv: renderOff(side, pw, ph, dpr) });
      } finally {
        figVec = false;
        morph.T = mKeep.T; morph.playing = mKeep.playing;
        if (wasDark) { if (attr == null) document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', attr); readTheme(); }
        requestRender('L', 'R');
      }
    }
    // the rasters are encoded after the theme is restored, off the main thread, once the GPU has finished the panels
    // (the first readback waited for every panel's passes: 51-58 ms of main thread for two 300 dpi globes)
    if (GLR.gpuDone) await GLR.gpuDone();
    if (!alive()) return null;
    const rasters = [];
    for (const d of drawn) {
      await nextTask();
      if (!alive()) return null;
      rasters.push({ side: d.side, ph: d.ph, url: await canvasURL(d.cv), w: d.cv.width, h: d.cv.height });
    }
    if (!alive()) return null;
    const keyH = panels.some((s) => panelKey(s)) ? 34 : 0;
    const PH = Math.max(...rasters.map((r) => r.ph));
    let body = '';
    let x = 0;
    const panelTop = topLetter;
    let mSel = null;
    for (const [i, r] of rasters.entries()) {
      const side = r.side, plane = isPlanePanel(side);
      x += mL(side);
      const y = panelTop + (PH - r.ph) / 2;
      body += `<image x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${pw.toFixed(2)}" height="${r.ph.toFixed(2)}" preserveAspectRatio="none" href="${r.url}" xlink:href="${r.url}"/>`;
      if (isMorph && side === 'R') {
        // the vector layers of the deformation: X's outline, the paths, arrowheads, dots, the labels
        const b = panelBox('R', pw, r.ph);
        const P = (w) => [x + (w.re - b.x0) / (b.x1 - b.x0) * pw, y + (b.y1 - w.im) / (b.y1 - b.y0) * r.ph];
        // chosen in slices (the dialog stays live; a newer option cancels it), and kept for the same chain, shapes,
        // panel and time, so the Caption switch or a repeated build reuses it
        const fkey = JSON.stringify([chainSig[nSteps()], S.focus, !!S.homAll, S.shapes.filter((s) => s.visible !== false), opt.widthIn, Tend, b, pw, r.ph, x, y]);
        if (mfFigCache.key === fkey) mSel = mfFigCache.sel;
        else {
          mSel = await runGenSliced(morphPathsGen(P, { x, y, w: pw, h: r.ph }, b, opt.widthIn, Tend, { headL: MF.headL }), alive);
          if (!mSel || !alive()) return null;
          mfFigCache.key = fkey; mfFigCache.sel = mSel;
        }
        // Paths off (the figure's Paths row): X's outline and the image only, no arrows (and no arrow sentence)
        if (opt.paths === false) mSel = Object.assign({}, mSel, { kept: [], labelled: null });
        const lay = morphFigureLayers(mSel, P, { x, y, w: pw, h: r.ph, wx0: b.x0, wx1: b.x1, wy0: b.y0, wy1: b.y1 }, `mfclip${i}`);
        mSel.labelled = lay.labelled;
        body += lay.svg;
      }
      if (plane) {
        const b = panelBox(side, pw, r.ph), v = isMorph && side === 'R' ? '' : panelVar(side);
        const step = Axes.niceStep(Math.max(b.x1 - b.x0, b.y1 - b.y0) / 5), minor = step / (String(step / 10 ** Math.floor(Math.log10(step)))[0] === '2' ? 4 : 5);
        const X = (t) => x + (t - b.x0) / (b.x1 - b.x0) * pw, Y = (t) => y + (b.y1 - t) / (b.y1 - b.y0) * r.ph;
        let d = '';
        const tick = (len, step2) => {
          for (let i2 = Math.ceil(b.x0 / step2); i2 <= Math.floor(b.x1 / step2); i2++) { const px = X(i2 * step2); d += `M${px.toFixed(2)} ${(y + r.ph).toFixed(2)}v${-len}M${px.toFixed(2)} ${y.toFixed(2)}v${len}`; }
          for (let j = Math.ceil(b.y0 / step2); j <= Math.floor(b.y1 / step2); j++) { const py = Y(j * step2); d += `M${x.toFixed(2)} ${py.toFixed(2)}h${len}M${(x + pw).toFixed(2)} ${py.toFixed(2)}h${-len}`; }
        };
        tick(4, step); tick(2.2, minor);
        body += `<path d="${d}" stroke="${black}" stroke-width="${tickW}" fill="none"/>`;
        body += `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${pw.toFixed(2)}" height="${r.ph.toFixed(2)}" fill="none" stroke="${black}" stroke-width="${frameW}"/>`;
        // tick numbers below and left
        for (let i2 = Math.ceil(b.x0 / step); i2 <= Math.floor(b.x1 / step); i2++) body += mjAt(mj(tickTex(i2 * step, step), TICK), X(i2 * step), y + r.ph + 4 + TICK * 0.95, 'middle');
        for (let j = Math.ceil(b.y0 / step); j <= Math.floor(b.y1 / step); j++) { const it = mj(tickTex(j * step, step), TICK); body += mjAt(it, x - 4, Y(j * step) + TICK * 0.33, 'end'); }
        // axis titles
        body += mjAt(mj(`\\operatorname{Re} ${v}`, LAB), x + pw / 2, y + r.ph + 4 + TICK + 4 + LAB * 0.9, 'middle');
        const it = mj(`\\operatorname{Im} ${v}`, LAB), cx = x - 30, cy = y + r.ph / 2;
        body += `<g transform="rotate(-90 ${cx.toFixed(2)} ${cy.toFixed(2)})">${mjAt(it, cx, cy + LAB * 0.32, 'middle')}</g>`;
      }
      if (both) body += mjAt(mj(`\\text{(${String.fromCharCode(97 + i)})}`, LAB), x - (plane ? mL(side) - 2 : 0), panelTop - 5);
      // colour key, under the panel
      const key = panelKey(side);
      if (key) {
        const kw = Math.min(pw * 0.62, 190), kx = x + (pw - kw) / 2, ky = panelTop + PH + mB(side) + 8, gid = `kg${i}`;
        body += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="0">${key.stops.map(([o, c]) => `<stop offset="${o.toFixed(4)}" stop-color="${c}"/>`).join('')}</linearGradient></defs>`;
        body += `<rect x="${kx.toFixed(2)}" y="${ky.toFixed(2)}" width="${kw.toFixed(2)}" height="6" fill="url(#${gid})" stroke="${black}" stroke-width="0.5"/>`;
        let kd = '';
        for (const [o, t] of key.ticks) { const tx = kx + o * kw; kd += `M${tx.toFixed(2)} ${(ky + 6).toFixed(2)}v2.5`; body += mjAt(mj(t, TICK), tx, ky + 8.5 + TICK * 0.95, 'middle'); }
        body += `<path d="${kd}" stroke="${black}" stroke-width="0.5"/>`;
        body += mjAt(mj(key.title, LAB), kx - 6, ky + 6, 'end');
      }
      // the map arrow between domain and image
      if (both && i === 0 && arrowGap >= 24 && !isMorph) {
        const ax0 = x + pw + 5, ax1 = x + pw + arrowGap - 3, ay = panelTop + PH / 2;
        body += `<path d="M${ax0.toFixed(2)} ${ay.toFixed(2)}H${ax1.toFixed(2)}M${(ax1 - 4).toFixed(2)} ${(ay - 2.6).toFixed(2)}L${ax1.toFixed(2)} ${ay.toFixed(2)}L${(ax1 - 4).toFixed(2)} ${(ay + 2.6).toFixed(2)}" stroke="${black}" stroke-width="0.7" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        body += mjAt(mj(S.focus === 0 ? 'F' : `f_{${S.focus}}`, LAB), (ax0 + ax1) / 2, ay - 5, 'middle');
      }
      x += pw + (i === 0 ? arrowGap : 0);
    }
    let H = panelTop + PH + Math.max(...panels.map(mB)) + keyH + 6;
    let capSegs;
    if (isMorph && panels.includes('R')) {
      const keepT = morph.T;
      morph.T = Tend;
      try {
        if (both) {
          const vis = S.shapes.filter((s) => s.visible !== false);
          let pi = 0;
          const list = joinList(vis.map((s) => { const r = shapePhrase(s, s.kind === 'point' ? pi : 0); if (s.kind === 'point') pi++; return r; }));
          capSegs = [{ b: '(a)' }, { t: ' ' }, ...(list.length ? cap1(list) : [{ t: 'The plane' }]), { t: ' in the ' }, { m: 'z' }, { t: '-plane. ' }, { b: '(b)' }, { t: ' The deformation ' }, { m: String.raw`H_t,\ 0\le t\le ` + CX.fmtNum(Tend, 2) }, { t: ': ' }, ...morphCaption(mSel || { kept: [] }, Tend, { both: true })].map((g) => (g.m != null ? { m: inlineFrac(g.m) } : g));
        } else capSegs = morphCaption(mSel || { kept: [] }, Tend);
      } finally { morph.T = keepT; }
    } else capSegs = figureCaption(panels);
    let capMarkup = '';
    if (opt.caption) {
      const c = layoutCaption(capSegs, 0, H + 4, W, CAP, isMorph && panels.includes('R'));
      capMarkup = c.markup; H += 4 + c.h + 4;
    }
    H = Math.ceil(H);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${(W / 96).toFixed(3)}in" height="${(H / 96).toFixed(3)}in" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#ffffff"/>${body}${capMarkup}</svg>`;
    return { svg, W, H, captionTex: captionLatex(capSegs), morph: mSel ? { kept: mSel.kept.map((k) => ({ z: [k.sp.z.re, k.sp.z.im], kind: k.sp.kind, start: k.l[0], end: k.l[k.l.length - 1], meet: !!k.meet })), budget: mSel.budget, nCands: mSel.nCands, labelled: mSel.labelled ? [mSel.labelled.sp.z.re, mSel.labelled.sp.z.im] : null, log: mSel.log.map(([c, why]) => [c.sp.z.re, c.sp.z.im, c.sp.kind, why]) } : null };
  }
  // ---- formats ----
  function loadScript(src) {
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => rej(new Error('load')); document.head.append(s); });
  }
  let pdfLibs = null;
  function pdfLib() {
    if (!pdfLibs) pdfLibs = (async () => {
      if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if (!(window.svg2pdf && window.svg2pdf.svg2pdf)) await loadScript('https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js');
      return window.jspdf && window.svg2pdf ? { jsPDF: window.jspdf.jsPDF, svg2pdf: window.svg2pdf.svg2pdf } : null;
    })().catch(() => { pdfLibs = null; return null; });
    return pdfLibs;
  }
  async function figurePDF(fig) {
    const lib = await pdfLib();
    if (!lib) throw new Error('The PDF library could not be loaded');
    const wpt = fig.W * 72 / 96, hpt = fig.H * 72 / 96;
    const doc = new lib.jsPDF({ unit: 'pt', format: [wpt, hpt], orientation: wpt > hpt ? 'landscape' : 'portrait', compress: true });
    const el = new DOMParser().parseFromString(fig.svg, 'image/svg+xml').documentElement;
    // svg2pdf measures in the document: attach it out of sight while it converts
    const host = h('div', { style: 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden' });
    host.append(el); document.body.append(host);
    try { await lib.svg2pdf(el, doc, { x: 0, y: 0, width: wpt, height: hpt }); } finally { host.remove(); }
    return doc.output('blob');
  }
  async function figurePNG(fig) {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fig.svg);
    await img.decode();
    const k = FIG_DPI / 96;
    const c = document.createElement('canvas');
    c.width = Math.round(fig.W * k); c.height = Math.round(fig.H * k);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, 'image/png'));
  }
  function latexFigure(fig, filename) {
    return [
      '\\begin{figure}[t]',
      '  \\centering',
      `  \\includegraphics[width=\\linewidth]{${filename}}`,
      `  \\caption{${fig.captionTex}}`,
      '  \\label{fig:complex-map}',
      '\\end{figure}',
      '',
    ].join('\n');
  }
  // ---- the export dialog: panels, width, caption, format, a live preview ----
  let lastFigure = null;   // the last figure the dialog built (a test hook reads it)
  // paths: the deformation figure's arrows t -> H_t(z) (null: as on screen, the Paths toggle)
  const figOpt = { panels: 'both', width: 7, caption: true, format: 'pdf', mpanels: 'R', upTo: false, paths: null };
  const figPaths = () => (figOpt.paths == null ? S.morphPaths !== false : !!figOpt.paths);
  function openFigureDialog() {
    if (document.querySelector('.modal-bg')) return;
    const opener = document.activeElement;
    const close = () => { token++; bg.remove(); document.removeEventListener('keydown', onKey, true); if (opener && opener.focus) opener.focus({ preventScroll: true }); };
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); close(); } };
    document.addEventListener('keydown', onKey, true);
    const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } });
    const preview = h('div', { class: 'fig-preview' }, h('div', { class: 'fig-wait' }, 'Typesetting…'));
    const note = h('div', { class: 'fig-note' });
    // the deformation open (morph-figure.md 5): one panel by default, Both = (a) X and (b) the deformation; not over
    // a d/dz step, which has no deformation
    // The figure follows the view (merged-views.md): X → Y the two-panel figure (or one of its panels), the
    // deformation the morph figure, Phase and Landscape their one wide panel
    const morphFig = S.view.main === 'xy' && morphOn() && rImage() && !morphHasDeriv();
    figOpt.paths = null; // (the figure's Paths start as on screen each time the dialog opens)
    // (X → Y with the deformation on the globe, or over a d/dz step: the one merged panel as on screen, H_t at t)
    const mergedOne = S.view.main === 'xy' && morphOn() && !morphFig;
    const oneFig = S.view.main !== 'xy' || mergedOne;
    const pk = morphFig ? figOpt.mpanels : figOpt.panels;
    const panelsOf = () => { if (oneFig) return [mergedOne ? 'R' : 'L']; const v = morphFig ? figOpt.mpanels : figOpt.panels; return v === 'both' ? ['L', 'R'] : [v]; };
    let fig = null, token = 0;
    // any option change starts a new figure and cancels the one in progress (its alive() turns false); so does Close
    const rebuild = async () => {
      const my = ++token;
      preview.classList.add('busy');
      try {
        const f = await buildFigure({ panels: panelsOf(), widthIn: figOpt.width, caption: figOpt.caption, morph: morphFig, upTo: figOpt.upTo, paths: figPaths(), alive: () => my === token && bg.isConnected });
        lastFigure = f;
        if (my !== token || !f) return;
        fig = f;
        preview.innerHTML = '';
        const img = h('img', { alt: 'Preview of the exported figure', src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(f.svg) });
        preview.append(img);
        note.textContent = `${figOpt.width === 7 ? 'Double column' : 'Single column'}: ${(f.W / 96).toFixed(2)} × ${(f.H / 96).toFixed(2)} in, text 8–9 pt, plots at ${FIG_DPI} dpi.` + (f.partial ? ' A forward image reached its mesh budget and is drawn with coarser triangles in places.' : '');
      } catch (e) {
        console.error(e);
        if (my === token) { preview.innerHTML = ''; preview.append(h('div', { class: 'fig-wait' }, 'The figure could not be made.')); }
      } finally { if (my === token) preview.classList.remove('busy'); }
    };
    const set = (k, v) => { figOpt[k] = v; if (k !== 'format') rebuild(); };
    const fname = () => `complex-map-figure.${figOpt.format === 'png' ? 'png' : figOpt.format}`;
    const save = async () => {
      if (!fig) return;
      try {
        let data;
        if (figOpt.format === 'svg') data = fig.svg;
        else if (figOpt.format === 'png') data = await figurePNG(fig);
        else data = await figurePDF(fig);
        await saveFile(fname(), data);
      } catch (e) { console.error(e); toast(figOpt.format === 'pdf' ? 'The PDF could not be made here; try SVG.' : 'The figure could not be saved.'); }
    };
    const copyLatex = () => {
      if (!fig) return;
      const name = figOpt.caption ? fname() : fname();
      copyText(latexFigure(fig, name.replace(/\.svg$/, '.pdf')));
      toast(figOpt.caption ? 'LaTeX figure copied. Export without the caption in the image to avoid printing it twice.' : 'LaTeX figure copied, with the caption.');
    };
    const row = (label, el) => h('div', { class: 'fig-row' }, h('span', { class: 'fig-l' }, label), el);
    const figPanelsSeg = () => {
      const sg = seg('figPanels', figOpt.panels, [['both', 'Both'], ['L', 'Left'], ['R', 'Right']], (v) => set('panels', v), 'Panels');
      // with a d/dz step in range there is no deformation to export (morph-figure.md 3, M1)
      if (morphOn() && morphHasDeriv()) { sg.dataset.tip = 'd/dz has no deformation: the panels show the current frame'; }
      return sg;
    };
    const m = h('div', { class: 'modal fig-modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'figTitle' },
      h('h2', { id: 'figTitle' }, 'Export figure'),
      h('div', { class: 'fig-body' },
        preview,
        h('div', { class: 'fig-opts' },
          ...(oneFig ? [] : [morphFig ? row('Panels', seg('figPanels', pk, [['R', 'Deformation'], ['both', 'Both'], ['L', 'Left']], (v) => set('mpanels', v), 'Panels')) : row('Panels', figPanelsSeg())]),
          ...(morphFig ? [row('Time', seg('figTime', figOpt.upTo ? 'now' : 'end', [['end', 'Whole'], ['now', 'Up to t']], (v) => set('upTo', v === 'now'), 'Time'))] : []),
          ...(morphFig ? [row('Paths', seg('figPaths', figPaths() ? 'on' : 'off', [['on', 'Arrows'], ['off', 'None']], (v) => set('paths', v === 'on'), 'Paths'))] : []),
          row('Width', seg('figWidth', String(figOpt.width), [['3.4', 'Single column'], ['7', 'Double column']], (v) => set('width', +v), 'Width')),
          row('Caption', seg('figCap', figOpt.caption ? 'in' : 'out', [['in', 'In the figure'], ['out', 'LaTeX only']], (v) => set('caption', v === 'in'), 'Caption')),
          row('Format', seg('figFmt', figOpt.format, [['pdf', 'PDF'], ['svg', 'SVG'], ['png', 'PNG']], (v) => set('format', v), 'Format')),
          note)),
      h('div', { class: 'modal-foot' },
        h('button', { class: 'btn', onclick: copyLatex }, 'Copy LaTeX figure'),
        h('button', { class: 'btn', onclick: close }, 'Close'),
        h('button', { class: 'btn primary', onclick: save }, 'Save figure')));
    bg.append(m);
    document.body.append(bg);
    m.querySelector('.btn.primary').focus({ preventScroll: true });
    setTimeout(rebuild, 30);
    if (figOpt.format === 'pdf') pdfLib(); // fetched while the preview is typeset
  }
  // what each lit lamp means, in LaTeX
  const BADGE_TEX = {
    analytic: 'holomorphic at every point of its natural domain $D$',
    entire: '$D = \\mathbb{C}$ and $F$ is holomorphic everywhere',
    rational: 'agrees on $D$ with $P(z)/Q(z)$ for polynomials $P$ and $Q$',
    polynomial: '$F$ is a polynomial in $z$',
    mobius: '$F(z) = \\frac{az+b}{cz+d}$ with $ad - bc \\neq 0$',
    proper: 'preimages of compact subsets of $\\mathbb{C}$ are compact in $D$, so $|F(z)| \\to \\infty$ as $z \\to \\partial D$ or $z \\to \\infty$',
    homeo: 'injective and continuous on the open set $D$, hence a homeomorphism $D \\to F(D)$ by invariance of domain',
    conformal: 'holomorphic and injective, hence a biholomorphism $D \\to F(D)$ with $F\' \\neq 0$',
  };
  const BADGE_NAME_TEX = { mobius: 'M\\"obius' };
  // a standalone LaTeX document: the composite map (constants that parse back exactly, non-principal branches
  // noted), every step, the natural domain, and the guaranteed properties (each implied by the chain)
  function latexDocument() {
    const act = activeSteps();
    const P = Funcs.composeProps(act.map((k) => built[k - 1].props));
    const words = Object.assign({}, P, { homeo: P.injective, conformal: P.analytic && P.injective });
    const texF = exactTexF();
    const rows = [], conds = [];
    CX.setTexExact(true);
    try {
      S.steps.forEach((st, i) => {
        const k = i + 1, b = built[i];
        if (st.on === false) rows.push(`  w_{${k}} &= w_{${k - 1}} && \\text{(step ${k} bypassed)}`);
        else if (b.error) rows.push(`  w_{${k}} &= w_{${k - 1}} && \\text{(step ${k} skipped: it has an error)}`);
        else rows.push(`  w_{${k}} &= ${b.tex({ s: wvar(k - 1), p: 4 }).s} && \\text{(${(b.def ? b.def.label : st.type).replace(/[&%$#_{}~^\\]/g, '')})}`);
      });
      for (const k of act) { const b = built[k - 1]; if (b.domain) conds.push(b.domain(wvar(k - 1))); }
    } finally { CX.setTexExact(false); }
    const deg = P.deg != null ? (P.degExact ? `, of degree ${P.deg}` : `, of degree at most ${P.deg}`) : '';
    const lit = BADGES.filter(([k]) => words[k]), unlit = BADGES.filter(([k]) => !words[k]);
    const name = (k, n) => BADGE_NAME_TEX[k] || n;
    const out = [
      '% Exported from Complex Map Workbench',
      '\\documentclass{article}',
      '\\usepackage{amsmath,amssymb}',
      '\\begin{document}',
      '',
      '\\section*{The map}',
      '\\[',
      `  ${texF}`,
      '\\]',
    ];
    if (S.steps.length) {
      out.push('built step by step from $w_0 = z$, with $F(z) = w_{' + S.steps.length + '}$:', '\\begin{align*}', rows.join(' \\\\\n'), '\\end{align*}');
    } else out.push('The chain is empty, so $F$ is the identity.');
    out.push('', '\\section*{Natural domain}');
    if (!conds.length) out.push(act.every((k) => built[k - 1].props.entire) ? '$D = \\mathbb{C}$.' : '$D$ is the set of $z$ at which every step is defined.');
    else out.push('$D$ is the set of $z$ for which', '\\begin{itemize}', ...conds.map((c) => `  \\item $${c}$`), '\\end{itemize}', act.length > 1 ? 'where $w_k$ is the value after step $k$ and $w_0 = z$.' : '');
    out.push('', '\\section*{Guaranteed properties}',
      'Each property listed here is implied by the chain: every step has it and composition preserves it (a derivative step keeps the properties that differentiation preserves). The list is sound but not complete: a property that is not listed may still hold.');
    if (lit.length) {
      out.push('\\begin{itemize}');
      for (const [k, n] of lit) out.push(`  \\item \\textbf{${name(k, n)}}${k === 'rational' || k === 'polynomial' ? deg : ''}: ${BADGE_TEX[k]}.`);
      out.push('\\end{itemize}');
    } else out.push('', 'The chain guarantees none of the tracked properties.');
    if (unlit.length) out.push('', `Not implied by the chain (they may still hold): ${unlit.map(([k, n]) => name(k, n).replace(/ onto image$/, ' onto its image')).join(', ')}.`);
    out.push('', '\\end{document}', '');
    return out.join('\n');
  }
  function openExportMenu(anchor) {
    const items = [
      { label: 'Figure for an article…', run: () => openFigureDialog() },
      'sep',
      { label: 'Copy LaTeX with guarantees', icon: 'copy', run: () => { copyText(latexDocument()); toast('LaTeX copied: the map, its natural domain and its guarantees.'); } },
      { label: 'Save LaTeX with guarantees (.txt)', run: () => saveFile('complex-map.txt', latexDocument()) },
    ];
    // files cannot be offered in this view: only the copy remains
    if (dlDone && !dlNs) for (const it of items) if (it !== 'sep' && /Save/.test(it.label)) it.disabled = true;
    openMenu(anchor, items);
  }
  function fillProps(act, P, words) {
    const E = PROPS.el;
    // composite formula and the chain list (TeX.set skips unchanged nodes)
    let arg = { s: 'z', p: 4 };
    for (const k of act) arg = built[k - 1].tex(arg);
    PROPS.texF = `F(z)=${arg.s}`;
    const long = arg.s.length >= 700;
    E.flong.hidden = !long; E.ftex.hidden = long;
    if (!long) TeX.set(E.ftex, PROPS.texF, true);
    for (const [k, t] of E.chain) TeX.set(t, `w_{${k}}=${built[k - 1].tex({ s: wvar(k - 1), p: 4 }).s}`);
    // count and warnings
    const nOn = BADGES.filter(([k]) => words[k]).length, cnt = `${nOn} of ${BADGES.length}`;
    if (E.count.textContent !== cnt) E.count.textContent = cnt;
    const warns = [];
    S.steps.forEach((st, i) => { if (st.on !== false && built[i].error) warns.push(`Step ${i + 1} has an error and is skipped until fixed.`); });
    if (P.constant) warns.push('A step is constant, so F is constant on D.');
    const ws = warns.join('\n');
    if (E.warnSig !== ws) {
      E.warnSig = ws;
      for (const el of E.warnEls) el.remove();
      E.warnEls = warns.map((w) => h('div', { class: 'warnrow', role: 'status' }, h('span', { class: 'wi', html: ICONS.warning }), h('div', null, w)));
      E.lampList.before(...E.warnEls);
    }
    // lamps: state, qualifier, description; a lamp that changes flashes once
    for (const [key, name, desc] of BADGES) {
      const L = E.lamps[key], on = !!words[key];
      let q = '';
      if (on && (key === 'rational' || key === 'polynomial') && P.deg != null) q = P.degExact ? `deg ${P.deg}` : `deg ≤ ${P.deg}`;
      if (L.q.textContent !== q) L.q.textContent = q;
      if (L.on === on) continue;
      const flash = L.on != null || (lastWords && lastWords[key] !== on);
      L.on = on;
      L.li.classList.toggle('on', on);
      L.li.setAttribute('aria-label', `${name}: ${on ? 'guaranteed' : 'not guaranteed'}`);
      L.desc.textContent = desc + (on ? '' : ' The chain does not imply this; it may still hold.');
      if (flash) { L.li.classList.remove('flash'); requestAnimationFrame(() => L.li.classList.add('flash')); }
    }
    lastWords = Object.fromEntries(BADGES.map(([k]) => [k, !!words[k]]));
    // natural domain
    if (E.domLbl) {
      const all = act.every((k) => built[k - 1].props.entire || built[k - 1].def.id === 'conj');
      const t = all ? '<i>D</i> = ℂ' : 'Every <i>z</i> where each step is defined.';
      if (E.domLbl.dataset.v !== t) { E.domLbl.dataset.v = t; E.domLbl.innerHTML = t; }
    } else {
      let i = 0;
      for (const k of act) { const b = built[k - 1]; if (b.domain && E.dom[i]) TeX.set(E.dom[i++], b.domain(wvar(k - 1))); }
    }
    // matrix cells
    for (const [k, cells] of E.rows) {
      // a d/dz row: what the chain through it guarantees (the fold, as on its card); it has no map of its own
      const pr = !k ? P : isDeriv(k) ? Funcs.composeProps(act.filter((j) => j <= k).map((j) => built[j - 1].props)) : built[k - 1].props;
      CHIP_DEFS.forEach(([key], j) => {
        const on = !!pr[key], td = cells[j];
        if (td.classList.contains(on ? 'y' : 'n')) return;
        td.classList.toggle('y', on); td.classList.toggle('n', !on);
        td.firstChild.setAttribute('aria-label', on ? 'yes' : 'no');
      });
    }
  }
  // highlight a step in the panel, the matrix and the chain at once
  function hiStep(k, on) {
    for (const el of document.querySelectorAll(`[data-k="${k}"]`)) el.classList.toggle('hi', on);
  }

  // ---------------- interaction ----------------
  function snapZ(pane, z, force) {
    if (!S.snap && !force) return z;
    // the finest graph-paper tier that is clearly drawn (tiers are 1, 5, 10, 50, ... times a power of ten)
    const sc = pane.view.s, d0 = Math.pow(10, Math.ceil(Math.log10(8 / sc)));
    const step = [1, 5, 10, 50, 100].map((m) => d0 * m).find((st) => st * sc >= 14) || d0 * 100;
    const gx = Math.round(z.re / step) * step, gy = Math.round(z.im / step) * step;
    const [x, y] = pane.w2sxy(gx, gy), [x0, y0] = pane.w2s(z);
    if (Math.hypot(x - x0, y - y0) < 9) return C(+gx.toPrecision(12), +gy.toPrecision(12));
    return z;
  }
  const evXY = (pane, e) => { const r = pane.ocanvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  let drag = null;
  const touches = new Map(); // pointerId -> [x, y] for pinch zoom
  // a pane that orbits a camera (U-b): X Landscape (cam), X Sphere (camL), Y Sphere (camS)
  const is3DSide = (side) => (side === 'L' ? lLand() || lGlobe() : rGlobe());
  const is3D = () => rGlobe();
  const cam3 = () => camS;
  const camOf = (side) => (side === 'R' ? camS : lLand() ? cam : leftCam());
  const camBaseOf = (c) => (c === camS ? CAMS : c === cam ? CAM3 : leftCamBase());
  // the orbit camera of the left plane's sphere view (renderSphereLeft keeps it fitted, like camS)
  const leftCam = () => (typeof camL !== 'undefined' ? camL : null);
  const leftCamBase = () => (typeof CAML !== 'undefined' ? CAML : CAMS);
  // the landscape may be seen from the side and from below; the spheres from any latitude
  const pitchMin = (c) => (c === cam ? -60 * DEG : -88 * DEG);
  function zoomPane(pane, side, x, y, f) {
    if (is3DSide(side)) { const c = camOf(side); if (c) { const fit = camBaseOf(c).dist; c.dist = Math.min(4 * fit, Math.max(0.4 * fit, c.dist / f)); requestRender(side); } return; }
    if (side === 'L') {
      pane.setView(leftView()); pane.zoomAt(x, y, f);
      if (leftStage() > 0) leftAuto = false;
      sourceViewChanged();
      requestRender('L');
    } else {
      pane.setView(V.right); pane.zoomAt(x, y, f); rightAuto = false; requestRender('R');
    }
  }
  // Space held turns a globe in every tool, Alt suspends snapping on it (P3b, panels.md 9.5); a field being typed in
  // keeps its Space
  const typing = (t) => !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
  // While a globe is editable, Space is the turn key only: a button (or a row) that kept the focus after a mouse click
  // does not take it as a press (a second Undo, a hidden shape). A control focused from the keyboard (Tab, arrows)
  // keeps Space as its press. (:focus-visible cannot tell them apart here: a key press makes the focused element match
  // it before its keydown is dispatched.)
  let spaceEaten = false, lastInput = 'pointer', focusVia = 'pointer';
  document.addEventListener('pointerdown', () => { lastInput = 'pointer'; }, true);
  document.addEventListener('keydown', (e) => { if (!(e.code === 'Space' || e.key === ' ')) lastInput = 'key'; }, true);
  document.addEventListener('focusin', () => { focusVia = lastInput; }, true);
  const eatSpace = (e) => {
    if (!(globeEdit('L') || globeEdit('R'))) return false;
    const a = document.activeElement;
    if (a && a !== document.body && focusVia === 'key') return false;
    e.preventDefault(); e.stopPropagation();
    if (a && a !== document.body && typeof a.blur === 'function') a.blur();
    return true;
  };
  window.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.key === ' ') && !typing(e.target)) { spaceHeld = true; if (eatSpace(e)) spaceEaten = true; }
    if (e.key === 'Alt') altHeld = true;
  }, true);
  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' || e.key === ' ') { spaceHeld = false; if (spaceEaten) { e.preventDefault(); e.stopPropagation(); spaceEaten = false; } }
    if (e.key === 'Alt') altHeld = false;
  }, true);
  window.addEventListener('blur', () => { spaceHeld = false; altHeld = false; });
  function setupPane(pane, side) {
    const cv = pane.ocanvas;
    // a right click near a curve: the menu of its line integral (a right-button pan that moved opens nothing; a
    // touch opens it with a long press, below)
    cv.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (touches.size || performance.now() - holdMenuT < 900) return;
      if ((lastPan.moved && performance.now() - lastPan.t < 500) || (drag && (drag.moved || drag.far))) return;
      const [x, y] = evXY(pane, e);
      if (openIntegralMenu(pane, side, x, y, e.clientX, e.clientY)) { drag = null; setCursor(pane, side); }
    });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [x, y] = evXY(pane, e);
      const k = e.ctrlKey ? 0.012 : 0.0016;
      zoomPane(pane, side, x, y, Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : k)));
    }, { passive: false });
    // touch has no hover: a still finger held for 500 ms turns its gesture into a probe (readouts, gauge)
    let hold = null;
    const endHold = () => { if (hold) { clearTimeout(hold.t); hold = null; } };
    cv.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') {
        touches.set(e.pointerId, evXY(pane, e));
        if (touches.size === 2) {
          endHold();
          // a second finger ends the one-finger gesture; an edit it already made is kept as its own undo step
          if (drag && (drag.mode === 'cut' || ((drag.mode === 'move' || drag.mode === 'handle' || drag.mode === 'gmove' || drag.mode === 'ghandle' || drag.mode === 'zp') && drag.moved))) onUp(pane, side, e);
          if (drag && drag.mode === 'gdraw') { draft = null; requestRender(side); }
          drag = null; draft = draft && draft.kind === 'polygon' ? draft : null; return;
        }
      }
      onDown(pane, side, e);
      // (on the right: the Phase portrait, the image plane and the globe, whose hold probes w like a mouse hover)
      const probeable = side === 'L' ? !lLand() : true;
      if (e.pointerType === 'touch' && drag && probeable && drag.mode !== 'cut' && drag.mode !== 'handle' && drag.mode !== 'ghandle' && drag.mode !== 'zp') {
        const d0 = drag, [x0, y0] = evXY(pane, e);
        endHold();
        hold = { id: e.pointerId, x: x0, y: y0, ev: e, t: setTimeout(() => {
          const ev = hold && hold.ev;
          hold = null;
          if (drag !== d0 || d0.moved || touches.size !== 1) return;
          // undo what the touch began (a draft, a small pan), then probe under the finger, or open the integral
          // menu of a curve there
          if (d0.mode === 'draw' || d0.mode === 'gdraw') { draft = null; requestRender('OL', 'OR', d0.mode === 'gdraw' ? side : null); }
          if (d0.mode === 'panL') { const v = leftView(); v.cx = d0.cx; v.cy = d0.cy; requestRender('L', 'R'); }
          if (d0.mode === 'panR') { V.right.cx = d0.cx; V.right.cy = d0.cy; requestRender('R'); }
          if (d0.mode === 'orbit') { const c = d0.cam || camOf(side); c.yaw = d0.yaw; c.pitch = d0.pitch; c.vyaw = c.vpitch = 0; requestRender(side); }
          const r = cv.getBoundingClientRect();
          if (openIntegralMenu(pane, side, x0, y0, r.left + x0, r.top + y0)) { drag = null; holdMenuT = performance.now(); setCursor(pane, side); return; }
          drag = { mode: 'probe' };
          onMove(pane, side, ev);
        }, 500) };
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (hold && e.pointerId === hold.id) {
        const [x, y] = evXY(pane, e);
        if (Math.hypot(x - hold.x, y - hold.y) > 6) endHold(); else hold.ev = e;
      }
      if (e.pointerType === 'touch' && touches.has(e.pointerId)) {
        const prev = [...touches.values()];
        touches.set(e.pointerId, evXY(pane, e));
        if (touches.size === 2) {
          const now = [...touches.values()];
          const d0 = Math.hypot(prev[0][0] - prev[1][0], prev[0][1] - prev[1][1]);
          const d1 = Math.hypot(now[0][0] - now[1][0], now[0][1] - now[1][1]);
          if (d0 > 0 && d1 > 0) zoomPane(pane, side, (now[0][0] + now[1][0]) / 2, (now[0][1] + now[1][1]) / 2, d1 / d0);
          // a two-finger drag turns a globe (P3b, P6: one finger draws there)
          if (side === 'L' ? lGlobe() : rGlobe()) {
            const c = camOf(side);
            const mx = (now[0][0] + now[1][0] - prev[0][0] - prev[1][0]) / 2, my = (now[0][1] + now[1][1] - prev[0][1] - prev[1][1]) / 2;
            if (c && (mx || my)) { c.yaw -= mx * 0.35 * DEG; c.pitch = Math.max(pitchMin(c), Math.min(88 * DEG, c.pitch + my * 0.35 * DEG)); c.vyaw = c.vpitch = 0; requestRender(side); }
          }
          return;
        }
      }
      onMove(pane, side, e);
    });
    const up = (e) => { if (hold && e.pointerId === hold.id) endHold(); touches.delete(e.pointerId); onUp(pane, side, e); };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { if (side === 'R') { rHover = null; setHoverW(null); requestRender('OL', 'OR'); } if (!drag) { probe = null; hoverCut = 0; zpHover = null; setReadouts(null); requestRender('OL', 'OR', rGlobe() ? 'R' : null, lGlobe() || lLand() ? 'L' : null); } });
    cv.addEventListener('dblclick', (e) => {
      if (draft && draft.kind === 'polygon' && (side === 'R') === !!draft.target) { finishPolygon(); return; }
      // a double-click that turned the globe (or the landscape) brings the camera home; one that drew, picked or moved a
      // shape on an editable globe keeps the user's view
      if (is3DSide(side)) { const c = camOf(side); if (c && (!globeEdit(side) || gTurnPress[side])) tweenCam(c, camBaseOf(c)); return; }
      if (side === 'L' && tool === 'select') {
        // double-click points the editable cut of the next step toward the cursor
        const k = leftStage() + 1;
        const b = built[k - 1];
        const c = b && !b.error && b.cuts.find((x) => x.editable);
        if (c && S.steps[k - 1].on !== false) {
          const [x, y] = evXY(pane, e);
          const z = pane.s2w(x, y);
          setCut(k, Math.atan2(z.im - c.p.im, z.re - c.p.re) / DEG, true);
          commit();
        }
      }
    });
  }
  // The z-window used for meshing unbounded regions follows the left view, with some slack.
  // The re-centre happens once, at the end of the gesture (motion-vs-rest cause 2): while a press is held (a left pan,
  // a drag) it waits for pointer-up (onUp calls sourceViewChanged.flush); a wheel or a key zoom applies it after 200 ms
  // without view changes. The meshes rebuilt for the new window keep their old (mesh, fix-up) pair on screen until
  // their own fix-ups land (shapeGPU's hold), so no unfixed intermediate is ever drawn.
  function sourceViewChanged() {
    if (leftStage() !== 0 || solo() === 'R') return;
    clearTimeout(sourceViewChanged.t);
    sourceViewChanged.pending = true;
    sourceViewChanged.t = setTimeout(sourceViewChanged.apply, 200);
  }
  sourceViewChanged.flush = () => {
    if (!sourceViewChanged.pending) return;
    clearTimeout(sourceViewChanged.t);
    sourceViewChanged.t = setTimeout(sourceViewChanged.apply, 0);
  };
  sourceViewChanged.apply = () => {
      // the press is still held: onUp flushes it (checked again later in case the press ends without an onUp)
      if (drag) { sourceViewChanged.t = setTimeout(sourceViewChanged.apply, 200); return; }
      sourceViewChanged.pending = false;
      if (leftStage() !== 0 || solo() === 'R') return;
      const b = paneL.box();
      // rounded outward to 1e-4 of the window's own size (rounding to significant digits of the coordinates
      // collapsed deep views far from 0 to zero width)
      const q = Math.max(b.x1 - b.x0, b.y1 - b.y0) * 1e-4;
      if (!(q > 0) || !Number.isFinite(q)) return;
      const nb = { x0: Math.floor(b.x0 / q) * q, x1: Math.ceil(b.x1 / q) * q, y0: Math.floor(b.y0 / q) * q, y1: Math.ceil(b.y1 / q) * q };
      if (!goodWin(nb)) return;
      const ow = clipWin.x1 - clipWin.x0, nw = nb.x1 - nb.x0;
      const shift = Math.max(Math.abs((nb.x0 + nb.x1 - clipWin.x0 - clipWin.x1) / 2), Math.abs((nb.y0 + nb.y1 - clipWin.y0 - clipWin.y1) / 2));
      const aspect = Math.abs((nb.y1 - nb.y0) / nw - (clipWin.y1 - clipWin.y0) / ow);
      if (!goodWin(clipWin) || nw / ow > 1.35 || ow / nw > 1.35 || shift > 0.3 * Math.min(ow, nw) || aspect > 0.15) {
        clipWin = nb;
        S.clipWin = clipWin;
        if (rightAuto && rImage()) fitRight(true);
        requestRender('L', 'R', 'T');
      }
      save();
  };
  function setCut(k, deg, snap15) {
    const st = S.steps[k - 1], b = built[k - 1];
    // unwrap against the current cut, so the seam turns continuously (to 190°, not to −170° on the same sheet)
    const old = Number(st.params.cut);
    let d = Number.isFinite(old) ? old + ((((deg - old) % 360) + 540) % 360 - 180) : deg;
    if (snap15) { const r = Math.round(d / 15) * 15; if (Math.abs(r - d) < 3) d = r; }
    d = Math.round(d * 10) / 10;
    // θ + 360m on sheet k is θ on sheet k + m: keep θ in (−180°, 180°] and carry the turns into the sheet, so
    // only the swept sector changes value and the card's (cut, sheet) names the evaluated branch
    if (b && b.def && b.def.params.some((q) => q.key === 'k')) {
      const m = Math.ceil((d - 180) / 360);
      if (m) {
        d = Math.round((d - 360 * m) * 10) / 10;
        let kk = Math.round(+st.params.k || 0) + m;
        if (st.type === 'root') { const n = Math.max(2, Math.round(+st.params.n || 2)); kk = ((kk % n) + n) % n; }
        st.params.k = kk;
        syncParam(k, 'k', '');
      }
    }
    st.params.cut = d;
    const inp = document.querySelector(`input[data-cut-step="${k}"]`);
    if (inp && document.activeElement !== inp) inp.value = d;
    chainChanged(false);
  }
  function setCursor(pane, side) {
    let c = 'default';
    const gDraw = (sd) => globeEdit(sd) && tool !== 'select' && !GLOBE_OFF.has(tool) && tool !== 'formula';
    const gEditDrag = drag && /^g(draw|handle|move)$/.test(drag.mode);
    // the 10 px around ∞ hold no point and no vertex (panels.md 9.7): not-allowed there for the Point and Polygon
    // tools and while a point or a vertex is dragged
    const gDrawCur = (sd) => (gInf[sd] && (tool === 'point' || tool === 'polygon') ? 'not-allowed' : 'crosshair');
    const gEditCur = (sd) => (drag.mode === 'gdraw' ? 'crosshair' : gInf[sd] ? 'not-allowed' : 'grabbing');
    if (side === 'R') c = gEditDrag ? gEditCur('R') : rGlobe() ? (gDraw('R') && !drag ? gDrawCur('R') : drag ? 'grabbing' : 'grab')
      : targetsEditable() && !drag && tool !== 'select' ? 'crosshair' : (drag ? 'grabbing' : 'grab');
    else if (lGlobe() && gEditDrag) c = gEditCur('L');
    else if (lGlobe() && gDraw('L') && !drag) c = gDrawCur('L');
    else if (lGlobe() && leftStage() > 0 && tool !== 'select' && !drag) c = 'not-allowed';
    // the landscape takes no drawing (panels.md 9.1)
    else if (lLand() && tool !== 'select' && tool !== 'formula' && !drag) c = 'not-allowed';
    else if (!lFlat()) c = drag ? 'grabbing' : 'grab';
    // P4: shapes are drawn in the z-plane; at focus k >= 2 a drawing tool does not draw over X (nothing jumps)
    else if (leftStage() > 0 && tool !== 'select' && !drag) c = 'not-allowed';
    else if (drag && (drag.mode === 'panL' || drag.mode === 'zp')) c = 'grabbing';
    else if (hoverCut || zpHover) c = 'pointer';
    else if (leftStage() > 0) c = 'grab';
    else c = tool === 'select' ? 'default' : 'crosshair';
    pane.ocanvas.style.cursor = c;
  }
  function onDown(pane, side, e) {
    const [x, y] = evXY(pane, e);
    pane.ocanvas.setPointerCapture(e.pointerId);
    const panBtn = e.button === 1 || e.button === 2 || (e.shiftKey && e.altKey);
    if (side === 'R') {
      // a press ends the hover: the preimages come back with the next hover
      if (hov.w) { setHoverW(null); requestRender('OL'); }
      // the w-globe takes targets (P3b)
      if (is3D() && globeEdit('R')) { globeDown(pane, side, e, x, y); gestureProbeOff(); setCursor(pane, side); return; }
      if (is3D()) {
        const c = cam3();
        c.vyaw = 0; c.vpitch = 0;
        drag = { mode: panBtn || e.shiftKey ? 'pan3' : 'orbit', cam: c, side: 'R', x, y, lx: x, ly: y, yaw: c.yaw, pitch: c.pitch, tx: c.tx, ty: c.ty };
      } else {
        // Image: the w-plane targets are drawn and edited here with the same tools
        if (targetsEditable() && !panBtn) {
          pane.setView(V.right);
          if (editDown(pane, 'R', pane.s2w(x, y), x, y)) { setCursor(pane, side); return; }
        }
        drag = { mode: 'panR', x, y, cx: V.right.cx, cy: V.right.cy };
      }
      setCursor(pane, side);
      return;
    }
    // left pane: the z-globe at stage 0 takes shapes (P3b); at a focused stage a drawing tool draws nothing there, as
    // in the plane (P4: the Whole chain button pulses); the landscape only turns
    if (lGlobe() && globeEdit('L')) { globeDown(pane, side, e, x, y); gestureProbeOff(); setCursor(pane, side); return; }
    if (lGlobe() && leftStage() > 0 && tool !== 'select' && !panBtn) pulseWhole();
    if (!lFlat()) {
      const c = camOf('L');
      if (c) { c.vyaw = 0; c.vpitch = 0; drag = { mode: panBtn || e.shiftKey ? 'pan3' : 'orbit', cam: c, side: 'L', x, y, lx: x, ly: y, yaw: c.yaw, pitch: c.pitch, tx: c.tx, ty: c.ty }; }
      setCursor(pane, side);
      return;
    }
    pane.setView(leftView());
    const z = pane.s2w(x, y);
    if (panBtn) { drag = { mode: 'panL', x, y, cx: leftView().cx, cy: leftView().cy, pane }; setCursor(pane, side); return; }
    // the zeros and poles of a zeros-and-poles step acting here: a press drags one (and selects it: Delete removes it);
    // Shift-click adds a zero, Shift-⌘ (Ctrl) click a pole, and the press goes on dragging it
    if (zpStep()) {
      // (a handle of the selected shape on the same spot wins: a disc about 0 of radius 1 under the default zeros)
      const selSh = leftStage() === 0 && tool === 'select' && selected ? S.shapes.find((s) => s.id === selected) : null;
      const onSel = !!selSh && Region.handlesOf(selSh).some(([, hz]) => { const [hx, hy] = pane.w2s(hz); return Math.abs(hx - x) < 8 && Math.abs(hy - y) < 8; });
      const zh = onSel ? null : zpHit(x, y, e.pointerType === 'touch' ? 22 : 11);
      if (zh) {
        zpSel = { k: zh.k, kind: zh.kind, i: zh.i };
        if (selected) { selected = null; buildShapeList(); requestRender('L', 'R'); }
        drag = { mode: 'zp', k: zh.k, kind: zh.kind, i: zh.i, x0: x, y0: y, x, y, moved: false, off: false };
        setCursor(pane, side); requestRender('OL');
        return;
      }
      if (e.shiftKey && !e.altKey && e.button === 0) {
        const kind = e.metaKey || e.ctrlKey ? 'poles' : 'zeros', k = zpStep().k;
        const i = zpAdd(k, kind, zpRound(pane, snapZ(pane, z)));
        if (i >= 0) { drag = { mode: 'zp', k, kind, i, x0: x, y0: y, x, y, moved: true, off: false, added: true }; setCursor(pane, side); requestRender('OL'); return; }
      }
      if (zpSel) { zpSel = null; requestRender('OL'); }
    }
    // cut handles have priority
    for (const hnd of cutHandlesL) {
      if (Math.hypot(hnd.x - x, hnd.y - y) < 12) { drag = { mode: 'cut', step: hnd.step, p: hnd.p }; return; }
    }
    // shapes are drawn in the z-plane: a drawing tool used on a step's input plane returns to it first
    // (P4: nothing jumps mid-gesture; the Whole chain button pulses once to show the way back)
    if (leftStage() > 0 && tool !== 'select') { pulseWhole(); return; }
    if (leftStage() === 0 && editDown(pane, 'L', z, x, y)) return;
    drag = { mode: 'panL', x, y, cx: leftView().cx, cy: leftView().cy, pane };
    setCursor(pane, side);
  }
  // Tools and selection on a plane's own shapes: the domain's on the left (at stage 0), the targets on the right
  // (Preimage). Returns true when the press was used (a draft, a new point, a handle or a shape to move).
  function editDown(pane, side, z, x, y) {
    const target = side === 'R';
    const list = target ? S.targets : S.shapes, win = target ? targetWin() : clipWin, ov = target ? 'OR' : 'OL';
    // polygon drafting
    if (tool === 'polygon') {
      const zz = snapZ(pane, z);
      if (!draft || !!draft.target !== target) draft = { kind: 'polygon', pts: [], target };
      if (draft.pts.length >= 3) {
        const [fx, fy] = pane.w2sxy(draft.pts[0][0], draft.pts[0][1]);
        if (Math.hypot(fx - x, fy - y) < 9) { finishPolygon(); return true; }
      }
      draft.pts.push([zz.re, zz.im]);
      requestRender(ov);
      return true;
    }
    if (tool !== 'select') {
      const zz = snapZ(pane, z);
      if (tool === 'point') { addShape(newShape('point', { p: [zz.re, zz.im] }, target), target); return true; }
      const shape = newShape(tool === 'lasso' ? 'polygon' : tool, tool === 'curve' || tool === 'lasso' ? { pts: [[zz.re, zz.im]] } : Region.defaultsFor(tool, zz, zz), target);
      draft = { kind: tool, shape, z0: zz, color: shape.color, target };
      drag = { mode: 'draw', target };
      requestRender(ov);
      return true;
    }
    // handles of the selected shape
    const sel = list.find((s) => s.id === selected);
    if (sel) {
      for (const [key, hz] of Region.handlesOf(sel)) {
        const [hx, hy] = pane.w2s(hz);
        if (Math.abs(hx - x) < 8 && Math.abs(hy - y) < 8) { drag = { mode: 'handle', shape: sel, key, target }; return true; }
      }
    }
    const tol = 7 / pane.view.s;
    // topmost first, and curves/points before filled areas
    const cands = list.filter((s) => s.visible !== false).reverse()
      .sort((a, b) => (kindType(a) === 'area') - (kindType(b) === 'area'));
    let hit = null;
    for (const s of cands) {
      try { if (Region.hitTest(s, z, tol, win)) { hit = s; break; } } catch (e) { /* a damaged formula never hits */ }
    }
    if (hit) {
      if (selected !== hit.id) { selected = hit.id; zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL'); }
      drag = { mode: 'move', shape: hit, z0: z, moved: false, target };
      requestRender(ov);
      return true;
    }
    if (selected) { selected = null; buildShapeList(); requestRender('L', 'R'); }
    return false;
  }
  // ---------------- drawing on the globes (panels.md 9, phase P3b) ----------------
  // X Sphere at stage 0 takes shapes, Y Sphere takes targets, with the same tools as the planes. Everything works from
  // the picked point P of the sphere first (Region.Globe) and needs z only to store planar parameters. Circle and Disc
  // build caps (stored as disc, complement of a disc or half-plane; circle or line); Annulus, Sector and Polar grid
  // are off on the globes (the user's decision, panels.md 9.2).
  const GL3 = Region.Globe;
  const globeEdit = (side) => (side === 'L' ? lGlobe() && leftStage() === 0 && solo() !== 'R' : rGlobe() && !morphOn() && solo() !== 'L');
  const GLOBE_OFF = new Set(['annulus', 'sector', 'pgrid']);
  // the snap net of a tool (panels.md 9.5, P8): round kinds snap to the polar net, Cartesian kinds to the lifted lattice;
  // the globe's graticule draws the net of the active tool (the polar net with Select)
  const ROUND_TOOLS = new Set(['select', 'point', 'circle', 'disc', 'formula', 'annulus', 'sector', 'pgrid']);
  const globeNet = () => (ROUND_TOOLS.has(tool) ? 'polar' : 'cart');
  let spaceHeld = false, altHeld = false;
  // per side: the last press on an editable globe turned it (a double-click then resets the camera); the last point
  // placed on a globe ({id, t})
  const gTurnPress = { L: false, R: false };
  // per side: the pointer is within 10 px of ∞ where the tool or the dragged handle cannot put a point (cursor)
  const gInf = { L: false, R: false };
  function setGInf(pane, side, v) { if (gInf[side] !== v) { gInf[side] = v; setCursor(pane, side); } }
  let lastGlobePoint = null;
  let gSnapMark = null;          // {side, P}: the snapped point of the gesture in progress (a ring, lifted)
  const rimPhi = new Map();      // shape id -> the angle of its rim handle about the cap centre (panels.md 9.4)
  // the camera of a globe pane as the last frame drew it: {pane, c, MVP, eye, R (silhouette radius, CSS px)}
  function globeCam(side) {
    const pane = side === 'L' ? paneL : paneR, c = camOf(side);
    if (!pane || !c || !GLR.camera || !(pane.w > 0 && pane.h > 0)) return null;
    const pc = GLR.camera(c, pane.w, pane.h), D = Math.hypot(...pc.eye);
    const R = D > 1 ? Math.tan(Math.asin(1 / D)) / Math.tan((c.fov || 28 * DEG) / 2) * pane.h / 2 : pane.h / 2;
    return { pane, c, MVP: pc.MVP, eye: pc.eye, R };
  }
  // a point of the sphere on screen (CSS px), or null on the far hemisphere
  function gScreen(gc, P) {
    const tv = [gc.eye[0] - P[0], gc.eye[1] - P[1], gc.eye[2] - P[2]];
    if (tv[0] * P[0] + tv[1] * P[1] + tv[2] * P[2] <= 0) return null;
    return project(gc.pane, gc.MVP, P);
  }
  // the point of the Riemann sphere under pane pixel (x, y) of a globe orbited by camera c: {P, z (null within 1e-9 of
  // N), limb}. Off the globe: null, or with clamp the globe's point nearest the ray (a drag carried past the limb).
  function pickGlobe(pane, c, x, y, clamp) {
    if (!pane || !(pane.w > 0 && pane.h > 0) || !c) return null;
    const ex = c.tx + c.dist * Math.cos(c.pitch) * Math.cos(c.yaw), ey = c.ty + c.dist * Math.cos(c.pitch) * Math.sin(c.yaw), ez = c.tz + c.dist * Math.sin(c.pitch);
    const nrm = (v) => { const l = Math.hypot(...v) || 1; return v.map((t) => t / l); };
    const f = nrm([c.tx - ex, c.ty - ey, c.tz - ez]);
    const r = nrm([f[1], -f[0], 0]);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    const th = Math.tan((c.fov || 28 * DEG) / 2), nx = (2 * x / pane.w - 1) * th * pane.w / pane.h, ny = (1 - 2 * y / pane.h) * th;
    const d = nrm([0, 1, 2].map((k) => f[k] + nx * r[k] + ny * u[k]));
    const e = [ex, ey, ez];
    const b = e[0] * d[0] + e[1] * d[1] + e[2] * d[2], cc = e[0] * e[0] + e[1] * e[1] + e[2] * e[2] - 1;
    const disc = b * b - cc;
    let P, limb = false;
    if (disc >= 0 && -b - Math.sqrt(disc) > 0) { const t = -b - Math.sqrt(disc); P = [0, 1, 2].map((k) => e[k] + t * d[k]); }
    else if (clamp) { P = [0, 1, 2].map((k) => e[k] - b * d[k]); limb = true; }
    else return null;
    P = nrm(P);
    return { P, z: GL3.finiteOf(P), limb };
  }
  // ∞ cannot hold a point or a vertex: the 10 px around N are off the plane for them (panels.md 9.7)
  function nearInf(gc, x, y) { const q = gScreen(gc, [0, 0, 1]); return !!q && Math.hypot(q[0] - x, q[1] - y) <= 10; }
  // the rim handle's angle about the cap centre: remembered per shape, else the rim point that faces the camera most
  function rimPhiOf(s, gc) {
    if (rimPhi.has(s.id)) return rimPhi.get(s.id);
    const cap = GL3.capOf(s);
    if (!cap || !gc) return 0;
    let best = 0, bd = -Infinity;
    for (let i = 0; i < 24; i++) { const t = TAU * i / 24, P = GL3.rimPoint(cap.C, cap.h, t), d = GL3.dot3(P, gc.eye) - 1; if (d > bd) { bd = d; best = t; } }
    return best;
  }
  const globeHandles = (s, gc) => { try { return GL3.globeHandlesOf(s, GL3.capFamily(s) ? rimPhiOf(s, gc) : 0); } catch (e) { return []; } };
  // the ∞ snap of a cap (panels.md 9.3, 9.5): the rim within 8 px of arc of N goes through N exactly (h = C_z). It is
  // also the precision guard that bounds r (r <~ 20 sin a at a 150 px globe), so it holds with Snap off too.
  function infSnapH(gc, Cv, h) {
    const C = GL3.norm3(Cv);
    const a = Math.acos(Math.max(-1, Math.min(1, C[2]))), al = Math.acos(Math.max(-1, Math.min(1, h)));
    return Math.abs(a - al) * (gc ? gc.R : 150) <= 8 ? C[2] : h;
  }
  // a cap's centre moved so that its rim passes N (the ∞ snap of a move: the azimuth kept, the polar angle = its
  // radius); null when the rim is not within 8 px of arc of N (or passes it already)
  function infSnapC(gc, Cv, h) {
    const C = GL3.norm3(Cv);
    if (infSnapH(gc, C, h) !== C[2] || C[2] === h) return null;
    const al = Math.acos(Math.max(-1, Math.min(1, h))), az = Math.atan2(C[1], C[0]);
    return [Math.sin(al) * Math.cos(az), Math.sin(al) * Math.sin(az), h];
  }
  // snapping on a globe (panels.md 9.5; Snap on, Alt suspends it): handles of other shapes 8 px, then the marked points
  // 0, 1, i, -1, -i (and ∞ for rims and centres) 10 px, then the net of the kind: the polar net for round kinds
  // (intersections 6 px, single lines 4 px), the lifted Cartesian lattice (the plane's own snap) for the others.
  // role: 'centre' | 'rim' | 'round' | 'cart'. Returns {P, z, snapped}
  function globeSnap(gc, side, g, role, self) {
    if (!g || !gc || !S.snap || altHeld) return g;
    const q0 = gScreen(gc, g.P);
    if (!q0) return g;
    const dist = (P) => { const q = gScreen(gc, P); return q ? Math.hypot(q[0] - q0[0], q[1] - q0[1]) : Infinity; };
    const best = (cands, rad) => { let b = null, bd = rad; for (const P of cands) { const d = dist(P); if (d <= bd) { bd = d; b = P; } } return b; };
    const out = (P) => { const Pn = GL3.norm3(P); gSnapMark = { side, P: Pn }; return { P: Pn, z: GL3.finiteOf(Pn), snapped: true }; };
    const others = [];
    for (const s of side === 'R' ? S.targets : S.shapes) {
      if (s === self || s.visible === false) continue;
      for (const [k, P] of globeHandles(s, gc)) if (k !== 'rim') others.push(P);
    }
    let P = best(others, 8);
    if (P) return out(P);
    const marks = [[0, 0, -1], GL3.lift(1, 0), GL3.lift(0, 1), GL3.lift(-1, 0), GL3.lift(0, -1)];
    if (role === 'centre' || role === 'rim') marks.push([0, 0, 1]);
    P = best(marks, 10);
    if (P) return out(P);
    const z = g.z;
    if (!z) return g;
    if (role === 'cart') {
      // the finest graph-paper tier that is clearly drawn at the pointer (snapZ's rule with the globe's local scale)
      const eps = 1e-4 * Math.max(1, CX.abs(z));
      const sx = dist(GL3.lift(z.re + eps, z.im)) / eps, sy = dist(GL3.lift(z.re, z.im + eps)) / eps, sc = Math.min(sx, sy);
      if (!(sc > 0) || !Number.isFinite(sc)) return g;
      const d0 = Math.pow(10, Math.ceil(Math.log10(8 / sc)));
      const step = [1, 5, 10, 50, 100].map((m) => d0 * m).find((st) => st * sc >= 14) || d0 * 100;
      const gx = +(Math.round(z.re / step) * step).toPrecision(12), gy = +(Math.round(z.im / step) * step).toPrecision(12);
      const Pg = GL3.lift(gx, gy);
      if (dist(Pg) < 9) { gSnapMark = { side, P: Pg }; return { P: Pg, z: C(gx, gy), snapped: true }; }
      return g;
    }
    // the polar net: meridians every 15 deg, parallels |z| = 2^k, |k| <= 3
    const r = CX.abs(z), th = Math.atan2(z.im, z.re);
    const tm = Math.round(th / (15 * DEG)) * 15 * DEG, k = Math.round(Math.log2(r));
    const pz = (rr, t) => { const x = rr * Math.cos(t), y = rr * Math.sin(t); return [Math.abs(x) < 1e-15 * rr ? 0 : x, Math.abs(y) < 1e-15 * rr ? 0 : y]; };
    const at = (rr, t) => { const [x, y] = pz(rr, t); return { P: GL3.lift(x, y), z: C(x, y) }; };
    // an intersection within 6 px first, then the nearer single line within 4 px
    const lines = [];
    let hit = null;
    if (Math.abs(k) <= 3) { const rp = Math.pow(2, k), X = at(rp, tm); if (dist(X.P) <= 6) hit = X; lines.push(at(rp, th)); }
    if (!hit) {
      if (r > 0) lines.push(at(r, tm));
      let bd = 4;
      for (const L of lines) { const dd = dist(L.P); if (dd <= bd) { bd = dd; hit = L; } }
    }
    if (!hit) return g;
    gSnapMark = { side, P: hit.P };
    return { P: hit.P, z: hit.z, snapped: true };
  }
  // the readout chip of a globe draft or edit: the set with its kind tag (panels.md 9.4: the kind change through ∞ is
  // visible as it happens), or the dimensions of other kinds
  function capSetHtml(s) {
    const f = (x) => { const t = fmtR(x, 3); return (t.includes('.') && !t.includes('×') ? t.replace(/0+$/, '').replace(/\.$/, '') : t).replace(/^−0$/, '0'); };
    const zc = (c) => { const re = c[0], im = c[1]; if (Math.hypot(re, im) < 1e-12) return '<i>z</i>'; return `|<i>z</i> − (${fmtCxHtml(C(re, im), 3)})|`; };
    const tag = (t) => ` <span class="rk">[${t}]</span>`;
    if (s.kind === 'disc' || s.kind === 'circle') {
      const rel = s.kind === 'circle' ? '=' : s.complement ? '&gt;' : '&lt;';
      const lhs = Math.hypot(s.c[0], s.c[1]) < 1e-12 ? '|<i>z</i>|' : zc(s.c);
      return `${lhs} ${rel} ${f(s.r)}${tag(s.kind === 'circle' ? 'circle' : s.complement ? 'complement of a disc' : 'disc')}`;
    }
    if (s.kind === 'halfplane' || s.kind === 'line') {
      const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l = Math.hypot(dx, dy) || 1, n = [-dy / l, dx / l], t = n[0] * s.a[0] + n[1] * s.a[1];
      const rel = s.kind === 'line' ? '=' : '&gt;', rev = s.kind === 'line' ? '=' : '&lt;';
      const kind = tag(s.kind === 'line' ? 'line' : 'half-plane');
      if (Math.abs(n[0]) < 1e-9) return `Im <i>z</i> ${n[1] > 0 ? rel : rev} ${f(t * Math.sign(n[1]))}${kind}`;
      if (Math.abs(n[1]) < 1e-9) return `Re <i>z</i> ${n[0] > 0 ? rel : rev} ${f(t * Math.sign(n[0]))}${kind}`;
      // Re(conj(n) z) with n = e^(i theta): Re(e^(-i theta) z)
      const ang = Math.atan2(n[1], n[0]) / DEG, sup = ang < 0 ? `${f(-ang)}°` : `−${f(ang)}°`;
      return `Re(<i>e</i><sup>${sup}<i>i</i></sup><i>z</i>) ${rel} ${f(t)}${kind}`;
    }
    return '';
  }
  function globeChip(side, s) {
    const el = $(side === 'L' ? 'leftReadout' : 'rightReadout');
    if (!el || el.classList.contains('copied')) return;
    let t = s ? capSetHtml(s) : '';
    if (s && !t) {
      const P = (a) => C(a[0], a[1]);
      if (s.kind === 'rect' || s.kind === 'cgrid') t = `${fmtR(Math.abs(s.b[0] - s.a[0]), 3)} × ${fmtR(Math.abs(s.b[1] - s.a[1]), 3)}`;
      else if (['segment', 'ray', 'arc'].includes(s.kind)) { const d = CX.sub(P(s.b), P(s.a)); t = `${fmtR(CX.abs(d), 3)} ∠ ${fmtR(Math.atan2(d.im, d.re) / DEG, 1)}°`; }
      else if (s.kind === 'point') t = rk('', fmtCxHtml(P(s.p)));
    }
    if (t) el.innerHTML = `<span class="rp"><span class="rv">${t}</span></span>`;
  }
  // the shape fields a globe edit may change (a kind change through ∞ drops the old kind's fields)
  const GEOM_KEYS = ['kind', 'a', 'b', 'c', 'r', 'complement', 'p', 'm', 'pts'];
  function setGeom(s, from) {
    for (const k of GEOM_KEYS) if (k !== 'kind') delete s[k];
    for (const k of GEOM_KEYS) if (from[k] !== undefined) s[k] = JSON.parse(JSON.stringify(from[k]));
  }
  // curves of shape s within tol px of (x, y) on the globe (its sphere curves, front-facing pieces)
  function globeCurveHit(gc, s, x, y, tol) {
    let curves = [];
    try { curves = Region.sphereCurvesOf(s, 160, viewBox(S.srcView)); } catch (e) { curves = []; }
    for (const c of curves) {
      const n = c.pts.length, m = c.closed ? n : n - 1;
      let qa = gScreen(gc, c.pts[0]);
      for (let i = 0; i < m; i++) {
        const qb = gScreen(gc, c.pts[(i + 1) % n]);
        if (qa && qb) {
          const dx = qb[0] - qa[0], dy = qb[1] - qa[1], L = dx * dx + dy * dy;
          const t = L > 0 ? Math.max(0, Math.min(1, ((x - qa[0]) * dx + (y - qa[1]) * dy) / L)) : 0;
          if (Math.hypot(qa[0] + t * dx - x, qa[1] + t * dy - y) <= tol) return true;
        }
        qa = qb;
      }
    }
    return false;
  }
  // a press on an editable globe: a draft, a point, a handle or a shape to move; otherwise the globe turns
  function globeDown(pane, side, e, x, y) {
    const c = camOf(side), gc = globeCam(side);
    const target = side === 'R', list = target ? S.targets : S.shapes, ov = side;
    altHeld = !!e.altKey; gSnapMark = null;
    gTurnPress[side] = false;
    const turn = () => { gTurnPress[side] = true; c.vyaw = 0; c.vpitch = 0; drag = { mode: e.button === 2 || e.shiftKey ? 'pan3' : 'orbit', cam: c, side, x, y, lx: x, ly: y, yaw: c.yaw, pitch: c.pitch, tx: c.tx, ty: c.ty }; };
    // the middle button, Space held or the right button turn (or pan) the globe in every tool (panels.md 9.5)
    const g = pickGlobe(pane, c, x, y);
    if (!gc || !g || e.button === 1 || e.button === 2 || spaceHeld || (e.shiftKey && e.altKey)) { turn(); return; }
    if (GLOBE_OFF.has(tool) || tool === 'formula') { turn(); return; }
    if (tool === 'polygon') {
      if (nearInf(gc, x, y)) return;
      const gs = globeSnap(gc, side, g, 'cart');
      if (!gs.z) return;
      if (!draft || draft.kind !== 'polygon' || draft.globe !== side) draft = { kind: 'polygon', pts: [], target, globe: side };
      if (draft.pts.length >= 3) {
        const q = gScreen(gc, GL3.lift(draft.pts[0][0], draft.pts[0][1]));
        if (q && Math.hypot(q[0] - x, q[1] - y) < 9) { finishPolygon(); return; }
      }
      draft.pts.push([gs.z.re, gs.z.im]);
      requestRender(ov, 'O' + side);
      return;
    }
    if (tool === 'point') {
      if (nearInf(gc, x, y)) return;
      const gs = globeSnap(gc, side, g, 'round');
      if (!gs.z) return;
      // the second press of a double-click places no second point on the first
      const last = list[list.length - 1], now = performance.now();
      if (lastGlobePoint && last && lastGlobePoint.id === last.id && now - lastGlobePoint.t < 600) {
        const Pl = GL3.lift(last.p[0], last.p[1]);
        if (Math.hypot(Pl[0] - gs.P[0], Pl[1] - gs.P[1], Pl[2] - gs.P[2]) < 1e-9) return;
      }
      const pt = newShape('point', { p: [gs.z.re, gs.z.im] }, target);
      addShape(pt, target);
      lastGlobePoint = { id: pt.id, t: now };
      gSnapMark = null;
      return;
    }
    if (tool === 'disc' || tool === 'circle') {
      const gs = globeSnap(gc, side, g, 'centre');
      const Cv = gs.P;
      const shape = newShape(tool, {}, target);
      GL3.applyCap(shape, Cv, Math.cos(GL3.CAP_MIN));
      draft = { kind: tool, shape, cap: true, C: Cv, color: shape.color, target, globe: side, x, y };
      drag = { mode: 'gdraw', target, side, x, y };
      requestRender(ov, 'O' + side);
      return;
    }
    if (tool !== 'select') {
      const gs = globeSnap(gc, side, g, 'cart');
      if (!gs.z) { turn(); return; }
      const zz = gs.z;
      const shape = newShape(tool === 'lasso' ? 'polygon' : tool, tool === 'curve' || tool === 'lasso' ? { pts: [[zz.re, zz.im]] } : Region.defaultsFor(tool, zz, zz), target);
      draft = { kind: tool, shape, z0: zz, color: shape.color, target, globe: side, x, y };
      drag = { mode: 'gdraw', target, side, x, y };
      requestRender(ov, 'O' + side);
      return;
    }
    // Select: handles of the selected shape (8 px), then curves and area rims (6 px), then areas (topmost first)
    const sel = list.find((s) => s.id === selected);
    if (sel) {
      for (const [key, P] of globeHandles(sel, gc)) {
        const q = gScreen(gc, P);
        if (q && Math.hypot(q[0] - x, q[1] - y) <= 8) { drag = { mode: 'ghandle', shape: sel, key, target, side, x, y }; return; }
      }
    }
    const vis = list.filter((s) => s.visible !== false).reverse();
    let hit = null;
    for (const s of vis) {
      if (kindType(s) === 'point') { const q = gScreen(gc, GL3.lift(s.p[0], s.p[1])); if (q && Math.hypot(q[0] - x, q[1] - y) <= 7) { hit = s; break; } continue; }
      if (globeCurveHit(gc, s, x, y, 6)) { hit = s; break; }
    }
    if (!hit) for (const s of vis) if (GL3.globeInside(s, g.P)) { hit = s; break; }
    if (hit) {
      if (selected !== hit.id) { selected = hit.id; zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL'); }
      drag = { mode: 'gmove', shape: hit, P0: g.P, z0: g.z, s0: JSON.parse(JSON.stringify(hit)), moved: false, target, side, x, y };
      requestRender('O' + side);
      return;
    }
    if (selected) { selected = null; buildShapeList(); requestRender('L', 'R'); }
    turn();
  }
  // a globe gesture (draw, handle, move) hides the probe: no ring or readout stays at the press point while the shape
  // moves away; the next hover after release probes again
  function gestureProbeOff() {
    if (!drag || !/^g(draw|handle|move)$/.test(drag.mode)) return;
    const had = !!probe || !!rHover;
    probe = null;
    if (rHover) { rHover = null; setHoverW(null); }
    if (had) { setReadouts(null); requestRender('L', 'OL', 'OR', rGlobe() ? 'R' : null); }
  }
  // a pointer move of a globe gesture (draw, handle, move)
  function globeMove(pane, side, e, x, y) {
    const d = drag, c = camOf(side), gc = globeCam(side);
    altHeld = !!e.altKey; gSnapMark = null;
    const g = pickGlobe(pane, c, x, y, true);
    if (!g || !gc) return;
    // a draft is in neither list until release: only its globe and the chip change (as a planar draft touches only
    // its overlay); a stored shape that changes updates the lists and both panes
    const changed = (s) => {
      if (d.mode !== 'gdraw') { if (d.target) targetsChanged(false); else shapesChanged(false); }
      globeChip(side, s);
      requestRender(side, 'O' + side);
    };
    if (d.mode === 'gdraw' && draft) {
      const s = draft.shape;
      if (draft.cap) {
        // the rim through the pointer (h = P.C), snapped, then through ∞ when N is within 8 px of arc of it
        const gs = globeSnap(gc, side, g, 'rim', s);
        const lim = Math.cos(GL3.CAP_MIN);
        let h = Math.max(-lim, Math.min(lim, GL3.dot3(gs.P, draft.C)));
        const hs = infSnapH(gc, draft.C, h);
        if (hs !== h) { h = hs; gSnapMark = { side, P: [0, 0, 1] }; }
        GL3.applyCap(s, draft.C, h);
        rimPhi.set(s.id, GL3.rimAngle(draft.C, gs.P));
        changed(s);
        return;
      }
      if (draft.kind === 'curve' || draft.kind === 'lasso') {
        if (!g.z || nearInf(gc, x, y)) return;
        const last = s.pts[s.pts.length - 1], q = gScreen(gc, GL3.lift(last[0], last[1]));
        if (!q || Math.hypot(q[0] - x, q[1] - y) >= 3) s.pts.push([g.z.re, g.z.im]);
        requestRender(side, 'O' + side);
        return;
      }
      const gs = globeSnap(gc, side, g, 'cart');
      if (!gs.z) return;
      Object.assign(s, Region.defaultsFor(draft.kind, draft.z0, gs.z));
      changed(s);
      return;
    }
    if (d.mode === 'ghandle') {
      const s = d.shape;
      if (GL3.capFamily(s) && (d.key === 'C' || d.key === 'rim')) {
        if (d.key === 'C') {
          // the centre moved with h kept; a rim that comes within 8 px of arc of N goes through N (the ∞ snap of
          // panels.md 9.3, as for a drawn rim and a slide: it bounds r)
          const gs = globeSnap(gc, side, g, 'centre', s);
          let snapInf = false;
          GL3.setGlobeHandle(s, 'C', gs.P, { infSnap: (Cn, h) => { const Cs = infSnapC(gc, Cn, h); snapInf = !!Cs; return Cs; } });
          if (snapInf) gSnapMark = { side, P: [0, 0, 1] };
        } else {
          const gs = globeSnap(gc, side, g, 'rim', s);
          const cap = GL3.capOf(s);
          if (!cap) return;
          const lim = Math.cos(GL3.CAP_MIN);
          let h = Math.max(-lim, Math.min(lim, GL3.dot3(gs.P, cap.C)));
          const hs = infSnapH(gc, cap.C, h);
          if (hs !== h) { h = hs; gSnapMark = { side, P: [0, 0, 1] }; }
          GL3.setGlobeHandle(s, 'rim', gs.P, { h });
          rimPhi.set(s.id, GL3.rimAngle(cap.C, gs.P));
        }
      } else {
        const vertex = s.kind === 'point' || /^v\d/.test(d.key);
        setGInf(pane, side, vertex && nearInf(gc, x, y));
        if (gInf[side]) return;
        const gs = globeSnap(gc, side, g, s.kind === 'point' ? 'round' : 'cart', s);
        if (!gs.z) return;
        Region.setHandle(s, d.key, gs.z);
      }
      d.moved = true;
      changed(s);
      return;
    }
    if (d.mode === 'gmove') {
      const s = d.shape;
      if (!d.moved && Math.hypot(x - d.x, y - d.y) < 3) return;
      if (s.kind === 'point' || GL3.capFamily(s)) {
        // the rotation about P0 x P1 that takes the press point to the pointer, applied to the shape as pressed (the
        // kind follows the geometry: a disc slid over ∞ becomes the complement of a disc, a line slid off ∞ a circle)
        setGInf(pane, side, s.kind === 'point' && nearInf(gc, x, y));
        if (gInf[side]) return;
        const t = JSON.parse(JSON.stringify(d.s0));
        if (!GL3.rotateShape(t, GL3.rotationTo(d.P0, g.P))) return;
        const cap = GL3.capFamily(t) ? GL3.capOf(t) : null;
        const Cs = cap ? infSnapC(gc, cap.C, cap.h) : null;
        if (Cs) { GL3.applyCap(t, Cs, Cs[2]); gSnapMark = { side, P: [0, 0, 1] }; }
        setGeom(s, t);
      } else {
        // planar kinds translate in the plane by the difference of the planar picks
        if (!g.z) return;
        if (!d.zl) d.zl = d.z0 || g.z;
        Region.translate(s, CX.sub(g.z, d.zl));
        d.zl = g.z;
      }
      d.moved = true;
      changed(s);
    }
  }
  // the end of a globe gesture: a draft becomes a shape (or a target) when it has a size on screen; an edit is one undo step
  function globeUp(pane, side, d) {
    gSnapMark = null; gInf[side] = false;
    setReadouts(null);
    if (d.mode === 'gdraw' && draft) {
      const s = draft.shape, kind = draft.kind, gc = globeCam(side);
      const cap = draft.cap ? GL3.capOf(s) : null;
      draft = null;
      let ok = true;
      if (cap) ok = Math.acos(Math.max(-1, Math.min(1, cap.h))) * (gc ? gc.R : 150) > 4;
      else if (kind === 'curve' || kind === 'lasso') {
        ok = s.pts.length >= (kind === 'lasso' ? 3 : 2);
        if (s.pts.length > 400) { const step = s.pts.length / 400; s.pts = Array.from({ length: 400 }, (_, i) => s.pts[Math.floor(i * step)]); }
      } else {
        const qs = gc ? Region.handlesOf(s).map(([, z]) => gScreen(gc, GL3.lift(z.re, z.im))).filter(Boolean) : [];
        ok = qs.length > 1 && Math.max(...qs.map((q) => Math.hypot(q[0] - qs[0][0], q[1] - qs[0][1]))) > 4;
      }
      if (ok) addShape(s, !!d.target); else { rimPhi.delete(s.id); requestRender(side, 'OL', 'OR'); }
      return;
    }
    if ((d.mode === 'ghandle' || d.mode === 'gmove') && d.moved) {
      if (d.target) targetsChanged(true);
      else { if (rightAuto && autoFit()) fitRight(true); scheduleFix(); shapesChanged(true); }
      commit();
    }
    requestRender(side, 'O' + side);
  }
  // the overlay of an editable globe: the selected shape's handles (lifted, facing hemisphere only, today's style),
  // a polygon draft's vertices, and the snap ring
  function drawGlobeEdit(side) {
    const gc = globeCam(side);
    if (!gc) return;
    const ctx = gc.pane.octx, list = side === 'R' ? S.targets : S.shapes;
    // the selected shape, and a shape being drawn here (panels.md 9.4: the draft with its handles, so a cap shows the
    // spherical centre it is built around)
    const sel = list.find((x) => x.id === selected);
    const dr = draft && draft.globe === side && draft.shape && draft.kind !== 'curve' && draft.kind !== 'lasso' ? draft.shape : null;
    ctx.save();
    for (const s of [sel, dr]) {
      if (!s) continue;
      const k = shapeInk(s).edge;
      for (const [key, P] of globeHandles(s, gc)) {
        const q = gScreen(gc, P);
        if (!q) continue;
        ctx.fillStyle = TH.surface; ctx.strokeStyle = k; ctx.lineWidth = 1.5;
        ctx.beginPath();
        if (key === 'c' || key === 'C' || key === 'm') ctx.arc(q[0], q[1], 3.5, 0, TAU); else ctx.rect(q[0] - 3.5, q[1] - 3.5, 7, 7);
        ctx.fill(); ctx.stroke();
      }
    }
    if (draft && draft.globe === side && draft.kind === 'polygon') {
      ctx.fillStyle = draft.target ? shapeInk({ ci: TARGET_CI[S.targets.length % TARGET_CI.length] }).edge : TH.c[S.shapes.length % 8].edge;
      for (const p of draft.pts) { const q = gScreen(gc, GL3.lift(p[0], p[1])); if (q) ctx.fillRect(q[0] - 3, q[1] - 3, 6, 6); }
    }
    if (gSnapMark && gSnapMark.side === side) {
      const q = gScreen(gc, gSnapMark.P);
      if (q) {
        ctx.lineWidth = 3.5; ctx.strokeStyle = TH.halo; ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, TAU); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.strokeStyle = TH.accent; ctx.beginPath(); ctx.arc(q[0], q[1], 6, 0, TAU); ctx.stroke();
      }
    }
    ctx.restore();
  }
  // a draft on a globe as GLR.drawPreimage draws it through the identity map (exact per pixel): an area at the draft
  // alpha with its rim, a curve in the shape's edge colour, an open polygon as its polyline to the pointer
  function globeDraftPass(side) {
    if (!draft || draft.globe !== side) return null;
    let s = draft.shape;
    if (draft.kind === 'polygon') {
      const pts = draft.pts.slice();
      if (draft.hover) pts.push([draft.hover.re, draft.hover.im]);
      if (pts.length < 2) return null;
      s = { kind: 'curve', pts, ci: draft.target ? TARGET_CI[S.targets.length % TARGET_CI.length] : S.shapes.length % 8 };
    }
    if (!s || kindType(s) === 'point') return null;
    const ink = shapeInk(s), area = kindType(s) === 'area';
    const t = Object.assign({}, s, { color: GLR.hexRGB(area ? ink.c0 : ink.edge), edge: GLR.hexRGB(ink.edge), alpha: area ? 0.35 : 1, width: 1.5 * (side === 'L' ? paneL : paneR).dpr });
    return { map: IDENT, targets: [t], halo: GLR.hexRGB(TH.halo) };
  }
  function onMove(pane, side, e) {
    const [x, y] = evXY(pane, e);
    if (drag && drag.mode !== 'probe') { // a touch probe (long press) moves like a hover
      if (drag.x != null && !drag.far && Math.hypot(x - drag.x, y - drag.y) > 4) drag.far = true;   // (a pan, not a click)
      if (drag.mode === 'gdraw' || drag.mode === 'ghandle' || drag.mode === 'gmove') { globeMove(pane, drag.side, e, x, y); return; }
      if (drag.mode === 'orbit') {
        const c = drag.cam || cam3();
        const dyaw = -(x - drag.lx) * 0.35 * DEG, dpitch = (y - drag.ly) * 0.35 * DEG;
        c.yaw += dyaw;
        c.pitch = Math.max(pitchMin(c), Math.min(88 * DEG, c.pitch + dpitch));
        if (!matchMedia('(prefers-reduced-motion: reduce)').matches) { c.vyaw = dyaw * 0.6; c.vpitch = dpitch * 0.6; }
        drag.lx = x; drag.ly = y;
        requestRender(drag.side === 'L' ? 'L' : 'R');
        return;
      }
      if (drag.mode === 'pan3') {
        const c = drag.cam || cam3();
        const k = c.dist / pane.h * 1.2;
        const dx = (x - drag.x) * k, dy = (y - drag.y) * k;
        c.tx = drag.tx + dx * Math.sin(c.yaw) + dy * Math.cos(c.yaw);
        c.ty = drag.ty - dx * Math.cos(c.yaw) + dy * Math.sin(c.yaw);
        requestRender(drag.side === 'L' ? 'L' : 'R');
        return;
      }
      if (drag.mode === 'panR') {
        V.right.cx = drag.cx - (x - drag.x) / V.right.s;
        V.right.cy = drag.cy + (y - drag.y) / V.right.s;
        rightAuto = false;
        requestRender('R');
        return;
      }
      if (drag.mode === 'panL') {
        const v = leftView();
        v.cx = drag.cx - (x - drag.x) / v.s;
        v.cy = drag.cy + (y - drag.y) / v.s;
        if (leftStage() > 0) leftAuto = false;
        sourceViewChanged();
        requestRender('L');
        return;
      }
      // a target (Preimage) lives in the right plane
      pane.setView(drag.target ? V.right : leftView());
      const z = pane.s2w(x, y);
      if (drag.mode === 'cut') {
        setCut(drag.step, Math.atan2(z.im - drag.p.im, z.re - drag.p.re) / DEG, S.snap);
        return;
      }
      // a zero or a pole follows the pointer (snapped like the shape handles); off the plane it waits at the edge, and
      // a release there removes it
      if (drag.mode === 'zp') {
        drag.x = x; drag.y = y;
        if (!drag.moved && Math.hypot(x - drag.x0, y - drag.y0) < 3) return;
        drag.moved = true;
        const off = x < -4 || y < -4 || x > pane.w + 4 || y > pane.h + 4;
        if (off !== drag.off) { drag.off = off; requestRender('OL'); }
        if (!off) zpSet(drag.k, drag.kind, drag.i, zpRound(pane, snapZ(pane, z)));
        else requestRender('OL');
        return;
      }
      if (drag.mode === 'handle') {
        Region.setHandle(drag.shape, drag.key, snapZ(pane, z));
        drag.moved = true;
        if (drag.target) targetsChanged(false); else shapesChanged(false);
        return;
      }
      if (drag.mode === 'move') {
        const dz = CX.sub(z, drag.z0);
        if (!drag.moved && Math.hypot(dz.re, dz.im) * pane.view.s < 3) return;
        Region.translate(drag.shape, dz);
        drag.z0 = z; drag.moved = true;
        if (drag.target) targetsChanged(false); else shapesChanged(false);
        return;
      }
      if (drag.mode === 'draw' && draft) {
        const zz = snapZ(pane, z);
        const s = draft.shape;
        if (draft.kind === 'curve' || draft.kind === 'lasso') {
          const last = s.pts[s.pts.length - 1];
          const [lx, ly] = pane.w2sxy(last[0], last[1]);
          if (Math.hypot(lx - x, ly - y) >= 3) s.pts.push([z.re, z.im]);
        } else {
          Object.assign(s, Region.defaultsFor(draft.kind, draft.z0, zz));
          if (draft.kind === 'sector') {
            const ang = Math.atan2(zz.im - draft.z0.im, zz.re - draft.z0.re) / DEG;
            s.t1 = Math.round(ang - 30); s.t2 = Math.round(ang + 30);
          }
        }
        requestRender(drag.target ? 'OR' : 'OL');
        return;
      }
    }
    // hover
    if (side === 'L' && lLand()) {
      // the landscape probes the point of X under the pointer on the relief (or its floor): the needle, the readout
      // and the image in Y follow it
      const z = pickLand(x, y);
      if (!z && !probe) return;
      probe = z;
      setReadouts(probe);
      requestRender('L', 'OR', rGlobe() ? 'R' : null);
      return;
    }
    // the Point and Polygon tools over the 10 px around ∞ of an editable globe: not-allowed (panels.md 9.7)
    if ((side === 'L' ? lGlobe() : rGlobe()) && (gInf[side] || ((tool === 'point' || tool === 'polygon') && globeEdit(side)))) {
      const gc = globeCam(side);
      setGInf(pane, side, !!gc && (tool === 'point' || tool === 'polygon') && globeEdit(side) && nearInf(gc, x, y));
    }
    // a polygon draft on a globe follows the pointer (snapped as its vertices are)
    if (draft && draft.kind === 'polygon' && draft.globe === side && is3DSide(side)) {
      const gc = globeCam(side), g = pickGlobe(pane, camOf(side), x, y);
      altHeld = !!e.altKey; gSnapMark = null;
      const gs = g && gc ? globeSnap(gc, side, g, 'cart') : null;
      draft.hover = gs && gs.z ? gs.z : null;
      requestRender(side, 'O' + side);
    }
    if (side === 'L' && lGlobe()) {
      // the z-globe probes the point of the plane under the pointer (none off the globe)
      const z = typeof pickSphereLeft === 'function' ? pickSphereLeft(x, y) : null;
      if (!z && !probe) return;
      probe = z;
      setReadouts(probe);
      requestRender('L', 'OR', rGlobe() ? 'R' : null);
      return;
    }
    if (side === 'L') {
      const hc = (cutHandlesL.find((hd) => Math.hypot(hd.x - x, hd.y - y) < 12) || {}).step || 0;
      if (hc !== hoverCut) { hoverCut = hc; setCursor(pane, side); }
      const zh = zpHit(x, y);
      if (!zpSame(zpHover, zh && zh.k, zh && zh.kind, zh && zh.i)) { zpHover = zh ? { k: zh.k, kind: zh.kind, i: zh.i } : null; setCursor(pane, side); }
      if (draft && draft.kind === 'polygon' && !draft.target) { pane.setView(leftView()); draft.hover = snapZ(pane, pane.s2w(x, y)); }
    }
    if (side === 'R' && draft && draft.kind === 'polygon' && draft.target) { pane.setView(V.right); draft.hover = snapZ(pane, pane.s2w(x, y)); }
    if (side === 'L') {
      pane.setView(leftView());
      probe = pane.s2w(x, y);
      setReadouts(probe);
      // the w-globe's probe ring and projection ray are drawn by GL with the globe
      requestRender('OL', 'OR', rGlobe() ? 'R' : null);
    } else {
      // a point w of the image plane (or of the w-globe): its preimages show in X
      let w;
      if (rImage()) { pane.setView(V.right); w = pane.s2w(x, y); } else w = pickSphere(pane, camS, x, y);
      if (probe) { probe = null; setReadouts(null); }
      rHover = w;
      const ro = $('rightReadout');
      const vout = S.focus === 0 ? '<i>w</i>' : `<i>w</i>${sub(S.focus)}`;
      if (w && ro && !ro.classList.contains('copied')) ro.innerHTML = rk(vout, fmtCxHtml(w)) + rk(`|${vout}|`, fmtR(CX.abs(w)));
      if (!w && ro && !ro.classList.contains('copied')) ro.innerHTML = idleRight();
      copyValue.R = w ? CX.fmt(w, 6).replace(/\s/g, '') : '';
      // (not while the plane shows a deformation: its points are no values of F)
      setHoverW(w && !morphOn() && !trans.k ? w : null);
      requestRender('OL', 'OR');
    }
  }
  // number formatting for readouts: 4 decimals in [1e-3, 1e4), otherwise a ×10ⁿ form; real minus signs
  // (dp: decimals, 4 by default; a narrow readout uses fewer)
  function fmtR(x, dp = 4) {
    if (!Number.isFinite(x)) return x > 0 ? '∞' : x < 0 ? '−∞' : 'NaN';
    const ax = Math.abs(x);
    let t;
    if (ax === 0 || (ax >= 1e-3 && ax < 1e4)) t = x.toFixed(dp);
    else { const [m, e] = x.toExponential(2).split('e'); t = `${m}×10${String(+e).split('').map((d) => (d === '-' ? '⁻' : SUP[+d])).join('')}`; }
    return t.replace('-', '−');
  }
  // fixed-width readout; a component that is rounding noise next to the other (9×10⁻¹⁷ + 1.5i) reads 0
  function fmtCxHtml(w, dp = 4) {
    if (!CX.isFin(w)) return '∞';
    const tol = 1e-12 * Math.max(Math.abs(w.re), Math.abs(w.im));
    const re = Math.abs(w.re) < tol ? 0 : w.re, im = Math.abs(w.im) < tol ? 0 : w.im;
    return `${fmtR(re, dp)} ${im < 0 ? '−' : '+'} ${fmtR(Math.abs(im), dp)}<i>i</i>`;
  }
  const rk = (k, v) => `<span class="rp">${k ? `<span class="rk">${k}</span> ` : ''}<span class="rv">${v}</span></span>`;
  let rHover = null; // a point hovered in the right (image) plane
  let copyValue = { L: '', R: '' };
  function setReadouts(z) {
    const lr = $('leftReadout'), ro = $('rightReadout');
    if (!lr || !ro) return;
    const lk = leftStage();
    const vin = lk === 0 ? '<i>z</i>' : `<i>w</i>${sub(lk)}`;
    if (!z) {
      if (!lr.classList.contains('copied') && !hov.w) lr.innerHTML = idleLeft();
      if (!ro.classList.contains('copied')) ro.innerHTML = idleRight();
      legendNeedle = null; legendMod = null; requestRender('G');
      return;
    }
    const degs = (a, dp) => fmtR(a / DEG, dp).replace(/0+$/, '').replace(/\.$/, '') + '°';
    copyValue.L = CX.fmt(z, 6).replace(/\s/g, '');
    // X Phase: the painted function (F, or its homotopy at t while the deformation transport is open) as modulus and
    // angle, with a swatch of its colour; the legend's needle and modulus tick follow it
    if (lPhase()) {
      const hv = homView();
      const wl = (hv ? hv.F : focusF())(z);
      const ok = CX.isFin(wl);
      const sw = ok ? `<span class="sw" style="background:${phaseCss(wl)}"></span> ` : '';
      // panels.md 2: z, |z|, arg, then F as modulus and angle with its swatch (first, so it is never cut); where the
      // chip is too narrow for that (a pane under about 560px), z and F with fewer digits
      const fv = (dp) => rk(fnHtml(), ok ? `${sw}${fmtR(CX.abs(wl), dp)} ∠ ${degs(Math.atan2(wl.im, wl.re), dp)}` : '∞');
      const forms = [
        () => rk(vin, fmtCxHtml(z)) + rk(`|${vin}|`, fmtR(CX.abs(z))) + rk('arg', degs(Math.atan2(z.im, z.re))) + fv(4),
        () => rk(vin, fmtCxHtml(z)) + fv(4),
        () => rk(vin, fmtCxHtml(z, 3)) + fv(2),
      ];
      for (let i = 0; i < forms.length; i++) {
        lr.innerHTML = forms[i]();
        if (i === forms.length - 1 || lr.scrollWidth <= lr.clientWidth + 1) break;
      }
      legendNeedle = ok ? Math.atan2(wl.im, wl.re) : null; legendMod = CX.abs(wl); requestRender('G'); // needle on the next frame
    } else lr.innerHTML = rk(vin, fmtCxHtml(z)) + rk(`|${vin}|`, fmtR(CX.abs(z))) + rk('arg', degs(Math.atan2(z.im, z.re)));
    // Y: the image of the probe (F at t = end)
    const w = focusF()(z);
    copyValue.R = CX.isFin(w) ? CX.fmt(w, 6).replace(/\s/g, '') : '';
    const vout = S.focus === 0 ? '<i>w</i>' : `<i>w</i>${sub(S.focus)}`;
    if (rImage()) {
      // F' at the current probe (never a cached value from an earlier pointer position)
      const F = focusF(), hh = 1e-6 * Math.max(1, CX.abs(z));
      const d = CX.scale(CX.sub(F(C(z.re + hh, z.im)), F(C(z.re - hh, z.im))), 1 / (2 * hh));
      const fd = CX.isFin(d) ? (CX.abs(d) < 1e-9 ? 'critical point' : `${fmtR(CX.abs(d))} ∠ ${fmtR(Math.atan2(d.im, d.re) / DEG).replace(/0+$/, '').replace(/\.$/, '')}°`) : '—';
      let clamp = '';
      if (tool === 'select' && !morphOn() && CX.isFin(d) && paneL && paneR) {
        const rimg = CX.abs(d) * (10 / paneL.view.s) * V.right.s;
        const factor = rimg > 120 ? 120 / rimg : rimg < 3 && rimg > 0 ? 3 / rimg : 1;
        if (factor !== 1) clamp = rk('gauge', '×' + CX.fmtNum(factor, 3));
      }
      ro.innerHTML = rk(vout, fmtCxHtml(w)) + rk(`${fnHtml()}′`, fd) + clamp;
    } else {
      ro.innerHTML = rk(vout, fmtCxHtml(w)) + rk(`|${vout}|`, fmtR(CX.abs(w)));
    }
  }
  // the phase colour of w as a CSS colour (the legend wheel's stops, arg 0 = red at 1)
  function phaseCss(w) {
    const a = ((Math.atan2(w.im, w.re) / DEG) % 360 + 360) % 360, f = a / 30, k = Math.floor(f) % 12, t = f - Math.floor(f);
    const c0 = WHEEL_RGB[k], c1 = WHEEL_RGB[(k + 1) % 12];
    return `rgb(${c0.map((v, j) => Math.round(255 * (v + (c1[j] - v) * t))).join(',')})`;
  }
  // idle readouts show the scale; refreshed after every render when nothing is probed (the left readout keeps the
  // preimage count while the right plane is hovered)
  function idleReadouts() {
    // (a globe gesture's chip shows the set being drawn or edited until release)
    if (probe || (drag && /^g(draw|handle|move)$/.test(drag.mode))) return;
    const lr = $('leftReadout'), ro = $('rightReadout');
    const a = idleLeft(), b = idleRight();
    if (!hov.w && !lr.classList.contains('copied') && lr.innerHTML !== a) lr.innerHTML = a;
    if (!rHover && !ro.classList.contains('copied') && ro.innerHTML !== b) ro.innerHTML = b;
  }
  function copyReadout(side) {
    const el = $(side === 'L' ? 'leftReadout' : 'rightReadout');
    const v = copyValue[side];
    if (!v) return;
    const done = () => { el.classList.add('copied'); el.innerHTML = rk('', 'Copied'); setTimeout(() => { el.classList.remove('copied'); setReadouts(probe); }, 900); };
    try { navigator.clipboard.writeText(v).then(done, done); } catch (e) { done(); }
  }
  function onUp(pane, side, e) {
    if (!drag) return;
    const d = drag;
    drag = null;
    // a left-view change made during the press re-centres the meshing window now (gesture end)
    sourceViewChanged.flush();
    setCursor(pane, side);
    // a pan or an orbit that moved: the contextmenu that may follow its right-button release opens nothing
    if (/^(pan|orbit)/.test(d.mode)) lastPan = { t: performance.now(), moved: !!d.far };
    if (d.mode === 'gdraw' || d.mode === 'ghandle' || d.mode === 'gmove') { globeUp(pane, d.side || side, d); return; }
    if (d.mode === 'probe') { probe = null; rHover = null; setHoverW(null); setReadouts(null); requestRender('OL', 'OR', is3D() ? 'R' : null); return; }
    // a target: no meshes to refine and no refit (the right plane is where it was drawn)
    if (d.target && (d.mode === 'handle' || d.mode === 'move')) { if (d.moved) { targetsChanged(true); commit(); } return; }
    if (d.mode === 'orbit' && d.side === 'L') { requestRender('L'); return; }
    // a zero or a pole: released off the plane it is removed; one undo step per gesture (an added one included)
    if (d.mode === 'zp') {
      if (d.off) { zpRemove(d.k, d.kind, d.i); return; }
      if (d.moved) {
        if (rightAuto && autoFit()) fitRight(true);
        scheduleFix();
        commit();
      }
      requestRender('L', 'R', 'T', 'OL');
      return;
    }
    if (d.mode === 'cut' || d.mode === 'handle' || d.mode === 'move') {
      if (rightAuto && autoFit()) fitRight(true);
      scheduleFix();
      requestRender('L', 'R', 'T');
    }
    if (d.mode === 'orbit') { requestRender('R'); return; }
    if (d.mode === 'cut') { commit(); return; }
    if (d.mode === 'handle' || d.mode === 'move') { if (d.moved) { shapesChanged(true); commit(); } return; }
    if (d.mode === 'draw' && draft) {
      const s = draft.shape;
      const kind = draft.kind;
      draft = null;
      let ok = true;
      if (kind === 'curve' || kind === 'lasso') {
        ok = s.pts.length >= (kind === 'lasso' ? 3 : 2);
        if (s.pts.length > 400) { const step = s.pts.length / 400; s.pts = Array.from({ length: 400 }, (_, i) => s.pts[Math.floor(i * step)]); }
      } else {
        const hs = Region.handlesOf(s).map((x) => x[1]);
        const span = Math.max(...hs.map((p) => CX.abs(CX.sub(p, hs[0]))));
        ok = span * pane.view.s > 4;
      }
      if (ok) addShape(s, !!d.target); else requestRender('OL', 'OR');
    }
  }
  function finishPolygon() {
    if (!draft || draft.kind !== 'polygon') return;
    const pts = draft.pts, target = !!draft.target;
    draft = null;
    if (pts.length >= 3) addShape(newShape('polygon', { pts }, target), target);
    else requestRender('OL', 'OR');
  }

  // ---------------- examples ----------------
  const EX = [
    { name: 'Empty canvas', tex: '', blurb: 'No shapes and no functions: start from scratch.', view: { cx: 0, cy: 0, s: 90 }, shapes: [], steps: [] },
    {
      name: 'Strip to disk', tex: 'w=\\frac{e^{z}-1}{e^{z}+1}', blurb: 'exp opens the strip |Im z| < π/2 onto a half-plane; a Möbius map folds it into the disk.', view: { cx: 0, cy: 0, s: 52 },
      shapes: [
        { kind: 'formula', expr: '|\\Im z|<\\frac{\\pi}{2}' },
        { kind: 'line', a: [0, 0.8], b: [1, 0.8] },
        { kind: 'point', p: [0, 0], label: 'z₀' },
      ],
      steps: [{ type: 'exp', params: {} }, { type: 'mobius', params: { a: '1', b: '-1', c: '1', d: '1' } }],
    },
    {
      name: 'Quarter plane squared', tex: 'w=z^{2}', blurb: 'The first quadrant opens onto the upper half-plane; angles at 0 double.', view: { cx: 0.6, cy: 0.6, s: 70 },
      shapes: [{ kind: 'sector', c: [0, 0], r: 0, t1: 0, t2: 90 }, { kind: 'pgrid', c: [0, 0], r: 2, nc: 4, nr: 16 }],
      steps: [{ type: 'pown', params: { n: 2 } }],
    },
    {
      name: 'Joukowski airfoil', tex: 'w=\\tfrac12\\left(z+\\tfrac1z\\right)', blurb: 'A circle through 1 becomes a wing with a sharp trailing edge.', view: { cx: 0, cy: 0, s: 70 },
      shapes: [
        { kind: 'disc', c: [-0.12, 0.1], r: 1.1244998888, complement: true },
        { kind: 'circle', c: [-0.12, 0.1], r: 1.1244998888 },
        { kind: 'point', p: [1, 0], label: 'trailing edge' },
      ],
      steps: [{ type: 'joukowski', params: {} }],
    },
    {
      name: 'Logarithm of an annulus', tex: 'w=\\log z', blurb: 'The annulus becomes a rectangle. Drag the red cut to move the seam.', view: { cx: 0, cy: 0, s: 70 },
      shapes: [{ kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }, { kind: 'circle', c: [0, 0], r: 1 }, { kind: 'segment', a: [0.5, 0.5], b: [1.5, 1.5] }],
      steps: [{ type: 'log', params: { cut: 180, k: 0 } }], focus: 1,
    },
    {
      name: 'Disk automorphism', tex: 'w=\\frac{z-a}{1-\\bar a z}', blurb: 'A Möbius self-map of the disk, played as a deformation.', view: { cx: 0, cy: 0, s: 110 },
      shapes: [{ kind: 'disc', c: [0, 0], r: 1 }, { kind: 'pgrid', c: [0, 0], r: 1, nc: 5, nr: 16 }],
      steps: [{ type: 'blaschke', params: { a: '0.5+0.3i', phi: 0 } }], morph: true,
    },
    {
      name: 'Sine of a half-strip', tex: 'w=\\sin z', blurb: 'The half-strip |Re z| < π/2, Im z > 0 maps onto the upper half-plane.', view: { cx: 0, cy: 1.25, s: 105 },
      shapes: [{ kind: 'formula', expr: '|\\Re z|<\\frac{\\pi}{2}, \\Im z>0' }, { kind: 'cgrid', a: [-1.5, 0], b: [1.5, 2.4], n: 6 }],
      steps: [{ type: 'sin', params: {} }],
    },
    {
      name: 'Square root and its sheets', tex: 'w=\\sqrt{z}', blurb: 'The slit plane maps onto a half-plane; change the sheet to flip it.', view: { cx: 0, cy: 0, s: 70 },
      shapes: [{ kind: 'disc', c: [0, 0], r: 2 }, { kind: 'circle', c: [0.5, 0.3], r: 0.9 }],
      steps: [{ type: 'root', params: { n: 2, cut: 180, k: 0 } }], focus: 1,
    },
    {
      name: 'Cayley, then cube', tex: 'w=\\left(\\frac{z-i}{z+i}\\right)^{3}', blurb: 'Half-plane to disk, then the disk wraps around itself three times.', view: { cx: 0, cy: 1, s: 60 },
      shapes: [{ kind: 'halfplane', a: [0, 0], b: [1, 0] }, { kind: 'cgrid', a: [-2, 0], b: [2, 2.5], n: 8 }],
      steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }, { type: 'pown', params: { n: 3 } }],
    },
    {
      name: 'A formula in LaTeX', tex: 'w=\\frac{z^2-1}{z^2+1}', blurb: 'A custom step shown as a color plot: zeros at ±1, poles at ±i.', view: { cx: 0, cy: 0, s: 80 },
      shapes: [{ kind: 'rect', a: [-1.5, -1.5], b: [1.5, 1.5] }],
      steps: [{ type: 'custom', params: { expr: '\\frac{z^2-1}{z^2+1}', cut: 180 } }], rightMode: 'color',
    },
    {
      name: 'Roots as preimages', tex: 'z^{3}-1=0', blurb: 'The target 0 in the w-plane pulls back to the three cube roots of unity; the target circle to curves around them.', view: { cx: 0, cy: 0, s: 90 },
      shapes: [{ kind: 'circle', c: [0, 0], r: 1 }],
      targets: [{ kind: 'point', p: [0, 0] }, { kind: 'circle', c: [0, 0], r: 0.6 }],
      steps: [{ type: 'custom', params: { expr: 'z^3-1', cut: 180 } }],
    },
    {
      name: 'A residue by integration', tex: '\\oint_{|z-i|=1}\\frac{dz}{z^2+1}=\\pi', blurb: 'Right-click the circle: around the pole at i the running integral misses its start by 2πi · Res = π.', view: { cx: 0, cy: 0.5, s: 80 },
      shapes: [{ kind: 'circle', c: [0, 1], r: 1 }],
      steps: [{ type: 'custom', params: { expr: '\\frac{1}{z^2+1}', cut: 180 } }], rightMode: 'color', integrate: 0,
    },
    {
      name: 'The derivative in the chain', tex: 'w=\\frac{d}{dz}\\left(z^{3}-3z\\right)', blurb: 'A d/dz step differentiates the chain so far: the critical points ±1 of z³ − 3z are the zeros of its derivative.', view: { cx: 0, cy: 0, s: 80 },
      shapes: [{ kind: 'disc', c: [0, 0], r: 1.6 }, { kind: 'pgrid', c: [0, 0], r: 1.6, nc: 4, nr: 16 }],
      targets: [{ kind: 'point', p: [0, 0] }],
      steps: [{ type: 'custom', params: { expr: 'z^3-3z', cut: 180 } }, { type: 'deriv', params: {} }], rightMode: 'color',
    },
    {
      name: 'Every sheet of the logarithm', tex: 'w=\\log z', blurb: 'Landscape with All sheets: Im log z climbs a helicoid around 0 instead of jumping at the cut.', view: { cx: 0, cy: 0, s: 60 },
      shapes: [{ kind: 'annulus', c: [0, 0], r1: 0.5, r2: 2 }],
      steps: [{ type: 'log', params: { cut: 180, k: 0 } }], rightMode: '3d', sheets: true, height: 'im',
    },
  ];
  // an example whose steps this build cannot make is left out of the menus
  const exOk = (ex) => ex.steps.every((st) => Funcs.DEFS[st.type]);
  let currentExample = -1;
  // a first visit opens a worked example, not the empty canvas listed first
  const firstExample = () => Math.max(0, EX.findIndex((e) => e.shapes.length && e.steps.length));
  function loadExample(i) {
    const ex = EX[i];
    if (!ex) return;
    currentExample = i;
    const xl = document.querySelector('#examplesBtn .exlabel');
    if (xl) xl.textContent = ex.name;
    S.shapes = []; S.steps = [];
    // an example opens as its blurb describes: the views it names (in the fields of earlier builds, rightMode and
    // leftSphere, migrated to the panes' views as a saved state is), a phase style that needs no selected curve, the
    // landscape's sheets and height as it sets them. The layout comes first (merged-views.md): the meshing window below
    // is the X pane's box, which must have its new width (a merge or a split changes it)
    const ev = Views.migrate({ rightMode: ex.rightMode || 'image', sphereMode: ex.sphereMode, leftSphere: !!ex.leftSphere, material: ex.material, spherePlane: ex.spherePlane,
      dc: ex.dc || (S.dc === 'cauchy' ? blankState().dc : S.dc) });
    S.view = ev.view;
    S.dc = ev.dc;
    S.landPlain = !!ev.landPlain;
    // (a new scene: every view starts from its own fitted plane)
    for (const k of Object.keys(viewMem)) delete viewMem[k];
    morph.open = false; morph.T = 0; morph.seg = null; morph.playing = false;
    defMem.y = null; defMem.d = null; defMem.dkey = '';
    applyLayout();
    S.srcView = Object.assign({}, ex.view);
    paneL.setView(S.srcView);
    clipWin = viewBox(S.srcView);
    dropAllGPU();
    selected = null;
    for (const sh of ex.shapes) S.shapes.push(newShape(sh.kind, JSON.parse(JSON.stringify(sh))));
    for (const st of ex.steps) S.steps.push({ type: st.type, params: Object.assign(Funcs.defaults(st.type), st.params), on: true });
    // an example brings its own w-plane targets (none unless it says so)
    S.targets = [];
    if (ex.targets) for (const t of ex.targets) S.targets.push(newShape(t.kind, JSON.parse(JSON.stringify(t)), true));
    S.sheets = !!ex.sheets;
    if (ex.height) S.height = ex.height;
    cauchyCache.key = '';
    closePalette();
    rebuild();
    buildShapeList();
    buildPipeline();
    setFocus(ex.focus || 0);
    commit();
    if (ex.morph || ev.deform) openTransport();
    // the line integral the example is about, once the planes have their size
    if (ex.integrate != null) requestAnimationFrame(() => { const s = S.shapes[ex.integrate]; if (s && paneL) { const r = paneL.ocanvas.getBoundingClientRect(); openIntegralPop(s.id, r.left + r.width * 0.62, r.top + 40); } });
  }
  // examples menu: 48x32 thumbnails rendered once with the real renderer, by swapping in a scratch state
  // Each is drawn with its own example's chain, in GLR side mode: the user's chain, its history and their programs
  // stay as they are, and a thumbnail whose chain programs are still compiling is not kept (exWait) but drawn again
  // when they land (GLR.onReady side), into the open gallery. exThumbs: example index -> data URL, for the current
  // look (pattern, opacity, theme); a change of look starts over.
  const exThumbs = new Map();
  const exWait = new Map();   // example index -> its chain structure key, compiling
  let exLook = '';
  function renderExampleThumb(i) {
    if (!GLR.ok) return exThumbs.get(i);
    const look = `${S.pattern}|${S.alpha}|${TH.plane}`;
    if (look !== exLook) { exThumbs.clear(); exLook = look; }
    if (exThumbs.has(i)) return exThumbs.get(i);
    const ex = EX[i];
    const save = { S, clipWin, selected, hoverShape };
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:fixed;left:-1000px;top:0;width:96px;height:64px';
    document.body.append(cv);
    let url = null, key = null;
    GLR.side(true);
    try {
      S = Object.assign(blankState(), {
        shapes: ex.shapes.map((sh, j) => Object.assign({ id: `ex${i}_${j}`, ci: j % 8, visible: true }, JSON.parse(JSON.stringify(sh)))),
        steps: ex.steps.map((st) => ({ type: st.type, params: Object.assign(Funcs.defaults(st.type), st.params), on: true })),
        pattern: save.S.pattern, alpha: save.S.alpha, meshN: 160, lines: false, unit: false, chev: false,
      });
      selected = null; hoverShape = null;
      clipWin = { x0: ex.view.cx - 260 / ex.view.s, x1: ex.view.cx + 260 / ex.view.s, y0: ex.view.cy - 180 / ex.view.s, y1: ex.view.cy + 180 / ex.view.s };
      rebuild();
      const pane = new Pane(cv);
      pane.resize();
      fitPane(pane, nSteps());
      pane.begin(TH.plane);
      sideDraw = true;
      try { drawScene(pane, stageMap(nSteps()), null, { thin: true, L: 2, cache: false }); } finally { sideDraw = false; }
      if (GLR.frameStatus().pending) key = GLR.chainKey; else url = cv.toDataURL();
      for (const sh of S.shapes) dropShapeGPU(sh.id);
    } catch (e) { console.error(e); } finally {
      S = save.S; clipWin = save.clipWin; selected = save.selected; hoverShape = save.hoverShape;
      GLR.side(false);
      rebuild();
      cv.remove();
    }
    if (key) exWait.set(i, key);
    else { exWait.delete(i); exThumbs.set(i, url); }
    return url;
  }
  // side compiles landed: draw the waiting thumbnails whose programs are all ready, into the gallery if it is open
  let exRetryT = 0;
  function retryExampleThumbs() {
    clearTimeout(exRetryT);
    exRetryT = setTimeout(() => {
      const imgs = document.querySelectorAll('#popHost .examples .ex-thumb');   // the gallery's images, in EX order
      for (const [i, key] of [...exWait]) {
        if (!GLR.ready(key)) continue;
        const url = renderExampleThumb(i);
        if (url && imgs[i]) imgs[i].src = url;
      }
    }, 30);
  }
  function openGallery(anchor) {
    const okey = focusKey(anchor);
    const items = EX.map((ex, i) => {
      const img = h('img', { class: 'ex-thumb', alt: '', width: 48, height: 32 });
      const b = h('button', { class: 'ex-item', role: 'menuitem', hidden: !exOk(ex) || null, 'aria-current': i === currentExample ? 'true' : null, onclick: () => { closePalette(); loadExample(i); focusBack(anchor, okey); } }, img,
        h('span', { class: 'ex-text' }, h('span', { class: 'ex-name' }, ex.name), h('span', { class: 'ex-blurb' }, ex.blurb || '')));
      return { b, img, i };
    });
    closePalette();
    const pop = h('div', { class: 'pop menu examples', role: 'menu', 'aria-label': 'Examples' }, ...items.map((x) => x.b));
    $('popHost').append(pop);
    popEl = pop;
    placePop(pop, anchor);
    items[0].b.focus();
    pop.addEventListener('keydown', (e) => {
      const its = items.map((x) => x.b).filter((b) => !b.hidden), i = its.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); its[(i + 1) % its.length].focus(); }
      if (e.key === 'ArrowUp') { e.preventDefault(); its[(i - 1 + its.length) % its.length].focus(); }
      if (e.key === 'Escape') { e.preventDefault(); closePalette(); focusBack(anchor, okey); }
    });
    armOutside(anchor);
    // fill thumbnails one per frame so the menu opens at once
    let q = 0;
    const next = () => {
      if (popEl !== pop || q >= items.length) return;
      const it = items[q++];
      if (it.b.hidden) { setTimeout(next, 0); return; }
      const url = renderExampleThumb(it.i);
      if (url) it.img.src = url;
      setTimeout(next, 0);
    };
    setTimeout(next, 30);
  }
  // theme preference is per viewer: auto follows the system
  function themePref() { try { return localStorage.getItem(lsk('cmw-theme')) || 'auto'; } catch (e) { return 'auto'; } }
  function setTheme(t) {
    try { localStorage.setItem(lsk('cmw-theme'), t); } catch (e) { /* storage unavailable */ }
    // one frame (spec 8.7): flush the new colors with transitions off, so none of the hover transitions start.
    // The class goes on <body>: the theme MutationObserver watches the class of <html>.
    const body = document.body;
    body.classList.add('no-trans');
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
    void getComputedStyle(body).color;
    body.classList.remove('no-trans');
    const b = $('themeBtn');
    const name = { auto: 'Auto', light: 'Light', dark: 'Dark' }[t];
    if (b) {
      b.setAttribute('data-tip', `Theme: ${name}`); b.setAttribute('aria-label', `Theme: ${name}`); b.removeAttribute('title');
      const tl = b.querySelector('.tlabel'); if (tl) tl.textContent = name; // the markup already reads "Theme: "
    }
  }
  function viewBox(v) {
    const w = paneL ? paneL.w : 500, hh = paneL ? paneL.h : 500;
    return { x0: v.cx - w / 2 / v.s, x1: v.cx + w / 2 / v.s, y0: v.cy - hh / 2 / v.s, y1: v.cy + hh / 2 / v.s };
  }

  // ---------------- guide ----------------
  function openGuide() {
    if (document.querySelector('.modal-bg')) return;
    const opener = document.activeElement, okey = focusKey(opener);
    const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
    const mod = mac ? '⌘' : 'Ctrl ';
    const onKey = (e) => {
      if (e.key === 'Tab') { // keep focus inside the dialog
        const f = [...m.querySelectorAll('button, [href], summary, [tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        const i = f.indexOf(document.activeElement);
        if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); }
        return;
      }
      // the dialog is modal: no app shortcut reaches the page behind it (Enter and Space still press its buttons)
      e.stopPropagation();
      if (e.key === 'Escape') { e.preventDefault(); close(); }
    };
    const close = () => { bg.remove(); document.removeEventListener('keydown', onKey, true); focusBack(opener, okey); };
    document.addEventListener('keydown', onKey, true);
    const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } });
    const m = h('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'guideTitle' });
    const k = (t) => t.split(' ').map((x) => `<span class="kbd">${x}</span>`).join(' ');
    const keys = [
      [k('V'), 'Select and move shapes'], [`${k('P')} ${k('S')} ${k('L')} ${k('R')}`, 'Point, segment, line, ray'],
      [`${k('C')} ${k('A')} ${k('F')}`, 'Circle, arc, freehand'], [`${k('D')} ${k('B')} ${k('G')} ${k('O')}`, 'Disc, rectangle, polygon, lasso'],
      [`${k('H')} ${k('N')} ${k('K')}`, 'Half-plane, annulus, sector'], [k('T'), 'Type a region formula'],
      [`${k(mod.trim() + ' K')}`, 'Command palette'], [k('+'), 'Add a function'],
      [`${k('1')} ${k('2')} ${k('3')}`, 'View: X → Y, Phase, Landscape'], [k('M'), 'Deformation on or off, in every view'], [k('P'), 'Deformation: paths on or off (in X → Y; else the Point tool)'],
      [`${k('⇧ 1')} ${k('⇧ 2')}`, 'Plane, Sphere of X (in Phase: of the portrait)'], [`${k('⇧ 3')} ${k('⇧ 4')}`, 'Plane, Sphere of Y'], [k('Z'), 'Fit both planes'],
      [`${k('[')} ${k(']')}`, 'Hide or show the side panels'], [k('?'), 'This guide'],
      [k('Delete'), 'Remove the selected shape'], [k('Esc'), 'Cancel a drawing or close a popover'],
      [k('Enter'), 'Close a polygon'], [`${k(mod.trim() + ' Z')} ${k('⇧ ' + mod.trim() + ' Z')}`, 'Undo, redo'],
    ];
    m.innerHTML = `
      <div class="modal-head"><svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true" class="mark">${(document.querySelector('header svg.mark') || { innerHTML: '' }).innerHTML}</svg><h2 id="guideTitle">Using the Workbench</h2></div>
      <p>Build a region in the <i>z</i>-plane, push it through a chain of functions <i>f</i><sub>1</sub>, <i>f</i><sub>2</sub>, …, and watch every intermediate image. The left pane is always <i>X</i>, the input of the focused step (the domain), and the right pane always <i>Y</i>, its output: the left pane shows the shapes, the right pane their images.</p>
      <h3>Regions</h3>
      <p>Draw with the tools on the left, or type a set such as <span class="chip ftag" data-tex="|z-1|<2"></span> or <span class="chip ftag" data-tex="0<\\Im z<\\pi"></span>. Formulas accept <i>and</i>, <i>or</i>, <i>not</i>, commas, chained comparisons, and <i>x</i>, <i>y</i>, <i>r</i>, <i>θ</i>. An equation is a curve: <span class="chip ftag" data-tex="\\operatorname{Re} z=0"></span> is a line, <span class="chip ftag" data-tex="|z|=1,\\ \\operatorname{Im} z>0"></span> an arc; lines, rays, segments, circles and arcs become shapes with handles, other curves such as <span class="chip ftag" data-tex="|\\sin z|=1"></span> are traced exactly. A set or curve in <i>w</i> is a target of the <i>w</i>-plane. Unbounded regions are meshed far beyond the visible window, so their whole image appears on the right; the fill fades out where the mesh ends. The pattern is drawn in <i>z</i>-coordinates and carried along by the map, so every tile can be followed.</p>
      <h3>Function chain</h3>
      <p>Add a step with ${k('+')}, the add card, or a connector's insert button; type a formula such as <span class="chip ftag" data-tex="e^{z^2}"></span> in the palette to add it directly. Click a card to focus it. <i>f</i><sup>−1</sup> replaces a step by its inverse, the jumper bypasses it, and the ⋯ menu moves, duplicates or removes it. Drag a card's header onto a connector to reorder.</p>
      <p><b>d/dz</b> is a step too: it differentiates the chain so far, so [<i>f</i><sub>1</sub>, <i>f</i><sub>2</sub>, d/dz, <i>f</i><sub>3</sub>] maps <i>z</i> to <i>f</i><sub>3</sub>((<i>f</i><sub>2</sub> ∘ <i>f</i><sub>1</sub>)′(<i>z</i>)), and two in a row give the second derivative. Every view shows it like any other step; focused, its left plane is the <i>z</i>-plane.</p>
      <h3>Branch cuts</h3>
      <p>Logarithms, roots and complex powers cut along a ray from 0. Focus the step and drag the seam's handle in the input plane; it snaps to 15° with Shift. The hatched side is the side the cut belongs to. The sheet number picks the branch.</p>
      <p><i>Zeros and poles</i> (in Polynomial &amp; custom) is the map <i>a</i>∏(<i>z</i> − ζ<sub><i>k</i></sub>)/∏(<i>z</i> − <i>p<sub>j</sub></i>). Its zeros (dots) and poles (crosses) are handles in its input plane (X for the first step, else focus the step): drag them, Shift-click to add a zero, Shift-⌘-click (Shift-Ctrl) to add a pole, and drag one off the plane or select it and press Delete to remove it. A polynomial or rational step can be rewritten this way from its <b>⋯</b> menu, and back.</p>
      <h3>Views</h3>
      <p>The switch in the middle of the top bar picks the view (${k('1')} ${k('2')} ${k('3')}). <b><i>X</i> → <i>Y</i></b> shows the two planes side by side: the shapes on the left, their images on the right, each pane with its own <b>Plane · Sphere</b> switch (${k('⇧ 1')} ${k('⇧ 2')} for the left pane, ${k('⇧ 3')} ${k('⇧ 4')} for the right). The right plane has a derivative gauge under the probe. <b>Phase</b> is one wide panel that colours each point of <i>X</i> by arg <i>F</i>, with modulus contours, on the plane or on the Riemann sphere; the shapes are outlined. <b>Landscape</b> is one wide panel that lifts |<i>F</i>| over <i>X</i> into a surface, in the phase colours or in plaster: zeros are pits, poles are peaks; for a map with a branch cut, <b>All sheets</b> draws its whole Riemann surface instead of the cut principal branch (best with height Re <i>F</i> or Im <i>F</i>). Each view keeps its own camera and plane view. <b>Sphere</b> places a pane on the Riemann sphere, with ∞ at the north pole. You draw on it as in the plane (shapes on the left, targets on the right; Annulus, Sector and Polar grid draw in Plane only): a Disc or Circle is a cap of the sphere, and one whose rim passes ∞ becomes a half-plane or a line. With Select, drag a shape to move it (over ∞ it changes kind) and empty space to turn the globe; in every tool the middle button, Space held or two fingers turn it. The <b>Phase key</b> check in the right plane's options of <i>X</i> → <i>Y</i> paints the portrait's colours under it, so a colour of the portrait reads off as a value of <i>w</i>.</p>
      <h3>Deformation</h3>
      <p><b>Deformation</b> in the top bar (${k('M')}) plays the homotopy from <i>z</i> to <i>F</i>(<i>z</i>), step by step, in every view. In <i>X</i> → <i>Y</i> the two panes merge into one plane (one globe when the right pane shows its Sphere): <i>X</i> in grey, the moving image <i>H</i><sub><i>t</i></sub>(<i>X</i>), and the paths <i>t</i> ↦ <i>H</i><sub><i>t</i></sub>(<i>z</i>) of well-spread points. In Phase and Landscape it paints <i>H</i><sub><i>t</i></sub>. Each step deforms along its natural path: <i>H</i><sub><i>t</i></sub> is analytic for every <i>t</i>, starts at the identity and ends at the map. Möbius maps move along their one-parameter groups, powers along <i>z</i><sup>1+(<i>n</i>−1)<i>t</i></sup>; exp, sin, cos, tan, the hyperbolic functions, their inverses and rational maps are zoomed into, so their zeros, poles and cuts fly in from infinity (sin(<i>tz</i>)/<i>t</i>); a polynomial switches its zeros on one by one; Joukowski closes the unit circle onto [−1, 1]. A formula that is none of these, or a constant, moves along the straight line. The transport under the panel scrubs <i>t</i> and sets the speed and, for two or more steps, the order: one after another (0 ≤ <i>t</i> ≤ <i>m</i>) or all at once (0 ≤ <i>t</i> ≤ 1, every step at the same <i>t</i>). <b>Paths</b> (${k('P')}) shows or hides the paths. Turning the deformation off splits the panes again and returns to <i>t</i> at the end. A focused step deforms that step only.</p>
      <h3>Preimages and roots</h3>
      <p>Hover a point <i>w</i> of the right pane (its plane or its sphere): the left plane marks every <i>z</i> in view with <i>F</i>(<i>z</i>) = <i>w</i>, and its readout counts them. In its plane the drawing tools also work in the right pane: what you draw there is a <i>target</i> in the <i>w</i>-plane. In every view the left plane shades every <i>z</i> with <i>F</i>(<i>z</i>) in a target area and traces the curves <i>F</i>(<i>z</i>) on a target curve; a target point <i>p</i> marks the solutions of <i>F</i>(<i>z</i>) = <i>p</i> as <i>z</i><sub>1</sub>, <i>z</i><sub>2</sub>, … with their multiplicity, and the poles of <i>F</i> (a target at 0 shows the roots). Targets are listed under the shapes and can be edited, hidden or deleted.</p>
      <h3>Inverses and derivatives</h3>
      <p><i>f</i><sup>−1</sup> on a card replaces the step by its inverse on the same branch. A step that takes some values more than once (a polynomial of degree 2 or more, for example) has no single inverse: the button says why and offers its preimages instead. The ⋯ menu's <b>Replace with derivative</b> turns a single step into its derivative <i>f</i>′ (a d/dz step differentiates the whole chain before it); both are in the palette as <b>Inverse of <i>f</i><sub><i>k</i></sub></b> and <b>Derivative of <i>f</i><sub><i>k</i></sub></b>, and both can be undone.</p>
      <h3>Integrals</h3>
      <p>Right-click a curve or a region's boundary (a long press on touch) in the left plane, its image in the right plane, or its outline on the phase portrait, and choose <b>Integrate</b>: a popover gives ∫<sub><i>γ</i></sub> <i>F</i> d<i>z</i> with a plot of the running integral from 0; region boundaries go around with the region on their left. For a closed curve it adds (1/2π<i>i</i>) ∮ <i>F</i> d<i>z</i>, the winding number of <i>F</i>∘<i>γ</i> about 0 and the zeros and poles found inside: by the argument principle the winding number is zeros minus poles. The curve is highlighted with its direction while the popover is open. The phase portrait's <b>Cauchy</b> style paints the Cauchy integral over the selected closed curve: <i>F</i> inside, 0 outside.</p>
      <h3>Guarantees</h3>
      <p>The lamps on the right are lit only when every step has the property and composition preserves it, so a lit lamp is always true. An unlit lamp means the chain does not imply it, not that it fails.</p>
      <h3>Keys</h3>
      <table class="keys">${keys.map(([a, b]) => `<tr><td>${a}</td><td>${b}</td></tr>`).join('')}</table>`;
    for (const el of m.querySelectorAll('[data-tex]')) TeX.set(el, el.dataset.tex);
    m.append(h('div', { class: 'modal-foot' }, h('button', { class: 'btn primary', onclick: close }, 'Close')));
    bg.append(m);
    document.body.append(bg);
    m.querySelector('.btn.primary').focus({ preventScroll: true });
  }

  // ---------------- left-panel display controls ----------------
  const PATTERNS = [
    ['checker', 'Checker', 'Checkerboard in z-coordinates: shows how squares are bent and scaled'],
    ['polar', 'Log-polar', 'Checkerboard in log|z| and arg z: conformal maps keep these cells square'],
    ['tiles', 'Tiles', 'Tiles with an F glyph: shows rotation, scaling and reflection'],
    ['grid', 'Grid', 'Cartesian grid lines of z carried by the map'],
    ['polargrid', 'Polar grid', 'Circles |z| = const and rays arg z = const carried by the map'],
    ['phase', 'Arg z', 'Colored by the argument of the source point z'],
    ['stretch', 'Stretch', 'Local scale factor |F′(z)|: blue shrinks, amber grows'],
    // (the count follows the pattern size: sphN() longitude cells by sphN() / 2 latitude cells, 128 at size ×1)
    ['sphere', 'Sphere checker', () => `Longitude and latitude cells of the Riemann sphere: ${sphN() * sphN() / 2} cells cover the plane and ∞`],
    ['solid', 'Solid', 'Flat fill'],
  ];
  // live swatches (spec 6.4) in the first shape color's tokens (c0, alt, edge): the accent stays for the selection
  // ring, Stretch uses the stretch tokens (no red) and Phase the OKLCH wheel of the Phase tab
  function drawPatternSwatch(cv, id) {
    const x = cv.getContext('2d');
    const W = 52, H = 40, sc = cv.width / W; // 104×80 device px for a 52×40 swatch
    x.setTransform(sc, 0, 0, sc, 0, 0);
    const ink = TH.c[0], c0 = ink.c0, c1 = ink.alt, k = ink.edge;
    const mix = (p, q, t) => { const a = GLR.hexRGB(p), b = GLR.hexRGB(q); return `rgb(${a.map((v, i) => Math.round(255 * (v + (b[i] - v) * t))).join(',')})`; };
    x.fillStyle = c1; x.fillRect(0, 0, W, H);
    if (id === 'checker') {
      const c = 8;
      x.fillStyle = c0;
      for (let i = 0; i < W / c; i++) for (let j = 0; j < H / c; j++) if ((i + j) % 2 === 0) x.fillRect(i * c, j * c, c, c);
    } else if (id === 'tiles') {
      // a 4×3 checker of c1 and mix(c1, c0, 0.35), large enough for the F (stem, top bar, middle bar; y up)
      const c = 13;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const ox = i * c, oy = j * c;
        if ((i + j) % 2 === 0) { x.fillStyle = mix(c1, c0, 0.35); x.fillRect(ox, oy, c, c); }
        x.fillStyle = k;
        const box = (u0, u1, v0, v1) => x.fillRect(ox + u0 * c, oy + (1 - v1) * c, (u1 - u0) * c, (v1 - v0) * c);
        box(0.30, 0.42, 0.18, 0.82); box(0.30, 0.72, 0.70, 0.82); box(0.30, 0.62, 0.46, 0.56);
      }
    } else if (id === 'polar' || id === 'polargrid') {
      const cx = W * 0.25, cy = H * 0.9;
      x.lineWidth = 1;
      for (let r = 2, n = 0; r < 70; r *= 1.48, n++) {
        for (let q = 0; q < 16; q++) {
          if (id === 'polar' && (n + q) % 2) continue;
          x.beginPath();
          x.arc(cx, cy, r * 1.48, -q * Math.PI / 8, -(q + 1) * Math.PI / 8, true);
          x.arc(cx, cy, r, -(q + 1) * Math.PI / 8, -q * Math.PI / 8, false);
          x.closePath();
          if (id === 'polar') { x.fillStyle = c0; x.fill(); }
        }
        if (id === 'polargrid') { x.strokeStyle = c0; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.stroke(); }
      }
      if (id === 'polargrid') {
        x.strokeStyle = k;
        for (let q = 0; q < 24; q++) {
          const a = q * 15 * DEG, axis = q % 6 === 0;
          x.globalAlpha = axis ? 1 : 0.7; x.lineWidth = axis ? 1.75 : 1;
          x.beginPath(); x.moveTo(cx, cy); x.lineTo(cx + 80 * Math.cos(a), cy - 80 * Math.sin(a)); x.stroke();
        }
        x.globalAlpha = 1;
      }
    } else if (id === 'grid') {
      // Re lines 1.25px k, Im lines 1px c0, every 5th +0.5px
      for (let i = 0, n = 0; i <= W; i += 8, n++) { x.strokeStyle = k; x.lineWidth = n % 5 ? 1.25 : 1.75; x.beginPath(); x.moveTo(i + 2, 0); x.lineTo(i + 2, H); x.stroke(); }
      for (let j = 0, n = 0; j <= H; j += 8, n++) { x.strokeStyle = c0; x.lineWidth = n % 5 ? 1 : 1.5; x.beginPath(); x.moveTo(0, j + 4); x.lineTo(W, j + 4); x.stroke(); }
    } else if (id === 'phase') {
      // wheel(arg s, L) with L = 0.62 + 0.14·saw(ln|s| / (π/6)), as the shader does
      x.setTransform(1, 0, 0, 1, 0, 0);
      const PW = cv.width, PH = cv.height, img = x.createImageData(PW, PH), u = 14 * sc; // 14 CSS px per unit
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
        const re = (i + 0.5 - PW / 2) / u, im = (PH / 2 - j - 0.5) / u;
        const lr = Math.log(Math.hypot(re, im) || 1e-9) / (Math.PI / 6);
        const rgb = GLR.phaseRGB(Math.atan2(im, re), 0.62 + 0.14 * (lr - Math.floor(lr)));
        const o = 4 * (j * PW + i); img.data[o] = rgb[0] * 255; img.data[o + 1] = rgb[1] * 255; img.data[o + 2] = rgb[2] * 255; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    } else if (id === 'sphere') {
      // the spherical checker about 0 (SPEC 6.3): 16 longitude sectors, latitude rings at |z| = tan(j pi / 16)
      x.setTransform(1, 0, 0, 1, 0, 0);
      const PW = cv.width, PH = cv.height, img = x.createImageData(PW, PH), u = 15 * sc, a = GLR.hexRGB(c0), b = GLR.hexRGB(c1);
      for (let j = 0; j < PH; j++) for (let i = 0; i < PW; i++) {
        const re = (i + 0.5 - PW / 2) / u, im = (PH / 2 - j - 0.5) / u;
        const th = Math.atan2(im, re), lat = 2 * Math.atan(Math.hypot(re, im));
        const par = (Math.floor(th * 16 / TAU) + Math.floor(lat * 8 / Math.PI)) & 1, c = par ? b : a;
        const o = 4 * (j * PW + i); img.data[o] = c[0] * 255; img.data[o + 1] = c[1] * 255; img.data[o + 2] = c[2] * 255; img.data[o + 3] = 255;
      }
      x.putImageData(img, 0, 0);
    } else if (id === 'stretch') {
      const g = x.createLinearGradient(0, 0, W, 0);
      g.addColorStop(0, TH.stretchShrink); g.addColorStop(0.5, TH.stretchMid); g.addColorStop(1, TH.stretchGrow);
      x.fillStyle = g; x.fillRect(0, 0, W, H);
    } else {
      x.fillStyle = c0; x.fillRect(0, 0, W, H);
    }
  }
  function buildDisplay() {
    const pat = $('patternSeg');
    pat.innerHTML = '';
    for (const [v, l, tip] of PATTERNS) {
      const cv = h('canvas', { width: 104, height: 80, 'aria-hidden': 'true' });
      const b = h('button', { class: 'pat' + (S.pattern === v ? ' on' : ''), role: 'radio', 'aria-checked': String(S.pattern === v), 'data-tip': typeof tip === 'function' ? tip() : tip, 'aria-label': l,
        onclick: () => { S.pattern = v; buildDisplay(); requestRender('L', 'R', 'T'); save(); } }, cv, h('span', null, l));
      pat.append(b);
      drawPatternSwatch(cv, v);
    }
    const ps = Math.round(Math.log2(S.patternScale || 1));
    $('patScale').value = ps;
    $('patScaleVal').textContent = ps === 0 ? '×1' : ps > 0 ? `×${2 ** ps}` : `×1/${2 ** -ps}`;
    $('meshRange').min = 0; $('meshRange').max = 1000; $('meshRange').step = 1;
    $('meshRange').value = meshToPos(S.meshN);
    showMeshVal(S.meshN);
    $('linesChk').checked = !!S.lines;
    $('chevChk').checked = !!S.chev;
    $('unitChk').checked = S.unit !== false;
    $('alphaRange').value = S.alpha;
    $('alphaVal').textContent = S.alpha.toFixed(2);
    for (const r of document.querySelectorAll('input[type=range]')) paintFader(r);
  }
  // filled part of a fader track (CSS reads --fill)
  function paintFader(r) {
    const lo = +r.min || 0, hi = r.max === '' ? 100 : +r.max, v = +r.value;
    r.style.setProperty('--fill', `${((v - lo) / (hi - lo || 1)) * 100}%`);
  }

  // below 1280 px the guarantees panel is an overlay drawer, below 1024 px the tools panel too
  const isDrawer = (side) => (side === 'R' ? window.innerWidth < 1280 : window.innerWidth < 1024) && window.innerWidth >= 768;
  function setPanels(hideL, hideR) {
    // only one drawer at a time when both panels are drawers
    if (isDrawer('L') && isDrawer('R')) {
      if (!hideL && S.hideLeft) hideR = true;
      else if (!hideR && S.hideRight) hideL = true;
    }
    S.hideLeft = !!hideL; S.hideRight = !!hideR;
    // only a choice made where the panel docks is the user's preference; drawers are run-time state
    if (!isDrawer('L')) dockPref.L = S.hideLeft;
    if (!isDrawer('R')) dockPref.R = S.hideRight;
    applyLayout();
    save();
  }
  function closeDrawers() {
    const l = isDrawer('L') && !S.hideLeft, r = isDrawer('R') && !S.hideRight;
    if (l || r) { setPanels(S.hideLeft || l, S.hideRight || r); return true; }
    return false;
  }
  function setSolo(which) {
    if (Views.merged(S.view, morphOn())) return; // a merged view is one panel: nothing to expand
    S.solo = S.solo === which ? null : which;
    applyLayout();
    save();
  }
  function applyLayout() {
    const lay = document.querySelector('.layout');
    lay.classList.toggle('hide-left', !!S.hideLeft);
    lay.classList.toggle('hide-right', !!S.hideRight);
    $('toggleLeft').setAttribute('aria-pressed', String(!S.hideLeft));
    $('toggleRight').setAttribute('aria-pressed', String(!S.hideRight));
    $('pipeline').classList.toggle('compact', !!S.compact);
    setSeg($('chainMode'), S.compact ? 'compact' : 'cards');
    const panes = document.querySelector('.panes');
    // merged views (merged-views.md): one wide panel, the other pane hidden (on a phone too) and no expand button,
    // so it reads as a view of its own, not an expanded pane
    const one = solo(), mg = Views.merged(S.view, morphOn());
    panes.classList.toggle('solo-L', one === 'L');
    panes.classList.toggle('solo-R', one === 'R');
    panes.classList.toggle('merged-L', mg === 'L');
    panes.classList.toggle('merged-R', mg === 'R');
    for (const [id, w] of [['leftSolo', 'L'], ['rightSolo', 'R']]) {
      const b = $(id);
      b.hidden = !!mg;
      b.setAttribute('aria-pressed', String(S.solo === w));
      b.setAttribute('data-tip', S.solo === w ? 'Show both planes' : 'Expand plane'); b.removeAttribute('title');
      b.innerHTML = S.solo === w ? ICONS.restore : ICONS.expand;
    }
    if (mg !== layoutMg || one !== layoutOne) { layoutMg = mg; layoutOne = one; if (paneL && paneR) onPaneResize(); requestRender('L', 'R', 'OL', 'OR'); }
  }
  let layoutMg = null, layoutOne = null;
  // the panes' canvases follow their boxes (the ResizeObserver, and a layout change at once: a merge or a split
  // must not leave a frame, a fit or a mesh to be made at the old width)
  function onPaneResize() {
    const a = paneL.resize(), b = paneR.resize();
    $('paneR').classList.toggle('narrow', $('paneR').getBoundingClientRect().width < 520);
    $('paneL').classList.toggle('narrow', $('paneL').getBoundingClientRect().width < 520);
    syncViewControls();
    fitRightTitle();
    if (a && leftStage() > 0 && leftAuto && solo() !== 'R') { paneL.setView(V.left); fitPane(paneL, leftStage()); }
    if (a || b) {
      // (a merged view widens one pane: its options strip re-flows at the new width; a hidden pane is not fitted)
      layoutFoot();
      sourceViewChanged();
      if (rightAuto && rImage() && solo() !== 'L') fitRight();
      requestRender('L', 'R', 'T');
    }
  }

  // the mesh fader is piecewise logarithmic so each named stop sits on its tick
  // Draft, Normal, Fine, Ultra, Max
  const MESH_STOPS = [160, 240, 480, 960, 1920];
  function posToMesh(p) {
    const seg = Math.max(0, Math.min(3, Math.floor(p / 250))), t = (p - seg * 250) / 250;
    const a = MESH_STOPS[seg], b = MESH_STOPS[seg + 1];
    return Math.round(Math.exp(Math.log(a) + (Math.log(b) - Math.log(a)) * t) / 10) * 10;
  }
  function meshToPos(n) {
    n = Math.max(MESH_STOPS[0], Math.min(MESH_STOPS[4], n));
    for (let i = 0; i < 4; i++) { const a = MESH_STOPS[i], b = MESH_STOPS[i + 1]; if (n <= b) return Math.round(i * 250 + 250 * Math.log(n / a) / Math.log(b / a)); }
    return 1000;
  }
  function showMeshVal(n) {
    $('meshVal').textContent = `${n}`;
    for (const b of document.querySelectorAll('#meshPresets button')) b.classList.toggle('on', +b.dataset.n === n);
    $('meshNote').hidden = n < 480;
    paintFader($('meshRange'));
  }
  function setMesh(n) {
    n = Math.max(MESH_MIN, Math.min(MESH_MAX, Math.round(n)));
    if (n === S.meshN) return;
    S.meshN = n;
    dropAllGPU();
    $('meshRange').value = meshToPos(n);
    showMeshVal(n);
    if (rightAuto && rImage()) fitRight();
    requestRender('L', 'R', 'T');
    save();
  }

  // the views (merged-views.md): the top bar's switch X → Y · Phase · Landscape (keys 1-3 by e.code), the panes'
  // Plane | Sphere switches in their heads (Shift 1, 2: the left or only panel, X or the portrait; Shift 3, 4: Y),
  // and the Deformation toggle (M), which modifies the active view. The preimages and the integrals are parts of every
  // view.
  const SURF = {
    L: [['plane', 'Plane', '⇧1'], ['sphere', 'Sphere', '⇧2']],
    R: [['plane', 'Plane', '⇧3'], ['sphere', 'Sphere', '⇧4']],
  };
  const MAINS = [['xy', 'X → Y', '1', '<i>X</i><span class="arr"> → </span><i>Y</i>'], ['phase', 'Phase', '2', 'Phase'], ['land', 'Landscape', '3', 'Landscape']];
  const VIEW_ICONS = { plane: MODE_ICONS.image, sphere: MODE_ICONS.sphere, land: MODE_ICONS['3d'], phase: MODE_ICONS.color, xy: MODE_ICONS.xy };
  // the globes' static programs, started in the background when a switch to Sphere is coming (the pointer or focus on
  // a Sphere control, the switch itself a frame ahead of its draw), so the first globe frame does not link them one
  // after another (GLR.prestart; P3 review: 51-55 ms long tasks on the first switch to X Sphere). Not at start-up:
  // compiles there compete with the first scene's own (example settle times)
  function prestartGlobe() { try { if (GLR.ok && GLR.prestart) GLR.prestart(['sphere', 'regionSC', 'lineSC', 'disc', 'mark']); } catch (e) { /* the frame links them */ } }
  // side 'L': X's surface in the active view (X → Y's left pane or the phase panel); 'R': Y's (X → Y)
  function setView(side, surf) {
    if (side === 'L' && lLand()) return;
    const v = side === 'L' ? xView() : S.view.R;
    if (!v || v.surf === surf || !(side === 'L' ? Views.SURF_L : Views.SURF_R).includes(surf)) return;
    if (surf === 'sphere') prestartGlobe();
    v.surf = surf;
    viewChanged(side);
  }
  // Each view keeps its own plane view and cameras (merged-views.md): X → Y and Phase both show X's plane and globe,
  // so the plane view (S.srcView, and V.left at a focused stage) and the z-globe's camera are swapped on a switch; the
  // landscape (cam) and the w-globe (camS) belong to one view each already. A view seen for the first time starts from
  // the one it was switched from.
  const viewMem = {};
  const camKeys = (c) => ({ yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx || 0, ty: c.ty || 0, tz: c.tz || 0, fov: c.fov });
  function setMain(main) {
    if (!Views.MAIN.includes(main) || S.view.main === main) return;
    const from = S.view.main;
    if (main !== 'land' && (main === 'phase' ? S.view.P.surf : S.view.L.surf) === 'sphere') prestartGlobe();
    cancelTweens();
    viewMem[from] = { src: Object.assign({}, S.srcView), left: Object.assign({}, V.left), leftAuto, camL: camKeys(camL) };
    S.view.main = main;
    const m = viewMem[main];
    if (m) {
      Object.assign(S.srcView, m.src); Object.assign(V.left, m.left); leftAuto = m.leftAuto;
      Object.assign(camL, m.camL, { vyaw: 0, vpitch: 0 });
    }
    // a shape draft and the probe end with the view they were made in; targets are edited in Y (X → Y only)
    draft = null; probe = null; hoverCut = 0; setReadouts(null);
    rHover = null; setHoverW(null);
    applyLayout();
    buildShapeList();
    updateFocusUI(); scheduleFix(); requestRender('L', 'R', 'OL', 'OR'); save();
  }
  // U-b's Phase toggle, kept for the test hooks: on, the Phase view on X's surface; off, X → Y on the phase panel's
  function setPhase(on) {
    if (!!on === (S.view.main === 'phase')) return;
    if (on) { if (S.view.main === 'xy') S.view.P.surf = S.view.L.surf; setMain('phase'); }
    else { S.view.L.surf = S.view.P.surf; setMain('xy'); }
  }
  function viewChanged(side) {
    if (side === 'R') {
      // targets are drawn and edited in Y Plane; a target draft and a target selection end with it (the transport
      // stays open)
      // targets are drawn in Y Plane and on the w-globe (P3b): a target draft ends with the view it was drawn in
      if (draft && draft.target) draft = null;
      rHover = null; setHoverW(null);
      if (autoFit()) { rightAuto = true; fitRight(); }
      buildShapeList();
    } else {
      // a shape draft ends with the view it was drawn in (the plane or the z-globe); the flat probe goes
      draft = draft && draft.target ? draft : null;
      if (!lFlat()) { probe = null; hoverCut = 0; setReadouts(null); }
    }
    updateFocusUI(); scheduleFix(); requestRender('L', 'R'); save();
  }
  // the head controls show the state
  function syncViewControls() {
    const main = S.view.main;
    setSeg($('viewSwitch'), main);
    setSeg($('leftTabs'), xView().surf);
    setSeg($('rightTabs'), S.view.R.surf);
    // the landscape is its own surface: no Plane | Sphere in its head
    const lt = $('leftTabs'); if (lt && lt.parentElement.hidden !== lLand()) lt.parentElement.hidden = lLand();
    if (lt) { const al = main === 'phase' ? 'Phase portrait surface' : 'Left pane surface'; if (lt.getAttribute('aria-label') !== al) lt.setAttribute('aria-label', al); }
    // X's switch (X → Y's left pane, the phase panel) takes Shift 1, 2; Y's takes Shift 3, 4
    for (const b of lt ? lt.children : []) { const k = b.dataset.mode === 'plane' ? '⇧1' : '⇧2'; const tip = `${b.getAttribute('aria-label')}${k ? '  ' + k : ''}`; if (b.dataset.tip !== tip) b.dataset.tip = tip; }
    // the view names the map in focus (P13)
    const vs = $('viewSwitch');
    if (vs) for (const b of vs.children) {
      const F = fnText(), tip = { xy: `X → Y: the shapes and their images  1`, phase: `Phase portrait of ${F}  2`, land: `Landscape of ${F}  3` }[b.dataset.mode];
      if (b.dataset.tip !== tip) b.dataset.tip = tip;
    }
    // the Deformation toggle: pressed while the transport is open; with no active step it explains instead of acting
    const mb = $('morphBtn');
    if (mb) {
      const can = morphRange().steps.length > 0;
      mb.setAttribute('aria-pressed', String(!!morph.open));
      mb.setAttribute('aria-disabled', String(!can && !morph.open));
      const tip = !can && !morph.open ? (S.focus > 0 ? 'This step is off: turn it on to deform' : 'Add a function to deform') : morph.open ? 'Close the deformation  M' : `Deformation of ${S.focus > 0 ? fnText() : 'F'}  M`;
      if (mb.dataset.tip !== tip) mb.dataset.tip = tip;
    }
  }
  // Snap (the Draw heading and the rail) and Unit circle (Display) show the state (P3)
  function syncSnapUnit() {
    for (const id of ['snapBtn', 'railSnap']) { const b = $(id); if (b) b.setAttribute('aria-pressed', String(!!S.snap)); }
    const u = $('unitChk');
    if (u && u.checked !== !!S.unit) u.checked = !!S.unit;
  }
  // P4: a drawing tool pressed in X at focus k >= 2 draws nothing; the Whole chain button pulses once
  function pulseWhole() {
    const b = $('viewAllBtn');
    if (!b) return;
    b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
    clearTimeout(pulseWhole.t); pulseWhole.t = setTimeout(() => b.classList.remove('pulse'), 900);
  }
  // resizable gutters between the planes and above the chain (sizes are per viewer)
  function setupGutters() {
    const stage = $('stage'), panes = $('panes');
    const store = (k, v) => { try { localStorage.setItem(lsk(k), String(v)); } catch (e) { /* ignore */ } };
    const read = (k) => { try { return localStorage.getItem(lsk(k)); } catch (e) { return null; } };
    const ch = +read('cmw-chain-h'); if (ch) document.documentElement.style.setProperty('--chain-h', ch + 'px');
    const sp = +read('cmw-split'); if (sp) panes.style.setProperty('--split', String(sp));
    const drag1 = (el, onMove, onEnd) => el.addEventListener('pointerdown', (e) => {
      e.preventDefault(); el.setPointerCapture(e.pointerId); el.classList.add('active');
      const mv = (ev) => onMove(ev);
      const up = () => { el.removeEventListener('pointermove', mv); el.removeEventListener('pointerup', up); el.classList.remove('active'); onEnd && onEnd(); };
      el.addEventListener('pointermove', mv); el.addEventListener('pointerup', up);
    });
    const row = $('gutterRow');
    if (row) drag1(row, (e) => {
      const r = stage.getBoundingClientRect();
      let hgt = r.bottom - e.clientY - 4;
      hgt = Math.max(112, Math.min(r.height * 0.5, hgt));
      for (const snapTo of [112, 272]) if (Math.abs(hgt - snapTo) < 12) hgt = snapTo;
      document.documentElement.style.setProperty('--chain-h', Math.round(hgt) + 'px');
      S.compact = hgt < 160; $('pipeline').classList.toggle('compact', S.compact); setSeg($('chainMode'), S.compact ? 'compact' : 'cards');
    }, () => store('cmw-chain-h', parseInt(getComputedStyle(stage).getPropertyValue('--chain-h')) || 272));
    const col = $('gutterCol');
    if (col) {
      drag1(col, (e) => {
        const r = panes.getBoundingClientRect();
        const f = Math.max(0.2, Math.min(0.8, (e.clientX - r.left) / r.width));
        panes.style.setProperty('--split', f.toFixed(4));
      }, () => store('cmw-split', panes.style.getPropertyValue('--split') || 0.5));
      col.addEventListener('dblclick', () => { panes.style.setProperty('--split', '0.5'); store('cmw-split', 0.5); });
    }
  }
  // tooltips: elements with data-tip (or title) show a styled tip after a short delay
  function setupTooltips() {
    const tip = $('tip');
    if (!tip) return;
    let timer = 0, cur = null, lastHide = 0;
    const show = (el) => {
      const text = el.getAttribute('data-tip');
      if (!text) return;
      const [label, key] = text.split(/\s{2,}/);
      tip.innerHTML = '';
      tip.append(document.createTextNode(label));
      if (key) tip.append(h('span', { class: 'tip-key' }, key));
      // a tool's description: the tooltip's second line (items 3 and 6 moved the descriptions here)
      const desc = el.getAttribute('data-desc');
      if (desc) tip.append(h('span', { class: 'tip-desc' }, desc));
      tip.hidden = false;
      const r = el.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
      let y = r.top - th - 6; if (y < 6) y = r.bottom + 6;
      tip.style.left = Math.max(6, Math.min(window.innerWidth - tw - 6, r.left + r.width / 2 - tw / 2)) + 'px';
      tip.style.top = y + 'px';
    };
    const hide = () => { clearTimeout(timer); if (!tip.hidden) lastHide = performance.now(); tip.hidden = true; cur = null; };
    document.addEventListener('pointerover', (e) => {
      if (e.pointerType === 'touch') return;
      let el = e.target.closest && e.target.closest('[data-tip],[title]');
      if (!el || el === cur) return;
      if (el.hasAttribute('title') && !el.hasAttribute('data-tip')) { el.setAttribute('data-tip', el.getAttribute('title')); el.removeAttribute('title'); }
      hide();
      cur = el;
      timer = setTimeout(() => show(el), performance.now() - lastHide < 300 ? 0 : 450);
    });
    document.addEventListener('pointerout', (e) => { if (cur && !lpShown && (!e.relatedTarget || !cur.contains(e.relatedTarget))) hide(); });
    document.addEventListener('pointerdown', hide, true);
    document.addEventListener('keydown', hide, true);
    // keyboard focus shows the same tip (only for focus the user can see: :focus-visible)
    document.addEventListener('focusin', (e) => {
      const el = e.target;
      if (!(el instanceof Element) || !(el.hasAttribute('data-tip') || el.hasAttribute('title')) || !el.matches(':focus-visible')) return;
      if (el.hasAttribute('title') && !el.hasAttribute('data-tip')) { el.setAttribute('data-tip', el.getAttribute('title')); el.removeAttribute('title'); }
      hide();
      cur = el;
      timer = setTimeout(() => { if (document.activeElement === el) show(el); }, 450);
    });
    document.addEventListener('focusout', (e) => { if (cur && cur === e.target) hide(); });
    // touch (P5): tooltips are skipped above, so a 450 ms long-press on a tool, a pattern swatch or a view button
    // shows the same tip; moving the finger cancels it, and the release after a tip does not also press the button
    const LP_SEL = '.tool[data-tip], .pat[data-tip], #viewSwitch [data-tip], #leftTabs [data-tip], #rightTabs [data-tip], .phbtn[data-tip]';
    let lp = null, lpShown = null;
    const lpCancel = () => { if (lp) { clearTimeout(lp.t); lp = null; } };
    document.addEventListener('pointerdown', (e) => {
      lpCancel();
      if (lpShown) { lpShown = null; hide(); }
      if (e.pointerType !== 'touch') return;
      const el = e.target.closest && e.target.closest(LP_SEL);
      if (!el) return;
      lp = { el, x: e.clientX, y: e.clientY, id: e.pointerId, t: setTimeout(() => { lp = null; cur = el; lpShown = el; show(el); }, 450) };
    });
    document.addEventListener('pointermove', (e) => { if (lp && e.pointerId === lp.id && Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > 8) lpCancel(); }, { passive: true });
    document.addEventListener('pointercancel', lpCancel);
    document.addEventListener('pointerup', () => {
      lpCancel();
      if (!lpShown) return;
      // the tip stays up for a moment after the finger lifts; the click that follows the release is swallowed
      const el = lpShown;
      const swallow = (ev) => { if (el.contains(ev.target)) { ev.preventDefault(); ev.stopPropagation(); } };
      document.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => document.removeEventListener('click', swallow, { capture: true }), 400);
      setTimeout(() => { if (lpShown === el) { lpShown = null; hide(); } }, 1500);
    });
    // the long-press must not open the system's context menu over the tip
    document.addEventListener('contextmenu', (e) => { if (lpShown || (lp && e.target.closest && e.target.closest(LP_SEL))) e.preventDefault(); });
  }
  // ---------------- keyboard focus across rebuilds ----------------
  // Lists, cards and segmented controls are rebuilt from the state. A control is known by its id, or by the
  // row/card keys above it (data-k, data-id, ...) plus its class and label, so its rebuilt twin can take the focus.
  const FK_ATTRS = ['data-k', 'data-id', 'data-mode', 'data-v', 'data-tool', 'data-conn', 'data-n'];
  const FK_STATE = new Set(['on', 'sel', 'focus', 'off', 'bad', 'active', 'dragging', 'drop', 'hidden-shape', 'copied', 'scrub', 'scrubbing']);
  function focusKey(el) {
    if (!(el instanceof Element) || el === document.body) return null;
    if (el.id) return { id: el.id };
    const path = [];
    let n = el, root = null;
    while (n && n !== document.body) {
      if (n !== el && n.id) { root = n.id; break; }
      const a = FK_ATTRS.filter((k) => n.hasAttribute(k)).map((k) => `${k}=${n.getAttribute(k)}`).join(',');
      if (a) path.push(a);
      n = n.parentElement;
    }
    if (!root) return null;
    const g = el.getAttribute('role') === 'radio' && el.closest('[role="radiogroup"]');
    return { root, path: path.join('|'), tag: el.tagName, cls: [...el.classList].filter((c) => !FK_STATE.has(c)).sort().join('.'), label: el.getAttribute('aria-label') || '', group: g ? g.getAttribute('aria-label') || '' : null };
  }
  function findByKey(key) {
    if (!key) return null;
    if (key.id) return $(key.id);
    const root = $(key.root);
    if (!root) return null;
    if (key.group != null) {
      // a radio hands the focus to the checked radio of its group
      const g = [root, ...root.querySelectorAll('[role="radiogroup"]')].find((x) => x.getAttribute('role') === 'radiogroup' && (x.getAttribute('aria-label') || '') === key.group);
      const on = g && g.querySelector('[role="radio"][aria-checked="true"]');
      if (on) return on;
    }
    let same = null, other = null;
    for (const el of root.getElementsByTagName(key.tag)) {
      const k = focusKey(el);
      if (!k || k.root !== key.root || k.cls !== key.cls) continue;
      if (k.path === key.path) { if (k.label === key.label) return el; same = same || el; } else other = other || el;
    }
    return same || other; // same row with a changed label (Hide → Show), else the same control in another row
  }
  // after a menu, palette or dialog closes: back to its opener, the opener's rebuilt twin, or the phone's ⋯ button
  // when the opener sat in that (now closed) menu
  function focusBack(anchor, key) {
    const a = document.activeElement;
    if (a && a !== document.body) return;
    const vis = (el) => (el && el !== document.body && el.isConnected && el.getClientRects().length ? el : null);
    const t = vis(anchor) || vis(findByKey(key)) || (anchor && anchor.closest && anchor.closest('#hdrMenu') ? vis($('hdrMoreBtn')) : null);
    if (t) t.focus({ preventScroll: true });
  }
  // radiogroups are one Tab stop: only the checked radio is tabbable
  function roveRadios() {
    for (const g of document.querySelectorAll('[role="radiogroup"]')) {
      const rs = [...g.querySelectorAll('[role="radio"]')];
      if (!rs.length) continue;
      const on = rs.find((r) => r.getAttribute('aria-checked') === 'true') || rs[0];
      for (const r of rs) { const t = r === on ? 0 : -1; if (r.tabIndex !== t) r.tabIndex = t; }
    }
  }
  let lastFocus = null;
  function setupFocusKeeper() {
    document.addEventListener('focusin', (e) => { lastFocus = { el: e.target, key: focusKey(e.target) }; });
    // a real blur (the user moved on) forgets the control; a blur by removal keeps it for the rebuild below
    document.addEventListener('focusout', (e) => { const el = e.target; queueMicrotask(() => { if (lastFocus && lastFocus.el === el && el.isConnected && document.activeElement !== el) lastFocus = null; }); });
    const mo = new MutationObserver(() => {
      roveRadios();
      const a = document.activeElement;
      if ((a && a !== document.body) || !lastFocus || lastFocus.el.isConnected || document.querySelector('.modal-bg')) return;
      const el = findByKey(lastFocus.key);
      if (el && el.getClientRects().length) el.focus({ preventScroll: true });
    });
    for (const id of ['shapeList', 'pipeline', 'patternSeg', 'leftFoot', 'rightFoot', 'leftTabs', 'rightTabs', 'chainMode', 'propsPanel', 'tools', 'emptyState']) {
      const el = $(id);
      if (el) mo.observe(el, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-checked'] });
    }
    roveRadios();
  }
  // radiogroups without their own handler: arrows (and Home/End) move the checked radio and the focus with it
  function radioKeys(group) {
    group.addEventListener('keydown', (e) => {
      const dir = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!dir && e.key !== 'Home' && e.key !== 'End') return;
      const rs = [...group.querySelectorAll('[role="radio"]')];
      const i = rs.findIndex((r) => r.getAttribute('aria-checked') === 'true');
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? rs.length - 1 : Math.max(0, Math.min(rs.length - 1, i + dir));
      e.preventDefault();
      if (j === i || !rs[j]) return;
      rs[j].click();
      const on = group.querySelector('[role="radio"][aria-checked="true"]');
      if (on) on.focus({ preventScroll: true });
    });
  }
  // toast with an optional action (used instead of confirmation dialogs).
  // An Undo toast is bound to the history entry it announces: it undoes exactly that action, and the next
  // undoable action, undo or redo dismisses it
  function undoToast(msg) {
    const at = hi;
    toast(msg, 'Undo', () => { if (hi === at) $('undoBtn').click(); }, true);
  }
  function dismissUndoToast() {
    const host = $('toastHost');
    if (host) for (const t of host.querySelectorAll('.toast[data-undo]')) t.remove();
  }
  function toast(msg, actionLabel, action, isUndo) {
    const host = $('toastHost');
    if (!host) return;
    host.innerHTML = '';
    const t = h('div', { class: 'toast', role: 'status', 'data-undo': isUndo ? '' : null }, h('span', null, msg));
    if (actionLabel) t.append(h('button', { class: 'toast-act', onclick: () => { t.remove(); action(); } }, actionLabel));
    host.append(t);
    let left = 5000, t0 = performance.now(), timer = setTimeout(() => t.remove(), left);
    t.addEventListener('pointerenter', () => { clearTimeout(timer); left -= performance.now() - t0; });
    t.addEventListener('pointerleave', () => { t0 = performance.now(); timer = setTimeout(() => t.remove(), Math.max(800, left)); });
  }

  // ---------------- init ----------------
  function init() {
    GLR.init();
    GLR.onRestore = () => { gpu.clear(); for (const e of sm.entries.values()) e.res = null; rebuild(); if (guard) guard.reset(); for (const g of Object.values(paneG)) { g.qs.length = 0; g.reads.length = 0; g.t = 0; } invWaiting.clear(); requestRender('L', 'R', 'T'); };
    // a lost context shows its "restoring" note at once; a background compile that lands redraws with it
    GLR.onLost = () => requestRender('L', 'R');
    // w.main: the user's chain (panes, step thumbnails); w.side: example thumbnails (GLR side mode)
    GLR.onReady = (w) => {
      // an inverse program that landed is warmed first, at once unless something moves (scheduleWarm)
      if (GLR.inverseColdWaiting) scheduleWarm(0);
      // (thumbnails too: one drawn forward before an inverse program landed is redrawn; the others hit their cache)
      if (!w || w.main) { requestRender('L', 'R'); thumbsWaiting = false; requestRender('T'); }
      if ((!w || w.side) && exWait.size) retryExampleThumbs();
    };
    setTheme(themePref()); // before the first readTheme, so canvases start in the saved theme
    readTheme();
    paneL = new Pane($('canvasL'), $('overlayL'));
    paneR = new Pane($('canvasR'), $('overlayR'));
    const loaded = load();
    S = loaded || blankState();
    dockPref.L = !!S.hideLeft; dockPref.R = !!S.hideRight;
    // narrow windows start with the drawers closed (run-time only: save() writes dockPref)
    if (isDrawer('R')) S.hideRight = true;
    if (isDrawer('L')) S.hideLeft = true;
    if (S.clipWin) clipWin = S.clipWin;
    paneL.resize(); paneR.resize();
    paneL.setView(S.srcView);
    buildTools();
    setupFormula();
    buildDisplay();
    setupPane(paneL, 'L');
    setupPane(paneR, 'R');
    // right tabs
    for (const el of document.querySelectorAll('.ic-slot[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] || '';
    $('cmdKbd').textContent = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent) ? '⌘K' : 'Ctrl K';
    $('cmdBtn').addEventListener('click', (e) => openPalette(e.currentTarget));
    // the view controls: the top bar's view switch (merged-views.md) and the panes' Plane | Sphere radios (U4)
    const vsw = $('viewSwitch');
    if (vsw) {
      for (const [v, l, k, html] of MAINS) vsw.append(h('button', { 'data-mode': v, role: 'radio', 'data-tip': `${l}  ${k}`, 'aria-label': l, html: `${VIEW_ICONS[v]}<span>${html}</span>`, onclick: () => setMain(v) }));
      vsw.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const i = MAINS.findIndex((x) => x[0] === S.view.main), j = Math.max(0, Math.min(MAINS.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        setMain(MAINS[j][0]); vsw.children[j].focus(); e.preventDefault();
      });
    }
    for (const side of ['L', 'R']) {
      const el = $(side === 'L' ? 'leftTabs' : 'rightTabs');
      for (const [v, l, k] of SURF[side]) el.append(h('button', { 'data-mode': v, role: 'radio', 'data-tip': k ? `${l}  ${k}` : l, 'aria-label': l, html: `${VIEW_ICONS[v]}<span>${l}</span>`, onclick: () => setView(side, v), ...(v === 'sphere' ? { onpointerenter: prestartGlobe, onfocus: prestartGlobe } : {}) }));
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const list = SURF[side], i = list.findIndex((x) => x[0] === (side === 'L' ? xView() : S.view.R).surf);
        const j = Math.max(0, Math.min(list.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        setView(side, list[j][0]); el.children[j].focus(); e.preventDefault();
      });
    }
    // the Key switch in X's legend chip: the colour key painted in the Y plane
    const kc = $('wKeyChk');
    if (kc) kc.addEventListener('change', () => { S.wKey = kc.checked; buildRightFoot(); requestRender('R'); save(); });
    // the Deformation toggle in the top bar (M; merged-views.md): it modifies the active view
    const mb = $('morphBtn');
    if (mb) { mb.innerHTML = `${MODE_ICONS.morph}<span>Deformation</span>`; mb.addEventListener('click', () => toggleTransport()); }
    $('linesChk').addEventListener('change', (e) => { S.lines = e.target.checked; requestRender('L', 'R', 'T'); save(); });
    $('chevChk').addEventListener('change', (e) => { S.chev = e.target.checked; requestRender('L', 'R'); save(); });
    // Snap: in the Draw heading and the last button of the collapsed rail (P3); Unit circle: in Display
    $('snapBtn').addEventListener('click', () => { S.snap = !S.snap; syncSnapUnit(); save(); });
    $('unitChk').addEventListener('change', (e) => { S.unit = e.target.checked; requestRender('L', 'R', 'T'); save(); });
    $('alphaRange').addEventListener('input', (e) => { S.alpha = +e.target.value; $('alphaVal').textContent = S.alpha.toFixed(2); paintFader(e.target); requestRender('L', 'R', 'T'); save(); });
    $('meshRange').addEventListener('input', (e) => { showMeshVal(posToMesh(+e.target.value)); });
    $('patScale').addEventListener('input', (e) => { S.patternScale = 2 ** +e.target.value; cellBase = 0; buildDisplay(); requestRender('L', 'R', 'T'); save(); });
    $('leftReadout').addEventListener('click', () => copyReadout('L'));
    $('rightReadout').addEventListener('click', () => copyReadout('R'));
    for (const b of $('chainMode').children) b.addEventListener('click', () => {
      S.compact = b.dataset.mode === 'compact';
      const hgt = S.compact ? 112 : 272;
      document.documentElement.style.setProperty('--chain-h', hgt + 'px');
      try { localStorage.setItem(lsk('cmw-chain-h'), String(hgt)); } catch (e) { /* ignore */ }
      applyLayout(); save();
    });
    radioKeys($('chainMode'));
    radioKeys($('patternSeg'));
    // on phones the More sheet of tools closes once a tool is picked
    $('tools').addEventListener('click', (e) => { const tm = $('toolMore'); if (tm && tm.open && e.target.closest('.tool')) tm.open = false; });
    // from 768 px up the panel sections are always open: their summaries are headings, not Tab stops or toggles
    const phoneMQ = matchMedia('(max-width: 767px)');
    const syncSections = () => {
      for (const d of document.querySelectorAll('details.psec')) {
        const s = d.querySelector(':scope > summary');
        if (!s) continue;
        if (phoneMQ.matches) s.removeAttribute('tabindex'); else { s.tabIndex = -1; d.open = true; }
      }
    };
    for (const d of document.querySelectorAll('details.psec')) d.addEventListener('toggle', () => { if (!phoneMQ.matches && !d.open) d.open = true; });
    phoneMQ.addEventListener('change', syncSections);
    syncSections();
    setupGutters();
    setupTooltips();
    setupFocusKeeper();
    // the undo entry follows the focused step until the next action (see noteFocus)
    document.addEventListener('pointerdown', noteFocus, true);
    document.addEventListener('keydown', noteFocus, true);
    // write pending changes (and the right-plane view) when the page is hidden or closed
    window.addEventListener('pagehide', writeState);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeState(); });
    // crossing a drawer breakpoint: a drawer starts closed, a docked panel follows the user's choice
    let drawerWas = { L: isDrawer('L'), R: isDrawer('R') }, wideWas = window.innerWidth >= 768;
    window.addEventListener('resize', () => {
      const now = { L: isDrawer('L'), R: isDrawer('R') }, wide = window.innerWidth >= 768;
      if (wide && wideWas && (now.L !== drawerWas.L || now.R !== drawerWas.R)) {
        if (now.L !== drawerWas.L) S.hideLeft = now.L || dockPref.L;
        if (now.R !== drawerWas.R) S.hideRight = now.R || dockPref.R;
        applyLayout();
      }
      drawerWas = now; wideWas = wide;
    });
    // a pointerdown outside an open overlay drawer closes it
    document.addEventListener('pointerdown', (e) => {
      const t = e.target;
      if (!(t instanceof Element) || t.closest('#popHost, .modal-bg')) return;
      const inL = t.closest('#leftPanel, #leftRail, #toggleLeft'), inR = t.closest('#rightPanel, #rightRail, #toggleRight');
      const l = isDrawer('L') && !S.hideLeft && !inL, r = isDrawer('R') && !S.hideRight && !inR;
      if (l || r) setPanels(S.hideLeft || l, S.hideRight || r);
    }, true);
    $('meshRange').addEventListener('change', (e) => setMesh(posToMesh(+e.target.value)));
    for (const b of document.querySelectorAll('#meshPresets button')) b.addEventListener('click', () => setMesh(+b.dataset.n));
    $('toggleLeft').addEventListener('click', () => setPanels(!S.hideLeft, S.hideRight));
    $('toggleRight').addEventListener('click', () => setPanels(S.hideLeft, !S.hideRight));
    $('leftCollapse').addEventListener('click', () => setPanels(true, S.hideRight));
    $('leftRailOpen').addEventListener('click', () => setPanels(false, S.hideRight));
    $('rightRailOpen').addEventListener('click', () => setPanels(S.hideLeft, false));
    $('leftSolo').addEventListener('click', () => setSolo('L'));
    $('rightSolo').addEventListener('click', () => setSolo('R'));
    applyLayout();
    $('leftFit').addEventListener('click', () => {
      if (!lFlat()) { const c = camOf('L'); if (c) tweenCam(c, camBaseOf(c)); return; }
      paneL.setView(leftView());
      const target = fittedView(paneL, leftStage());
      if (leftStage() > 0) leftAuto = true;
      tweenView(leftView(), target, 260, () => sourceViewChanged());
    });
    $('rightFit').addEventListener('click', () => { rightAuto = true; fitRight(true, morphOn()); requestRender('R'); });
    // On a touch phone the legend chips start folded to their colour wheel and a tap unfolds them (merged-views
    // review: on a 356 px plot the key covered a third of the landscape); a tap on a folded or unfolded chip toggles
    for (const id of ['leftLegend', 'rightLegend']) {
      const el = $(id);
      if (!el) continue;
      try { if (matchMedia('(pointer: coarse) and (max-width: 767px)').matches) el.classList.add('collapsed'); } catch (e) { /* no media queries */ }
      el.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.key-sw')) return; el.classList.toggle('collapsed'); });
    }
    for (const [side, pane] of [['left', paneL], ['right', paneR]]) {
      $(side + 'ZoomIn').innerHTML = ICONS.plus;
      $(side + 'ZoomOut').innerHTML = ICONS.minus;
      $(side + 'Fit').innerHTML = ICONS.fit;
      $(side + 'Solo').innerHTML = ICONS.expand;
      const zb = (f) => () => {
        const sd = side === 'left' ? 'L' : 'R';
        if (is3DSide(sd)) { zoomPane(pane, sd, pane.w / 2, pane.h / 2, f); return; }
        const v = sd === 'L' ? leftView() : V.right;
        pane.setView({ cx: v.cx, cy: v.cy, s: v.s });
        const target = { cx: v.cx, cy: v.cy, s: Math.min(1e9, Math.max(1e-6, v.s * f)) };
        if (sd === 'R') rightAuto = false; else if (leftStage() > 0) leftAuto = false;
        tweenView(v, target, 180, () => sourceViewChanged());
      };
      $(side + 'ZoomIn').addEventListener('click', zb(1.6));
      $(side + 'ZoomOut').addEventListener('click', zb(1 / 1.6));
    }
    $('viewAllBtn').addEventListener('click', () => setFocus(0));
    $('clearChain').addEventListener('click', () => { if (!S.steps.length) return; S.steps = []; S.focus = 0; chainChanged(true); setFocus(0); commit(); undoToast('Chain cleared.'); });
    // Clear in the Shapes heading removes both groups (P15); each row menu clears its own group
    $('clearShapes').addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); clearGroup(true, true); });
    $('undoBtn').addEventListener('click', () => { if (hi > 0) { hi--; restore(hist[hi]); } });
    $('redoBtn').addEventListener('click', () => { if (hi < hist.length - 1) { hi++; restore(hist[hi]); } });
    $('helpBtn').addEventListener('click', openGuide);
    $('exportBtn').addEventListener('click', (e) => openExportMenu(e.currentTarget));
    getDownloads(); // resolves the save capability early (no prompt until a save)
    $('examplesBtn').addEventListener('click', (e) => openGallery(e.currentTarget));
    // the cycle runs on the theme in use, so it still reaches Dark when storage is blocked
    let curTheme = themePref();
    $('themeBtn').addEventListener('click', () => {
      const order = ['auto', 'light', 'dark'];
      curTheme = order[(order.indexOf(curTheme) + 1) % 3];
      setTheme(curTheme);
    });
    setTheme(curTheme);
    document.addEventListener('keydown', (e) => {
      // nothing reaches the app behind a modal dialog; a handled key, or one in a popover or menu, stays there
      if (e.defaultPrevented || document.querySelector('.modal-bg')) return;
      const t = e.target instanceof Element ? e.target : document.body;
      const tag = t.tagName.toLowerCase(), mod = e.ctrlKey || e.metaKey, key = (e.key || '').toLowerCase();
      if (t.closest('#popHost') && !(mod && key === 'k')) return;
      // text fields keep their keys and native undo; a select keeps plain keys (type-ahead), not ⌘Z
      const textEntry = t.isContentEditable || tag === 'textarea' || (tag === 'input' && /^(|text|number|search|email|url|tel|password)$/.test((t.getAttribute('type') || '').toLowerCase()));
      const typing = textEntry || tag === 'select';
      if (mod && key === 'z' && !textEntry) {
        e.preventDefault();
        if (e.shiftKey) $('redoBtn').click(); else $('undoBtn').click();
        return;
      }
      if (mod && key === 'y' && !textEntry) { e.preventDefault(); $('redoBtn').click(); return; }
      if (mod && key === 'k') { e.preventDefault(); if (popEl) closePalette(); else openPalette(null); return; }
      if (e.key === '/' && !typing && !popEl) { e.preventDefault(); openPalette(null); return; }
      if (typing) return;
      if (e.key === 'Escape') {
        const tm = $('toolMore');
        if (padEl) closePad(); else if (popEl) closePalette(); else if (tm && tm.open) tm.open = false;
        else if (closeDrawers()) { /* closed an overlay drawer */ } else if (draft) { draft = null; requestRender('L', 'OR', rGlobe() ? 'R' : null); } else if (selected) { selected = null; buildShapeList(); requestRender('L', 'R'); }
      }
      if (e.key === 'Enter' && draft && draft.kind === 'polygon') finishPolygon();
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      // views (merged-views.md): 1 X → Y, 2 Phase, 3 Landscape. One map for the surfaces in every view (merged-views
      // review): Shift 1, 2 Plane, Sphere of the left or only panel (X in X → Y, the portrait in Phase), Shift 3, 4 of
      // Y (X → Y). By e.code, so Shift 1 is not "!" and the digits work on any layout (AZERTY included); before every
      // e.key shortcut, so a digit key that types '+' or '?' (Swiss ⇧1, Czech 1) still picks a view
      const dg = /^(?:Digit|Numpad)([1-4])$/.exec(e.code || '');
      if (dg && (e.shiftKey || +dg[1] <= 3)) {
        const d = +dg[1];
        if (e.shiftKey) { const sf = d % 2 === 1 ? 'plane' : 'sphere'; if (d <= 2) { if (!lLand()) setView('L', sf); } else if (S.view.main === 'xy') setView('R', sf); }
        else setMain(MAINS[d - 1][0]);
        e.preventDefault();
        return;
      }
      if (e.key === '[') setPanels(!S.hideLeft, S.hideRight);
      if (e.key === ']') setPanels(S.hideLeft, !S.hideRight);
      if ((e.key === 'Delete' || e.key === 'Backspace') && zpSel && zpStep() && zpStep().k === zpSel.k) { e.preventDefault(); zpRemove(zpSel.k, zpSel.kind, zpSel.i); return; }
      if (e.key === 'Escape' && zpSel) { zpSel = null; requestRender('OL'); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected) { e.preventDefault(); deleteShape(selected); return; }
      if (e.key === '?') { openGuide(); return; }
      if (e.key === '+' || e.key === '=') { e.preventDefault(); openPalette(null, undefined, { fnOnly: true }); return; }
      if (key === 'm') { e.preventDefault(); toggleTransport(); return; }
      // P: the deformation's Paths while it shows in X → Y (drawing is off there), the Point tool otherwise
      if (key === 'p' && morphOn() && S.view.main === 'xy') { e.preventDefault(); if (!morphHasDeriv()) setMorphPaths(!(S.morphPaths !== false)); return; }
      if (e.key === 'z' || e.key === 'Z') { $('leftFit').click(); if (autoFit()) $('rightFit').click(); return; }
      const tl = TOOLS.find((x) => x[2] && x[2].toLowerCase() === key);
      if (tl) { e.preventDefault(); setTool(tl[0]); }
    });
    const ro = new ResizeObserver(() => onPaneResize());
    ro.observe(paneL.canvas); ro.observe(paneR.canvas);
    const themeChanged = () => { readTheme(); buildDisplay(); buildShapeList(); drawLegend(); for (const k in rulerCache) rulerCache[k] = null; requestRender('L', 'R', 'T'); };
    matchMedia('(prefers-color-scheme: dark)').addEventListener('change', themeChanged);
    new MutationObserver(themeChanged).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class'] });

    if (loaded) {
      try {
        rebuild();
        buildShapeList();
        buildPipeline();
        hist = [snap()]; hi = 0; updateUndo();
        setFocus(Math.min(S.focus || 0, S.steps.length));
        // an old save's Morph view opens with the deformation on (merged-views.md migration)
        if (S.deform) { delete S.deform; openTransport(); }
        // the right plane reopens at the view the user left it at
        if (loaded.rightView && autoFit()) { Object.assign(V.right, loaded.rightView); rightAuto = false; requestRender('R'); }
        if (loadDropped) toast(`${loadDropped} saved ${loadDropped === 1 ? 'item' : 'items'} could not be restored by this version and ${loadDropped === 1 ? 'was' : 'were'} left out.`);
      } catch (err) {
        // never a dead app on every reload: fall back to the first example
        console.warn('The saved session could not be restored', err);
        S = Object.assign(blankState(), { hideLeft: S.hideLeft, hideRight: S.hideRight });
        selected = null; draft = null;
        dropAllGPU();
        loadExample(firstExample());
        buildDisplay(); applyLayout();
        hist = [snap()]; hi = 0; updateUndo();
        toast('The saved session could not be restored, so the first example was loaded.');
      }
    } else {
      loadExample(firstExample());
      hist = [snap()]; hi = 0; updateUndo();
    }
    try { const k = lsk('cmw-probe'); localStorage.setItem(k, '1'); localStorage.removeItem(k); } catch (e) { warnStorage(); }
    if (window.MathJax && MathJax.tex2svg && MathJax.startup && MathJax.startup.promise) MathJax.startup.promise.then(() => TeX.onReady());
    // fonts may arrive late; redraw labels
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { fitRightTitle(); requestRender('L', 'R', 'T'); });
  }
  // TEMP-DEBUG-HOOK (removed before publishing)
  // the zeros and poles of the step acting on X: handles in page coordinates, the selection, the step's parameters
  window.__cmwZp = () => { const r = paneL.ocanvas.getBoundingClientRect(), zs = zpStep(); return { k: zs ? zs.k : 0, sel: zpSel, params: zs ? Object.assign({}, zs.st.params) : null, handles: zpHandlesL.map((q) => ({ kind: q.kind, i: q.i, x: r.left + q.x, y: r.top + q.y })), pane: { left: r.left, top: r.top, w: paneL.w, h: paneL.h }, glKey: (() => { try { return String(GLChain.build(S.steps, built).key).length + ':' + String(GLChain.build(S.steps, built).key).slice(-80); } catch (e) { return null; } })() }; };
  window.__cmwTime = (n = 5) => {
    const t = (f, pane) => { f(); pane.ctx.getImageData(0, 0, 1, 1); const t0 = performance.now(); for (let i = 0; i < n; i++) { f(); pane.ctx.getImageData(0, 0, 1, 1); } return +((performance.now() - t0) / n).toFixed(2); };
    // (a merged view shows one pane: the hidden one is not timed)
    const one = solo();
    return { left: one === 'R' ? null : t(renderLeft, paneL), right: one === 'L' ? null : t(renderRight, paneR), overlay: t(() => renderOverlays(), paneL), mode: Views.toLegacy(S.view, S.dc, S.landPlain).rightMode, view: Views.clean(S.view), meshN: S.meshN };
  };
  window.__cmwInfo = () => [...gpu.entries()].map(([id, r]) => ({ id, tris: r.meshRes && r.meshRes.n, segs: r.lineRes && r.lineRes.n, fixR: r.fix.R && r.fix.R.extraRes && r.fix.R.extraRes.n, fixL: r.fix.L && r.fix.L.extraRes && r.fix.L.extraRes.n, hold: !!r.hold, live: !!r.live, liveStat: r.liveStat, pool: r.lpool ? r.lpool.size : 0, base: r.meshKey ? +String(r.meshKey).split('|')[1] : null, buildMs: r.buildMs }));
  // per area shape and role: is a hold drawn, and do its strokes belong to another geometry than its fill (U-a review)
  window.__cmwHoldCheck = () => S.shapes.filter((s) => kindType(s) === 'area' && gpu.get(s.id)).flatMap((s) => ['L', 'R'].map((role) => {
    const r = gpu.get(s.id), pm = pairFor(s, r, role).p, L = linesOf(r, pm);
    const held = pm !== r;
    return { id: s.id, role, held, mismatch: held && pm.skey !== r.skey && L === r };
  }));
  window.__cmwSet = (k, v) => {
    // the view fields of earlier builds (the suites set rightMode in many scenes): applied through the migration table,
    // on top of the old fields that name the current view (panels.md 10)
    if (Views.LEGACY.includes(k)) {
      const o = Object.assign(Views.toLegacy(S.view, S.dc, S.landPlain), { [k]: v, dc: S.dc });
      Views.migrate(o);
      S.view = o.view; S.dc = o.dc; S.landPlain = !!o.landPlain;
      applyLayout(); viewChanged('L'); viewChanged('R');
      return;
    }
    if (k === 'view') { S.view = Views.clean(v); applyLayout(); viewChanged('L'); viewChanged('R'); return; }
    S[k] = v; if (k === 'meshN') { dropAllGPU(); } if (k === 'exactImages') scheduleFix(); requestRender('L', 'R', 'T');
  };
  // U-b: the panes' views; setView(side, surf) and setPhase(on) as the controls and keys call them
  window.__cmwView = () => Views.clean(S.view);
  // (U-b's calls: X's surface 'land' is the Landscape view now; Plane or Sphere on X from the Landscape opens X → Y)
  window.__cmwSetView = (side, surf) => { if (side === 'L' && surf === 'land') return setMain('land'); if (side === 'L' && lLand()) setMain('xy'); return setView(side, surf); };
  window.__cmwSetPhase = (on) => setPhase(on);
  // merged views (merged-views.md): the top bar's view ('xy' | 'phase' | 'land') and the layout the panes are in
  window.__cmwSetMain = (m) => setMain(m);
  window.__cmwLayout = () => { const mg = Views.merged(S.view, morphOn()), one = solo(); return { main: S.view.main, deform: !!morph.open, merged: mg, shown: one ? [one] : ['L', 'R'], wL: paneL.w, wR: paneR.w }; };
  // which pane ('L' | 'R') shows the picture an earlier build's rightMode named (the perf suite drags that pane)
  window.__cmwPaneOf = (mode, sphereMode) => Views.paneOf(mode, sphereMode);
  // the old layout's other pane for that picture (the shapes plane beside an old Phase or Landscape view): null when
  // the view is one merged panel here (the perf suite then measures X's plane in X → Y, the same picture)
  window.__cmwOtherPane = (mode, sphereMode) => (Views.merged(S.view, morphOn()) ? null : Views.paneOf(mode, sphereMode) === 'L' ? 'R' : 'L');
  // exact images (SPEC 10.1): the path of every visible area shape in every visible view: [{id, role, viewKind, path, reason}]
  window.__cmwSphere = () => ({ entries: [...sm.entries.values()].map((e) => ({ key: e.key, slot: e.slot, why: e.why, view: e.view, guardBox: e.guardBox, gpu: !!(e.res && e.res.n), ...e.info })), jobs: [...sm.jobs.values()].map((j) => ({ key: j.key, slot: j.slot, why: j.why, ms: +j.ms.toFixed(1), slices: j.slices, nodes: j.mesh ? j.mesh.nodes : 0 })), want: [...sm.want.entries()], running: sm.running, stats: Object.assign({}, sm.stats), cpuBytes: sm.cpuBytes, preBytes: GLR.preBytes, lastExport: sm.lastExport || null });
  // the SphereMesh verdict (SPEC 8.1) of every visible area shape for the right pane's map (12.3: invariant under right-view zooms)
  window.__cmwSmVerdict = (role = 'R') => S.shapes.filter((s) => s.visible !== false && kindType(s) === 'area').map((s) => ({ id: s.id, why: smNeed(s, gpu.get(s.id), role, normalizeMap(stageMap(role === 'R' ? rightStage() : leftStage()))) }));
  window.__cmwSmReset = () => { for (const e of [...sm.entries.values()]) smDrop(e); for (const j of [...sm.jobs.values()]) smCancel(j); sm.want.clear(); Object.assign(sm.stats, { built: 0, ms: 0, slices: 0, maxSlice: 0, cancelled: 0, partial: 0 }); requestRender('L', 'R'); return true; };
  window.__cmwPaths = () => {
    const views = [];
    if (solo() !== 'L') {
      if (rImage()) views.push(['R', 'flat', trans.k ? transState().map : morphOn() ? morphState(false).map : stageMap(rightStage())]);
      else { const hv = homView(); views.push(['R', 'globe', hv ? (hv.imageMap || hv.map) : stageMap(rightStage())]); }
    }
    // (X draws the shapes' areas in its plane and on its globe; the portrait, the phase globe and the landscape outline them)
    if (solo() !== 'R' && (lPlain() || (lGlobe() && !lPhase()))) views.push(['L', lGlobe() ? 'globe' : 'flat', stageMap(leftStage())]);
    const out = [];
    for (const [role, viewKind, map] of views) for (const s of S.shapes) {
      if (s.visible === false || kindType(s) !== 'area') continue;
      const p = pathOf(s, map, role, viewKind, { status: true });
      out.push({ id: s.id, role, viewKind, path: p.path, reason: p.reason || null });
    }
    return out;
  };
  // shape ids that draw forward whatever their eligibility (mixed-path tests); [] clears
  window.__cmwHideStrokes = (on) => { hideStrokes = !!on; requestRender('L', 'R'); return hideStrokes; };
  window.__cmwForceForward = (ids) => { forceFwd.clear(); for (const id of ids || []) forceFwd.add(id); scheduleFix(); requestRender('L', 'R', 'T'); return [...forceFwd]; };
  // the plane point w under a Sphere-view pixel (CSS px of the right pane), null off the globe
  window.__cmwSphereW = (x, y) => { const w = pickSphere(paneR, camS, x, y); return w ? [w.re, w.im] : null; };
  // the level predictLevel would give the right pane's passes (13.14's estimate; no longer a floor) and its estimate
  window.__cmwPredict = () => { const list = S.shapes.filter((x) => x.visible !== false); return predictLevel(list, stageMap(rightStage()), 'R', paneR, lastRecs); };
  // per shape: the line key, whether the settle-time refinement is in (SPEC 9.1), segments and pieces drawn
  window.__cmwLines = () => [...gpu.entries()].map(([id, r]) => ({ id, refined: !!r.refKey && r.refKey.startsWith(r.lineKey + '|'), segs: r.lineRes ? r.lineRes.n : 0, pieces: r.lpolys ? r.lpolys.length : 0, refMs: r.refMs, running: !!lineJob.running }));
  // the cost guard per pane, the timer and the display interval estimate
  window.__cmwGuard = () => ({ R: guard ? guard.state('R') : null, L: guard ? guard.state('L') : null, timer: !!(GLR.timer && GLR.timer.available), inverseDraws: GLR.inverseDraws, log: guardLog.slice() });
  // a fresh cost guard with policy options (GLR.CostGuard opts, e.g. {budget: 1e9}: measure only), for measurements
  window.__cmwGuardOpts = (o) => { if (!GLR.CostGuard) return null; guard = GLR.CostGuard(Object.assign({}, GUARD_OPTS, o || {})); for (const g of Object.values(paneG)) { g.key = ''; g.reads = []; g.demoted = false; } guardLog.length = 0; requestRender('L', 'R'); return guard.state('R'); };
  // the look drawScene gives shape id (colours as hex), the pattern cell, the right view, clipWin and the plane colour
  window.__cmwLook = (id, side = 'R') => { const s = S.shapes.find((x) => x.id === id); if (!s) return null; const k = shapeInk(s); const L = side === 'L'; return { color: k.c0, color2: k.alt, edge: k.edge, ink: TH.ink, alpha: S.alpha, pattern: S.pattern, cell: patternCell(), lines: S.lines, sphN: sphN(), plane: TH.plane, view: Object.assign({}, L ? leftView() : V.right), win: Object.assign({}, clipWin), dpr: (L ? paneL : paneR).dpr, W: (L ? paneL : paneR).pw, H: (L ? paneL : paneR).ph, stage: L ? leftStage() : rightStage() }; };
  // P3: the z-globe's point under a pane pixel (as __cmwSphereW for the w-globe), and a globe's camera set directly
  // P3b: the shapes and targets as stored; the CSS pixel of the plane point (x, y) on a side's globe (null behind it)
  window.__cmwShapes = () => JSON.parse(JSON.stringify({ shapes: S.shapes, targets: S.targets, selected }, noRuntime));
  window.__cmwGlobeXY = (side, x, y) => { const gc = globeCam(side); if (!gc) return null; const P = Number.isFinite(x) ? Region.Globe.lift(x, y) : [0, 0, 1]; return gScreen(gc, P); };
  window.__cmwGlobeSnap = (side, x, y, role) => { const gc = globeCam(side), g = pickGlobe(side === 'L' ? paneL : paneR, camOf(side), x, y); const r = g && gc ? globeSnap(gc, side, g, role) : null; gSnapMark = null; return r ? { z: r.z && [r.z.re, r.z.im], snapped: !!r.snapped, g: g.z && [g.z.re, g.z.im], R: gc.R } : null; };
  window.__cmwSelect = (id) => { selected = id; if (id) zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL', 'OR'); };
  window.__cmwGlobeHandles = (side) => { const gc = globeCam(side); const s = (side === 'R' ? S.targets : S.shapes).find((x) => x.id === selected); return s && gc ? globeHandles(s, gc).map(([k, P]) => [k, gScreen(gc, P)]) : []; };
  window.__cmwSphereWL = (x, y) => { const w = pickSphere(paneL, camOf('L'), x, y); return w ? [w.re, w.im] : null; };
  window.__cmwCam = (side, o) => { const c = camOf(side); if (o) { Object.assign(c, o, { vyaw: 0, vpitch: 0 }); requestRender(side); } return { yaw: c.yaw, pitch: c.pitch, dist: c.dist, tx: c.tx || 0, ty: c.ty || 0, tz: c.tz || 0, fov: c.fov }; };
  // what the live panes last drew each shape with: {'R|s1': 'inverse' | 'pending' | 'forward', ...}
  window.__cmwDrawn = () => Object.fromEntries(lastPath);
  // the scissor w-box of shape id's image under the right plane's map (SPEC 4.8; null: no scissor)
  window.__cmwInvBox = (id) => {
    const s = S.shapes.find((x) => x.id === id);
    if (!s) return null;
    const p = pathOf(s, stageMap(rightStage()), 'R', 'flat');
    return p.e ? invBox(p.e, p.plan, s) : null;
  };
  window.__cmwExample = (i) => loadExample(i);
  // P3 (SPEC 10.6, 12.4 (h)): the figure export as the dialog runs it (opt: {panels, widthIn, caption, alive}), and one
  // panel drawn off-screen at print size (a PNG data URL)
  window.__cmwBuildFigure = (opt) => buildFigure(Object.assign({ panels: ['L', 'R'], widthIn: 7, caption: false }, opt || {}));
  // item 2 (the deformation picture): open/close and scrub the transport; the screen's path selection
  window.__cmwMorph = (o) => { if (o && o.open != null) { if (o.open) openTransport(); else closeTransport(); } if (o && o.T != null) { morph.T = o.T; morph.seg = null; morph.u = 0; morph.playing = false; setPlayIcon(); syncTransport(); scheduleFix(); requestRender('R'); } if (o && o.playing != null) { morph.playing = !!o.playing; setPlayIcon(); requestRender('R'); } return { open: morph.open, T: morph.T, playing: morph.playing, on: morphOn() }; };
  window.__cmwMorphSel = async (o) => { if (!morphOn()) return null; const t0 = performance.now(); const sel = await morphSelScreenNow(paneR, !!(o && o.force)); const wall = performance.now() - t0; if (!sel) return null; const end = S.focus > 0 ? S.focus : nSteps(); const base = S.focus > 0 ? S.focus - 1 : 0; return { ms: sel.ms, wall, budget: sel.budget, n: sel.kept.length, nCands: sel.nCands, kept: sel.kept.map((k) => { const w = stageF(end)(k.sp.z), w0 = stageF(base)(k.sp.z), a = k.s[0].w, b = k.s[k.s.length - 1].w; return { z: [k.sp.z.re, k.sp.z.im], kind: k.sp.kind, start: k.l[0], end: k.l[k.l.length - 1], path: k.l, F: [w.re, w.im], W0: [w0.re, w0.im], Ws: [a.re, a.im], We: [b.re, b.im], meet: !!k.meet }; }), log: sel.log.map(([c, why]) => [c.sp.z.re, c.sp.z.im, c.sp.kind, why]) }; };
  window.__cmwMorphSelSync = () => { const pane = paneR, m = morphLen(), t = performance.now(); const sel = morphPathsFor((w) => pane.w2s(w), { x: 0, y: 0, w: pane.w, h: pane.h }, pane.box(), pane.w / 96, m, { footPx: 8, headCrowd: 12, headL: MF_SCREEN_HL, nogo: mfNogo(pane) }); return { wall: performance.now() - t, ms: sel.ms, n: sel.kept.length, nc: sel.nCands }; };
  window.__cmwMorphCache = () => ({ ready: !!(mfCache.sel && mfCache.key === mfScreenKey(paneR).key && (mfCache.vkey === mfScreenKey(paneR).vkey || mfViewOk(paneR))), job: !!mfCache.job, zs: mfCache.sel ? mfCache.sel.kept.map((k) => [k.sp.z.re, k.sp.z.im]) : null });
  window.__cmwLastFigure = () => lastFigure;
  window.__cmwPrepareExport = (panels, alive) => prepareExport(panels || ['L', 'R'], alive);
  window.__cmwRenderOff = (side, w, h, dpr) => renderOff(side, w, h, dpr).toDataURL('image/png');
  // client coordinates of plane point (re, im) in the left ('L') or right ('R') plane, as last drawn
  window.__cmwW2S = (side, re, im) => { const p = side === 'L' ? paneL : paneR; const r = p.ocanvas.getBoundingClientRect(); const v = p.view; return [r.left + p.w / 2 + (re - v.cx) * v.s, r.top + p.h / 2 - (im - v.cy) * v.s]; };
  window.__cmwState = () => ({ mode: Views.toLegacy(S.view, S.dc, S.landPlain).rightMode, view: Views.clean(S.view), dc: S.dc, landPlain: !!S.landPlain, wKey: !!S.wKey, focus: S.focus, morph: { open: morph.open, T: morph.T, playing: morph.playing }, targets: S.targets.length, hov: hov.list ? hov.list.map((r) => [r.z.re, r.z.im, r.mult]) : null, intPop: intPop ? intPop.id : null, sheets: S.sheets, height: S.height, meshN: S.meshN, homView: homView() }); // TEMP-DEBUG-HOOK
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
