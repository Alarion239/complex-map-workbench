'use strict';
// A 2D complex-plane pane: view transform, resizing, axes.
class Pane {
  // canvas: the drawn plane; overlay (optional): a transparent canvas on top for probes and handles
  constructor(canvas, overlay) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ocanvas = overlay || canvas;
    this.octx = overlay ? overlay.getContext('2d') : this.ctx;
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
