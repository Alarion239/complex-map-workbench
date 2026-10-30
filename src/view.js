'use strict';
// A 2D complex-plane pane: view transform, resizing, axes.
class Pane {
  // canvas: the drawn plane; overlay (optional): a transparent canvas on top for probes and handles
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ocanvas = overlay || canvas;
    // (issue #297) the overlay's context is CPU-backed (willReadFrequently): on a GPU-accelerated 2D canvas, Chrome
    // kept an earlier frame's picture in the overlay after frames that only cleared it (example 7's cut handle stayed
    // over example 8, about 1 load in 3), although the app drew nothing there; a CPU-backed canvas never did. The
    // overlay holds only lines, chips and handles, cheap to draw on the CPU; the planes' own canvases stay on the GPU
    this.octx = overlay ? overlay.getContext('2d', { willReadFrequently: true }) : this.ctx;
    this.view = { cx: 0, cy: 0, s: 80 };
    this.w = 300; this.h = 300; this.dpr = 1;
  }
  // cw, ch: the CSS size when the caller already knows it (from a ResizeObserver), so no layout is forced
  resize(cw, ch) {
    if (cw == null || ch == null) { const r = this.canvas.getBoundingClientRect(); cw = r.width; ch = r.height; }
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.max(10, cw), h = Math.max(10, ch);
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    const changed = pw !== this.canvas.width || ph !== this.canvas.height;
    if (changed) {
      this.canvas.width = pw; this.canvas.height = ph;
      if (this.ocanvas !== this.canvas) { this.ocanvas.width = pw; this.ocanvas.height = ph; }
    }
    this.w = w; this.h = h; this.dpr = dpr;
    return changed;
  }
  get pw() { return this.canvas.width; }
  get ph() { return this.canvas.height; }
  setView(v) { this.view = v; }
  w2s(z) { const v = this.view; return [this.w / 2 + (z.re - v.cx) * v.s, this.h / 2 - (z.im - v.cy) * v.s]; }
  w2sxy(x, y) { const v = this.view; return [this.w / 2 + (x - v.cx) * v.s, this.h / 2 - (y - v.cy) * v.s]; }
  s2w(x, y) { const v = this.view; return CX.C(v.cx + (x - this.w / 2) / v.s, v.cy - (y - this.h / 2) / v.s); }
  box() {
    const v = this.view, hw = this.w / 2 / v.s, hh = this.h / 2 / v.s;
    return { x0: v.cx - hw, x1: v.cx + hw, y0: v.cy - hh, y1: v.cy + hh };
  }
  vobj() { return { cx: this.view.cx, cy: this.view.cy, s: this.view.s, w: this.w, h: this.h }; }
  zoomAt(x, y, f) {
    const z = this.s2w(x, y);
    const v = this.view;
    const s = Math.min(1e9, Math.max(1e-6, v.s * f));
    v.cx = z.re - (x - this.w / 2) / s;
    v.cy = z.im + (y - this.h / 2) / s;
    v.s = s;
  }
  fitBox(b, margin = 0.08) {
    if (!b || !(b.x1 > b.x0) || !(b.y1 > b.y0)) return false;
    const w = (b.x1 - b.x0) * (1 + 2 * margin), h = (b.y1 - b.y0) * (1 + 2 * margin);
    const v = this.view;
    v.cx = (b.x0 + b.x1) / 2; v.cy = (b.y0 + b.y1) / 2;
    v.s = Math.min(this.w / Math.max(w, 1e-9), this.h / Math.max(h, 1e-9));
    return true;
  }
  beginOverlay() {
    const c = this.octx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.ocanvas.width, this.ocanvas.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
  begin(bg) {
    this.labels = null; // the label queue of the frame being replaced (app.js placeLabels)
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = bg;
    c.fillRect(0, 0, this.pw, this.ph);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }
}

const Axes = (() => {
  function niceStep(raw) {
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }
  function label(v, step) {
    if (Math.abs(v) < step * 1e-6) return '0';
    const d = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    let s = v.toFixed(Math.min(d, 8));
    if (Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-4)) s = v.toExponential(1);
    return s;
  }
  function draw(pane, th, opt = {}) {
    const c = pane.ctx;
    const b = pane.box();
    const s = pane.view.s;
    const major = niceStep(110 / s);
    const minor = major / 5;
    const showMinor = minor * s >= 9;
    const doLines = opt.lines !== false, doLabels = opt.labels !== false;
    c.lineWidth = 1;
    const lines = (step, color) => {
      c.strokeStyle = color;
      c.beginPath();
      const i0 = Math.ceil(b.x0 / step), i1 = Math.floor(b.x1 / step);
      if (i1 - i0 < 400) for (let i = i0; i <= i1; i++) { const x = Math.round(pane.w2sxy(i * step, 0)[0]) + 0.5; c.moveTo(x, 0); c.lineTo(x, pane.h); }
      const j0 = Math.ceil(b.y0 / step), j1 = Math.floor(b.y1 / step);
      if (j1 - j0 < 400) for (let j = j0; j <= j1; j++) { const y = Math.round(pane.w2sxy(0, j * step)[1]) + 0.5; c.moveTo(0, y); c.lineTo(pane.w, y); }
      c.stroke();
    };
    const [ox, oy] = pane.w2sxy(0, 0);
    if (doLines) {
    if (showMinor) lines(minor, th.gridMinor);
    lines(major, th.gridMajor);
    // axes
    c.strokeStyle = th.axis;
    c.lineWidth = 1.2;
    c.beginPath();
    if (oy >= 0 && oy <= pane.h) { c.moveTo(0, Math.round(oy) + 0.5); c.lineTo(pane.w, Math.round(oy) + 0.5); }
    if (ox >= 0 && ox <= pane.w) { c.moveTo(Math.round(ox) + 0.5, 0); c.lineTo(Math.round(ox) + 0.5, pane.h); }
    c.stroke();
    if (opt.unitCircle) {
      const r = s;
      if (r > 4 && r < 1e5) {
        c.save();
        c.setLineDash([3, 4]);
        c.strokeStyle = th.axis;
        c.globalAlpha = 0.55;
        c.beginPath();
        c.arc(ox, oy, r, 0, 2 * Math.PI);
        c.stroke();
        c.restore();
      }
    }
    }
    if (!doLabels) return { major };
    // labels, with a halo in the plane color so they stay legible over fills
    c.font = `10.5px ${th.mono}`;
    c.fillStyle = th.label;
    c.strokeStyle = th.plane;
    c.lineWidth = 3;
    c.lineJoin = 'round';
    const put = (t, x, y) => { if (th.plane) c.strokeText(t, x, y); c.fillText(t, x, y); };
    const ly = Math.min(pane.h - 4, Math.max(12, oy + 13));
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    const i0 = Math.ceil(b.x0 / major), i1 = Math.floor(b.x1 / major);
    if (i1 - i0 < 200) for (let i = i0; i <= i1; i++) {
      if (i === 0) continue;
      const [x] = pane.w2sxy(i * major, 0);
      if (x < 14 || x > pane.w - 14) continue;
      put(label(i * major, major), x, ly);
    }
    const lx = Math.min(pane.w - 4, Math.max(4, ox + 5));
    const rightSide = ox + 5 > pane.w - 40;
    c.textAlign = rightSide ? 'right' : 'left';
    c.textBaseline = 'middle';
    const j0 = Math.ceil(b.y0 / major), j1 = Math.floor(b.y1 / major);
    if (j1 - j0 < 200) for (let j = j0; j <= j1; j++) {
      if (j === 0) continue;
      const [, y] = pane.w2sxy(0, j * major);
      if (y < 10 || y > pane.h - 10) continue;
      const v = j * major;
      const t = label(v, major);
      put((t === '1' ? '' : t === '-1' ? '-' : t) + 'i', rightSide ? pane.w - 6 : lx, y);
    }
    if (ox > 0 && ox < pane.w && oy > 0 && oy < pane.h) {
      c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      put('0', ox + 4, oy + 13);
    }
    return { major };
  }
  return { draw, niceStep };
})();

// Merged views (notes/ui-design/merged-views.md, revising U-b): the top bar's view switch picks one of three views.
//   main 'xy'    X → Y, the split view: the left pane X (Plane | Sphere, the shapes), the right pane Y (Plane | Sphere,
//                the images and the targets)
//   main 'phase' one wide panel: the phase portrait of F over X, on the Plane or the Sphere (the phase sphere)
//   main 'land'  one wide panel: the landscape of F over X, coloured by the phase (D.phase) or plaster
// The Deformation toggle (runtime state, app.js morph.open) modifies the active view; in X → Y it merges the panes
// into one plane (the right pane, Y's surface). The state:
//   view = { main, L: {surf, eq}, R: {surf, eq}, P: {surf, eq}, D: {phase} }   (surf: 'plane' | 'sphere'; eq: the
//          Sphere's equatorial plane)
// migrate(o) turns the fields of earlier builds into o.view: the single right-pane view (rightMode, sphereMode,
// leftSphere, material, spherePlane) and U-b's pane views (view.L = {surf: plane | sphere | land, phase, eq}). No
// dependencies: test/t_views.js runs it in node.
const Views = (() => {
  const MAIN = ['xy', 'phase', 'land'], SURF = ['plane', 'sphere'];
  const SURF_L = SURF, SURF_R = SURF;
  const LEGACY = ['rightMode', 'sphereMode', 'leftSphere', 'material', 'spherePlane'];
  const blank = () => ({ main: 'xy', L: { surf: 'plane', eq: false }, R: { surf: 'plane', eq: false }, P: { surf: 'plane', eq: false }, D: { phase: true } });
  const obj = (x) => (x && typeof x === 'object' ? x : {});
  const sv = (x) => ({ surf: SURF.includes(obj(x).surf) ? x.surf : 'plane', eq: !!obj(x).eq });
  // any object to a valid view. A U-b view (no main; X's surface could be the landscape, X's phase paint on) names its
  // X picture: the landscape opens Landscape, a phase portrait Phase (on its surface), anything else X → Y. A Y phase
  // or landscape of a revision-1 build is dropped.
  function clean(v) {
    const b = blank();
    if (!v || typeof v !== 'object') return b;
    const L = obj(v.L), R = obj(v.R);
    if (!MAIN.includes(v.main)) {
      const out = { main: 'xy', L: sv(L), R: sv(R), P: { surf: 'plane', eq: false }, D: { phase: true } };
      if (L.surf === 'land') { out.main = 'land'; out.D.phase = !!L.phase; }
      else if (L.phase) { out.main = 'phase'; out.P = sv(L); }
      return out;
    }
    return { main: v.main, L: sv(L), R: sv(R), P: sv(v.P), D: { phase: v.D && typeof v.D === 'object' && 'phase' in v.D ? !!v.D.phase : true } };
  }
  // X's picture in the active view, as U-b named it: {surf: 'plane' | 'sphere' | 'land', phase, eq}
  function xOf(v) {
    if (v.main === 'phase') return { surf: v.P.surf, phase: true, eq: v.P.eq };
    if (v.main === 'land') return { surf: 'land', phase: !!v.D.phase, eq: false };
    return { surf: v.L.surf, phase: false, eq: v.L.eq };
  }
  // the one pane a merged view shows ('L': Phase and Landscape, X's plots; 'R': X → Y with the deformation, one plane in
  // Y's coordinates), null for the split view
  const merged = (v, deform) => (v.main !== 'xy' ? 'L' : deform ? 'R' : null);
  // the view an old state names (panels.md 10), as a U-b view (cleaned to a merged view by clean). dc: the state's
  // phase style, changed only as the table says (material tiles with the Plain style: Tiles). The old default material
  // 'phase' painted the relief Plain: that look is kept by landPlain (a landscape-only paint, never by rewriting dc).
  // solo: the expanded pane follows the picture to the pane it moved to; the Phase and Landscape views are one wide
  // panel, so an expanded X plot needs no solo there.
  function fromLegacy(o, dc) {
    const L6 = { surf: 'plane', phase: false, eq: false }, R6 = { surf: 'plane', eq: false };
    const m = o.rightMode, eq = !!o.spherePlane;
    let landPlain = false, Lx = L6;
    if (o.leftSphere) L6.surf = 'sphere';
    if (m === 'color') { Lx = { surf: 'plane', phase: true, eq: false }; }
    else if (m === '3d') {
      const mat = ['phase', 'tiles', 'plaster'].includes(o.material) ? o.material : 'phase';
      Lx = { surf: 'land', phase: mat !== 'plaster', eq: false };
      if (mat === 'phase' && dc !== 'phase') landPlain = true;
      else if (mat === 'tiles' && dc === 'phase') dc = 'enhanced';
    } else if (m === 'sphere') {
      if (o.sphereMode === 'color') Lx = { surf: 'sphere', phase: true, eq };
      else { R6.surf = 'sphere'; R6.eq = eq; }
    }
    const view = clean({ L: Lx, R: R6 });
    // X → Y keeps the old left plane's surface when the picture moved to a wide panel
    if (Lx !== L6) view.L = sv(L6);
    // 'image', and the Morph, Preimage and Integral views of older builds, open in X → Y ('morph' with the deformation)
    let solo = o.solo;
    if (('rightMode' in o) && paneOf(m, o.sphereMode) === 'L') solo = solo === 'R' || solo === 'L' ? null : solo;
    return { view, dc, landPlain, solo, deform: m === 'morph' };
  }
  // in place: o.view from o's legacy fields when it still carries rightMode (or has no view at all); the legacy
  // fields are removed. An old Morph view sets o.deform (the app opens the deformation). Returns o.
  function migrate(o) {
    if (!o || typeof o !== 'object') return o;
    if ('rightMode' in o || !o.view) {
      const r = fromLegacy(o, o.dc);
      o.view = r.view;
      if (r.dc !== undefined) o.dc = r.dc;
      o.landPlain = r.landPlain;
      if (r.solo !== undefined) o.solo = r.solo;
      if (r.deform) o.deform = true;
    } else { o.view = clean(o.view); o.landPlain = !!o.landPlain; }
    for (const k of LEGACY) delete o[k];
    return o;
  }
  // the old fields that name the same picture (test hooks and the perf suite's old-layout units); a view with no old
  // equivalent (e.g. X Sphere with Y Sphere) gets the nearest one
  function toLegacy(v, dc, landPlain) {
    v = clean(v);
    const x = xOf(v);
    const o = { rightMode: 'image', sphereMode: 'image', leftSphere: v.L.surf === 'sphere', material: 'phase', spherePlane: false };
    if (x.surf === 'land') { o.rightMode = '3d'; o.leftSphere = false; o.material = !x.phase ? 'plaster' : dc === 'phase' || landPlain ? 'phase' : 'tiles'; }
    else if (x.phase && x.surf === 'plane') { o.rightMode = 'color'; o.leftSphere = false; }
    else if (x.phase && x.surf === 'sphere') { o.rightMode = 'sphere'; o.sphereMode = 'color'; o.spherePlane = x.eq; o.leftSphere = false; }
    else if (v.R.surf === 'sphere') { o.rightMode = 'sphere'; o.spherePlane = v.R.eq; }
    return o;
  }
  // which pane shows the picture an old rightMode named ('image' | 'color' | '3d' | 'sphere' (+ sphereMode))
  function paneOf(mode, sphereMode) {
    if (mode === 'color' || mode === '3d') return 'L';
    if (mode === 'sphere') return sphereMode === 'color' ? 'L' : 'R';
    return 'R';
  }
  return { blank, clean, xOf, merged, migrate, fromLegacy, toLegacy, paneOf, LEGACY, MAIN, SURF_L, SURF_R };
})();
import { CX } from './cx.js';
export { Axes, Pane, Views };
