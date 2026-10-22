// Mockup renderer: exact per-pixel pictures of the Cayley map F(z) = (z - i)/(z + i) for the UI mockups.
// Not app code. Planes, phase colouring (the app's Tiles style), and orthographic globes, all from CSS tokens.
const MK = (() => {
  const TAU = Math.PI * 2, DEG = Math.PI / 180;
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const rgb = (h) => { h = (h || '#000000').replace('#', ''); if (h.length === 3) h = h.split('').map((c) => c + c).join(''); return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); };
  const cdiv = (a, b, c, d) => { const q = c * c + d * d; return [(a * c + b * d) / q, (b * c - a * d) / q]; };
  const F = (x, y) => cdiv(x, y - 1, x, y + 1);                       // (z - i)/(z + i)
  const Finv = (u, v) => { const q = cdiv(1 + u, v, 1 - u, -v); return [-q[1], q[0]]; };   // i(1 + w)/(1 - w)
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const fract = (x) => x - Math.floor(x);

  // ---- shapes (planar parameters, as the app stores them) ----
  function level(s, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return s.kind === 'disc' && s.complement ? 1e9 : -1e9;
    let L;
    if (s.kind === 'disc') L = s.r - Math.hypot(x - s.c[0], y - s.c[1]);
    else if (s.kind === 'rect') { const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1]); L = Math.min(x - x0, x1 - x, y - y0, y1 - y); }
    else if (s.kind === 'halfplane') { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l = Math.hypot(dx, dy); L = (dx * (y - s.a[1]) - dy * (x - s.a[0])) / l; }
    else return -1e9;
    return s.complement ? -L : L;
  }
  // boundary polylines in the plane; a line through infinity is sampled as z = a + d tan(t/2), t in (-pi, pi)
  function curves(s) {
    const out = [];
    if (s.kind === 'disc' || s.kind === 'circle') { const p = []; for (let i = 0; i <= 360; i++) { const t = TAU * i / 360; p.push([s.c[0] + s.r * Math.cos(t), s.c[1] + s.r * Math.sin(t)]); } out.push(p); }
    else if (s.kind === 'rect') { const x0 = Math.min(s.a[0], s.b[0]), x1 = Math.max(s.a[0], s.b[0]), y0 = Math.min(s.a[1], s.b[1]), y1 = Math.max(s.a[1], s.b[1]); const cs = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], p = []; for (let k = 0; k < 4; k++) { const a = cs[k], b = cs[(k + 1) % 4]; for (let i = 0; i < 80; i++) p.push([a[0] + (b[0] - a[0]) * i / 80, a[1] + (b[1] - a[1]) * i / 80]); } p.push(cs[0]); out.push(p); }
    else if (s.kind === 'halfplane' || s.kind === 'line') { const dx = s.b[0] - s.a[0], dy = s.b[1] - s.a[1], l = Math.hypot(dx, dy), p = []; for (let i = 1; i < 1600; i++) { const t = -Math.PI + TAU * i / 1600, u = Math.tan(t / 2) * 1.5; p.push([s.a[0] + dx / l * u, s.a[1] + dy / l * u]); } p.inf = true; out.push(p); }
    return out;
  }
  const ink = (ci) => ({ c: rgb(css(`--c${ci}`)), alt: rgb(css(`--c${ci}-alt`)), edge: css(`--c${ci}-edge`) });

  // ---- phase colouring (OKLCH wheel, h = 29 deg + arg, as the app's LUT) ----
  function oklab2srgb(L, a, b) {
    const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
    return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
  }
  const inGamut = (c) => c.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
  const enc = (v) => { v = Math.min(1, Math.max(0, v)); return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055)); };
  const LUT = new Map();
  function wheel(th, L) {
    const hi = ((Math.round(th / TAU * 256) % 256) + 256) % 256, li = Math.round(Math.max(0, Math.min(1, L)) * 64);
    const key = hi * 65 + li;
    let v = LUT.get(key);
    if (!v) {
      const h = 29 * DEG + hi / 256 * TAU, Lq = li / 64;
      let lo = 0, up = 0.2;
      for (let k = 0; k < 18; k++) { const m = (lo + up) / 2; if (inGamut(oklab2srgb(Lq, m * Math.cos(h), m * Math.sin(h)))) lo = m; else up = m; }
      const Cc = Math.min(0.13, 0.97 * lo);
      v = oklab2srgb(Lq, Cc * Math.cos(h), Cc * Math.sin(h)).map(enc);
      LUT.set(key, v);
    }
    return v;
  }
  const Gsaw = (x) => { const f = fract(x); return 0.5 * Math.floor(x) + 0.5 * f * f; };
  const sawAA = (x, w) => { w = Math.max(w, 1e-5); return (Gsaw(x + 0.5 * w) - Gsaw(x - 0.5 * w)) / w; };
  const iso0 = (x, w, px) => { const d = Math.abs(x) / Math.max(w, 1e-30); return 1 - smooth(0.5 * px - 0.5, 0.5 * px + 0.6, d); };
  const isoN = (x, w, px) => { const d = Math.abs(fract(x + 0.5) - 0.5) / Math.max(w, 1e-6); return 1 - smooth(0.5 * px - 0.5, 0.5 * px + 0.6, d); };
  // Tiles: conformal squares (modulus x e^(2 pi/n), phase 2 pi/n), white unit circle
  function tiles(u, v, du, dv, n) {
    const r = Math.hypot(u, v), th = Math.atan2(v, u), q = TAU / n;
    const lr = Math.log(Math.max(r, 1e-300));
    const flr = du, fp = dv;   // per-pixel widths of log r and arg
    const xm = lr / q, fm = flr / q, xp = th / q, fpq = fp / q;
    const sm = sawAA(xm, fm), sp = sawAA(xp, fpq);
    const d = 1 - smooth(0.25, 0.6, Math.max(fm, fpq));
    const L = 0.62 + d * (0.20 * (sm - 0.5) + 0.07 * (sp - 0.5));
    const c = wheel(th, L), t = 0.6 * iso0(lr, flr, 1.25);
    return [c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t];
  }
  const wrap = (a) => (a > Math.PI ? a - TAU : a < -Math.PI ? a + TAU : a);

  // ---- canvas sizing ----
  function fit(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(cv.clientWidth * dpr)), h = Math.max(1, Math.round(cv.clientHeight * dpr));
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    return { W: w, H: h, dpr };
  }
  const niceStep = (x) => { const p = Math.pow(10, Math.floor(Math.log10(x))), m = x / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };

  // ---- per-pixel field: for every device pixel the point of the shapes' z-plane and the point of the pane's plane ----
  // o.space: 'X' (the pane is the z-plane) or 'Y' (the pane is the w-plane; z = F^-1(w)).
  function shade(img, W, H, field, o) {
    const { zx, zy, wx, wy, mask, light } = field;
    const plane = rgb(css('--plane')), alpha = o.alpha ?? 0.85, cell = 0.5;
    const shapes = (o.shapes || []).filter((s) => s.kind !== 'line' && s.kind !== 'point');
    const targets = o.targets || [];
    const inks = shapes.map((s) => ink(s.ci)), tinks = targets.map((s) => ink(s.ci));
    const lineMix = 0.28;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      if (mask && !mask[k]) continue;
      const kx = i + 1 < W ? k + 1 : k - 1, ky = j + 1 < H ? k + W : k - W;
      let col;
      const x = zx[k], y = zy[k];
      // pixel footprint in z (finite differences)
      const fx = Math.abs(zx[kx] - x) + Math.abs(zx[ky] - x), fy = Math.abs(zy[kx] - y) + Math.abs(zy[ky] - y);
      const fz = Math.max(Math.hypot(zx[kx] - x, zy[kx] - y), Math.hypot(zx[ky] - x, zy[ky] - y));
      if (o.paint === 'phase') {
        // the colouring of the pane's own plane (Y) or its pull-back by F (X): the colour at z is the colour at F(z)
        let u, v, u1, v1, u2, v2;
        if (o.space === 'Y') { u = wx[k]; v = wy[k]; u1 = wx[kx]; v1 = wy[kx]; u2 = wx[ky]; v2 = wy[ky]; }
        else { [u, v] = F(x, y); [u1, v1] = F(zx[kx], zy[kx]); [u2, v2] = F(zx[ky], zy[ky]); }
        const lr = Math.log(Math.hypot(u, v)), a = Math.atan2(v, u);
        const du = Math.abs(Math.log(Math.hypot(u1, v1)) - lr) + Math.abs(Math.log(Math.hypot(u2, v2)) - lr);
        const dv = Math.abs(wrap(Math.atan2(v1, u1) - a)) + Math.abs(wrap(Math.atan2(v2, u2) - a));
        col = tiles(u, v, du, dv, 12);
      } else {
        col = plane.slice();
        if (o.grid) col = o.grid(k, col);
        for (let s = 0; s < shapes.length; s++) {
          const sh = shapes[s], L = level(sh, x, y);
          const cov = Math.max(0, Math.min(1, L / Math.max(fz, 1e-12) + 0.5));
          if (cov <= 0) continue;
          const p = [x / cell, y / cell], w = [fx / cell, fy / cell];
          // box-filtered checker (the app's checker()), averaged where cells are under 3 px
          const ch = (pp, ww) => { ww = Math.max(ww, 1e-7); return 2 * (Math.abs(fract((pp - 0.5 * ww) * 0.5) - 0.5) - Math.abs(fract((pp + 0.5 * ww) * 0.5) - 0.5)) / ww; };
          let t = 0.5 - 0.5 * ch(p[0], w[0]) * ch(p[1], w[1]);
          const mo = smooth(0.18, 0.45, Math.max(w[0], w[1]));
          t = t * (1 - mo) + 0.5 * mo;
          const c = inks[s];
          let fc = [0, 1, 2].map((q) => c.c[q] * (1 - t) + c.alt[q] * t);
          // grid lines on regions at the cell edges
          const ln = Math.max(isoN(p[0], w[0], 1), isoN(p[1], w[1], 1)) * (1 - mo);
          const e = rgb(c.edge);
          fc = fc.map((q, n) => q + (e[n] - q) * lineMix * ln);
          const a = alpha * cov;
          col = col.map((q, n) => q + (fc[n] - q) * a);
        }
        // target preimages (X) or targets (Y): hatched, in the target's colour
        for (let s = 0; s < targets.length; s++) {
          const tg = targets[s];
          let L, fw;
          if (o.space === 'Y') { L = level(tg, wx[k], wy[k]); fw = Math.max(Math.hypot(wx[kx] - wx[k], wy[kx] - wy[k]), 1e-12); }
          else { const [u, v] = F(x, y), [u1, v1] = F(zx[kx], zy[kx]); L = level(tg, u, v); fw = Math.max(Math.hypot(u1 - u, v1 - v), 1e-12); }
          const cov = Math.max(0, Math.min(1, L / fw + 0.5));
          if (cov <= 0) continue;
          const hatch = isoN((i + j) / (6 * (o.dpr || 1)), 1 / (6 * (o.dpr || 1)), 1.6 * (o.dpr || 1));
          const c = tinks[s];
          const a = cov * (0.22 + 0.5 * hatch);
          col = col.map((q, n) => q + (c.c[n] - q) * a);
        }
      }
      if (light) { const l = light[k]; col = col.map((q) => q * l[0] + 255 * l[1]); }
      const p4 = k * 4;
      img.data[p4] = col[0]; img.data[p4 + 1] = col[1]; img.data[p4 + 2] = col[2]; img.data[p4 + 3] = 255;
    }
  }

  // ---- flat pane ----
  function plane(cv, o) {
    const { W, H, dpr } = fit(cv);
    const v = o.view, s = v.s * dpr;
    const ctx = cv.getContext('2d');
    const N = W * H, zx = new Float64Array(N), zy = new Float64Array(N), wx = new Float64Array(N), wy = new Float64Array(N);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i, X = v.cx + (i + 0.5 - W / 2) / s, Y = v.cy - (j + 0.5 - H / 2) / s;
      wx[k] = X; wy[k] = Y;
      if (o.space === 'Y') { const z = Finv(X, Y); zx[k] = z[0]; zy[k] = z[1]; } else { zx[k] = X; zy[k] = Y; }
    }
    // graph paper: minor and major lines of the pane's own plane, and its axes
    const step = niceStep(110 / v.s), gmin = rgb(css('--grid-minor')), gmaj = rgb(css('--grid-major')), gaxis = rgb(css('--axis'));
    const grid = (k, col) => {
      const X = wx[k], Y = wy[k], f = 1 / s;
      const mn = Math.max(isoN(X / (step / 5), f / (step / 5), dpr), isoN(Y / (step / 5), f / (step / 5), dpr));
      const mj = Math.max(isoN(X / step, f / step, dpr), isoN(Y / step, f / step, dpr));
      const ax = Math.max(iso0(X, f, 1.2 * dpr), iso0(Y, f, 1.2 * dpr));
      col = col.map((q, n) => q + (gmin[n] - q) * mn);
      col = col.map((q, n) => q + (gmaj[n] - q) * mj);
      return col.map((q, n) => q + (gaxis[n] - q) * 0.55 * ax);
    };
    const img = ctx.createImageData(W, H);
    shade(img, W, H, { zx, zy, wx, wy }, Object.assign({ grid, dpr }, o));
    ctx.putImageData(img, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const toS = (X, Y) => [(X - v.cx) * v.s + cv.clientWidth / 2, -(Y - v.cy) * v.s + cv.clientHeight / 2];
    const map = o.space === 'Y' ? (p) => F(p[0], p[1]) : (p) => p;
    // white over phase: grid major lines and axes, as renderColor
    if (o.paint === 'phase') {
      ctx.save(); ctx.strokeStyle = '#FFFFFF'; ctx.globalAlpha = 0.22; ctx.lineWidth = 1; ctx.beginPath();
      const b = { x0: v.cx - cv.clientWidth / 2 / v.s, x1: v.cx + cv.clientWidth / 2 / v.s, y0: v.cy - cv.clientHeight / 2 / v.s, y1: v.cy + cv.clientHeight / 2 / v.s };
      for (let q = Math.ceil(b.x0 / step); q <= Math.floor(b.x1 / step); q++) { const x = Math.round(toS(q * step, 0)[0]) + 0.5; ctx.moveTo(x, 0); ctx.lineTo(x, cv.clientHeight); }
      for (let q = Math.ceil(b.y0 / step); q <= Math.floor(b.y1 / step); q++) { const y = Math.round(toS(0, q * step)[1]) + 0.5; ctx.moveTo(0, y); ctx.lineTo(cv.clientWidth, y); }
      ctx.stroke(); ctx.globalAlpha = 0.7; ctx.beginPath(); const o0 = toS(0, 0); ctx.moveTo(0, o0[1] + 0.5); ctx.lineTo(cv.clientWidth, o0[1] + 0.5); ctx.moveTo(o0[0] + 0.5, 0); ctx.lineTo(o0[0] + 0.5, cv.clientHeight); ctx.stroke(); ctx.restore();
    }
    // shape edges (images on Y), curves, points
    const strokePoly = (pts, close) => {
      ctx.beginPath(); let pen = false;
      for (const p of pts) { const q = map(p); if (!Number.isFinite(q[0]) || Math.abs(q[0]) > 1e4) { pen = false; continue; } const [x, y] = toS(q[0], q[1]); if (pen) ctx.lineTo(x, y); else ctx.moveTo(x, y); pen = true; }
      if (close && o.space === 'Y' && pts.inf) { const [x, y] = toS(1, 0); ctx.lineTo(x, y); }
      ctx.stroke();
    };
    for (const sh of o.shapes || []) {
      if (sh.kind === 'point') continue;
      const e = ink(sh.ci).edge, cs = curves(sh);
      ctx.save(); ctx.lineJoin = 'round';
      if (o.paint === 'phase') { ctx.strokeStyle = '#FFFFFF'; ctx.globalAlpha = 0.95; ctx.lineWidth = 3; for (const c of cs) strokePoly(c, true); ctx.strokeStyle = css('--dc-casing'); ctx.globalAlpha = 0.9; ctx.lineWidth = 1.3; for (const c of cs) strokePoly(c, true); }
      else { if (sh.kind === 'line') { ctx.strokeStyle = css('--halo'); ctx.lineWidth = 4; for (const c of cs) strokePoly(c, true); } ctx.strokeStyle = e; ctx.lineWidth = sh.kind === 'line' ? 2 : 1.5; for (const c of cs) strokePoly(c, true); }
      ctx.restore();
    }
    for (const tg of o.targets || []) {
      const cs = curves(tg), e = ink(tg.ci).edge;
      const tm = o.space === 'Y' ? (p) => p : (p) => Finv(p[0], p[1]);
      ctx.save(); ctx.strokeStyle = o.paint === 'phase' ? '#FFFFFF' : e; ctx.lineWidth = 1.25; ctx.setLineDash([5, 3]);
      for (const c of cs) { ctx.beginPath(); c.forEach((p, n) => { const q = tm(p); const [x, y] = toS(q[0], q[1]); if (n) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke(); }
      ctx.restore();
    }
    for (const sh of o.shapes || []) {
      if (sh.kind !== 'point') continue;
      const q = map(sh.p), [x, y] = toS(q[0], q[1]);
      ctx.fillStyle = ink(sh.ci).edge; ctx.strokeStyle = css('--halo'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.stroke(); ctx.fill();
      ctx.font = `italic 500 13px ${css('--f-math')}`; ctx.lineWidth = 3; ctx.strokeStyle = css('--halo');
      const lab = o.space === 'Y' ? 'a′' : 'a';
      ctx.strokeText(lab, x + 7, y - 6); ctx.fillStyle = css('--ink'); ctx.fillText(lab, x + 7, y - 6);
    }
    if (o.handlesOf) for (const [hx, hy, round] of o.handlesOf) {
      const [x, y] = toS(hx, hy);
      ctx.fillStyle = css('--surface'); ctx.strokeStyle = o.handleInk || css('--ink'); ctx.lineWidth = 1.5;
      ctx.beginPath(); if (round) ctx.arc(x, y, 3.5, 0, TAU); else ctx.rect(x - 3.5, y - 3.5, 7, 7); ctx.fill(); ctx.stroke();
    }
    if (o.after) o.after(ctx, toS);
    return { toS };
  }

  // ---- rulers ----
  function ruler(cv, v, axis) {
    const { W, H, dpr } = fit(cv);
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = css('--panel'); ctx.fillRect(0, 0, W, H);
    const step = niceStep(110 / v.s), w = cv.clientWidth, h = cv.clientHeight, plotW = axis === 'x' ? w : h;
    const c = axis === 'x' ? v.cx : v.cy;
    ctx.strokeStyle = css('--ruler-tick'); ctx.fillStyle = css('--axis-label'); ctx.font = `400 10px ${css('--f-mono')}`; ctx.lineWidth = 1;
    const lo = c - plotW / 2 / v.s, hi = c + plotW / 2 / v.s, ms = step / 5;
    ctx.beginPath();
    for (let q = Math.ceil(lo / ms); q <= Math.floor(hi / ms); q++) {
      const val = q * ms, pos = axis === 'x' ? (val - c) * v.s + w / 2 : -(val - c) * v.s + h / 2, major = q % 5 === 0, len = major ? 7 : 3;
      if (axis === 'x') { ctx.moveTo(Math.round(pos) + 0.5, 0); ctx.lineTo(Math.round(pos) + 0.5, len); }
      else { ctx.moveTo(w - len, Math.round(pos) + 0.5); ctx.lineTo(w, Math.round(pos) + 0.5); }
    }
    ctx.stroke();
    const fmt = (x) => { const t = Math.abs(x) < 1e-9 ? '0' : (+x.toFixed(4)).toString(); return t.replace('-', '−'); };
    for (let q = Math.ceil(lo / step); q <= Math.floor(hi / step); q++) {
      const val = q * step, pos = axis === 'x' ? (val - c) * v.s + w / 2 : -(val - c) * v.s + h / 2;
      if (pos < 12 || pos > plotW - 12) continue;
      if (axis === 'x') { ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(fmt(val), pos, h - 3); }
      else { ctx.save(); ctx.translate(w - 9, pos); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; ctx.fillText(fmt(val), 0, 0); ctx.restore(); }
    }
  }

  // ---- globe (orthographic; north pole = infinity, south pole = 0) ----
  // The conjugate lift (review B2): P(z) = (2x, -2y, |z|^2 - 1)/(|z|^2 + 1). Seen from outside it preserves orientation,
  // so a half-plane lies to the left of its arrow and the F glyph reads correctly on the globe.
  const lift = (x, y) => { const q = x * x + y * y; return [2 * x / (q + 1), -2 * y / (q + 1), (q - 1) / (q + 1)]; };
  function camBasis(cam) {
    const V = [Math.cos(cam.pitch) * Math.cos(cam.yaw), Math.cos(cam.pitch) * Math.sin(cam.yaw), Math.sin(cam.pitch)];
    const f = V.map((t) => -t);
    let r = [f[1], -f[0], 0]; const lr = Math.hypot(...r) || 1; r = r.map((t) => t / lr);
    const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    return { V, r, u };
  }
  function globe(cv, o) {
    const { W, H, dpr } = fit(cv);
    const ctx = cv.getContext('2d');
    const w = cv.clientWidth, h = cv.clientHeight;
    const R = (o.radius || 0.36) * Math.min(w, h), cx = w / 2, cy = h / 2 + (o.dy || 0);
    const B = camBasis(o.cam);
    const proj = (P) => { const x = P[0] * B.r[0] + P[1] * B.r[1] + P[2] * B.r[2], y = P[0] * B.u[0] + P[1] * B.u[1] + P[2] * B.u[2], d = P[0] * B.V[0] + P[1] * B.V[1] + P[2] * B.V[2]; return [cx + x * R, cy - y * R, d]; };
    // backdrop and contact shadow
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const bg = ctx.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, css('--land-top')); bg.addColorStop(1, css('--land-bottom'));
    ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h);
    ctx.save(); ctx.translate(cx, cy + R * 1.04); ctx.scale(1.6, 0.3); const sg = ctx.createRadialGradient(0, 0, 0, 0, 0, 0.62 * R);
    const sh = rgb(css('--land-shadow')); sg.addColorStop(0, `rgba(${sh},0.22)`); sg.addColorStop(1, `rgba(${sh},0)`); ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(0, 0, 0.62 * R, 0, TAU); ctx.fill(); ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const back = ctx.getImageData(0, 0, W, H);
    const N = W * H, zx = new Float64Array(N), zy = new Float64Array(N), wx = new Float64Array(N), wy = new Float64Array(N), mask = new Uint8Array(N), light = new Array(N);
    const Pz = new Float64Array(N);
    const Ld = (() => { const v = [B.V[0] * 0.8 + B.u[0] * 0.5 - B.r[0] * 0.35, B.V[1] * 0.8 + B.u[1] * 0.5 - B.r[1] * 0.35, B.V[2] * 0.8 + B.u[2] * 0.5 - B.r[2] * 0.35]; const l = Math.hypot(...v); return v.map((t) => t / l); })();
    const Rd = R * dpr, cxd = cx * dpr, cyd = cy * dpr;
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
      const k = j * W + i;
      const nx = (i + 0.5 - cxd) / Rd, ny = -(j + 0.5 - cyd) / Rd, q = nx * nx + ny * ny;
      // a pixel ring outside the rim keeps the finite differences valid; it is not drawn
      const inside = q <= 1;
      const nz = Math.sqrt(Math.max(0, 1 - Math.min(q, 1)));
      const qq = Math.min(q, 1), sc = q > 1 ? 1 / Math.sqrt(q) : 1;
      const ax = nx * sc, ay = ny * sc;
      const P = [ax * B.r[0] + ay * B.u[0] + nz * B.V[0], ax * B.r[1] + ay * B.u[1] + nz * B.V[1], ax * B.r[2] + ay * B.u[2] + nz * B.V[2]];
      Pz[k] = P[2];
      // w on the globe without cancellation near the north pole (SPEC 4.6)
      let u, v;
      // inverse of the conjugate lift: w = (P.x - i P.y)/(1 - P.z)
      if (P[2] <= 0) { u = P[0] / (1 - P[2]); v = -P[1] / (1 - P[2]); }
      else { const a = P[0] / (1 + P[2]), b = -P[1] / (1 + P[2]), m = a * a + b * b; u = m > 0 ? a / m : 1e300; v = m > 0 ? b / m : 0; }
      wx[k] = u; wy[k] = v;
      if (o.space === 'Y') { const z = Finv(u, v); zx[k] = z[0]; zy[k] = z[1]; } else { zx[k] = u; zy[k] = v; }
      if (!inside) continue;
      mask[k] = 1;
      const nd = Math.max(0, P[0] * Ld[0] + P[1] * Ld[1] + P[2] * Ld[2]);
      const rim = Math.pow(1 - nz, 3);
      light[k] = [0.62 + 0.42 * nd - 0.1 * rim, 0.06 * Math.pow(nd, 24) + 0.04 * rim];
      void qq;
    }
    // graticule = the snap net: meridians every 15 deg (30 major), parallels |w| = 2^k (1/2, 1, 2 major)
    const gmin = rgb(css('--grid-medium')), gmaj = rgb(css('--grid-major')), gaxis = rgb(css('--axis'));
    const grid = (k, col) => {
      const i = k % W, j = (k / W) | 0;
      const kx = i + 1 < W ? k + 1 : k - 1, ky = j + 1 < H ? k + W : k - W;
      const lr = Math.log2(Math.hypot(wx[k], wy[k])), th = Math.atan2(wy[k], wx[k]) / (15 * DEG);
      const flr = Math.abs(Math.log2(Math.hypot(wx[kx], wy[kx])) - lr) + Math.abs(Math.log2(Math.hypot(wx[ky], wy[ky])) - lr);
      const fth = (Math.abs(wrap(Math.atan2(wy[kx], wx[kx]) - th * 15 * DEG)) + Math.abs(wrap(Math.atan2(wy[ky], wx[ky]) - th * 15 * DEG))) / (15 * DEG);
      const fade = (f) => 1 - smooth(0.15, 0.35, f);
      const par = Math.abs(lr) <= 3.5 ? isoN(lr, flr, dpr) * fade(flr) : 0;
      const mer = isoN(th, fth, dpr) * fade(fth);
      const majP = Math.abs(lr) <= 1.5 ? par : 0, majM = isoN(th / 2, fth / 2, dpr) * fade(fth / 2);
      col = col.map((q, n) => q + (gmin[n] - q) * Math.max(par, mer));
      col = col.map((q, n) => q + (gmaj[n] - q) * Math.max(majP, majM));
      return col.map((q, n) => q + (gaxis[n] - q) * 0.5 * iso0(lr, flr, 1.2 * dpr));
    };
    shade(back, W, H, { zx, zy, wx, wy, mask, light }, Object.assign({ grid, dpr }, o));
    // rim antialias: blend the silhouette ring with the backdrop already in `back` (cheap: darken edge pixels)
    ctx.putImageData(back, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.strokeStyle = css('--line-strong'); ctx.globalAlpha = 0.6; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    // curves lifted onto the globe, front-facing parts only
    const strokeLifted = (pts, toP) => {
      ctx.beginPath(); let pen = false;
      for (const p of pts) { const P = toP(p); if (!P) { pen = false; continue; } const s = proj(P); if (s[2] < 0.02) { pen = false; continue; } if (pen) ctx.lineTo(s[0], s[1]); else ctx.moveTo(s[0], s[1]); pen = true; }
      ctx.stroke();
    };
    const toPz = o.space === 'Y'
      ? (p) => { const q = F(p[0], p[1]); return Number.isFinite(q[0]) ? lift(q[0], q[1]) : [0, 0, 1]; }
      : (p) => (Number.isFinite(p[0]) ? lift(p[0], p[1]) : [0, 0, 1]);
    for (const shp of o.shapes || []) {
      if (shp.kind === 'point') continue;
      const cs = curves(shp);
      ctx.save(); ctx.lineJoin = 'round';
      for (const c of cs) { const cc = c.inf ? [...c, o.space === 'Y' ? [Infinity, 0] : [Infinity, 0]] : c; const ext = c.inf ? [[1e12 * (c[0][0] - c[c.length - 1][0]), 1e12 * (c[0][1] - c[c.length - 1][1])], ...c, [-1e12 * (c[0][0] - c[c.length - 1][0]), -1e12 * (c[0][1] - c[c.length - 1][1])]] : cc;
        if (o.paint === 'phase') { ctx.strokeStyle = '#FFFFFF'; ctx.lineWidth = 3.5; strokeLifted(ext, toPz); ctx.strokeStyle = css('--dc-casing'); ctx.lineWidth = 1.4; strokeLifted(ext, toPz); }
        else { ctx.strokeStyle = css('--halo'); ctx.globalAlpha = 0.85; ctx.lineWidth = 3.5; strokeLifted(ext, toPz); ctx.globalAlpha = 1; ctx.strokeStyle = ink(shp.ci).edge; ctx.lineWidth = 1.5; strokeLifted(ext, toPz); } }
      ctx.restore();
    }
    for (const tg of o.targets || []) {
      const cs = curves(tg);
      const tm = o.space === 'Y' ? (p) => lift(p[0], p[1]) : (p) => { const z = Finv(p[0], p[1]); return lift(z[0], z[1]); };
      ctx.save(); ctx.strokeStyle = ink(tg.ci).edge; ctx.lineWidth = 1.25; ctx.setLineDash([5, 3]); for (const c of cs) strokeLifted(c, tm); ctx.restore();
    }
    for (const shp of o.shapes || []) {
      if (shp.kind !== 'point') continue;
      const P = toPz(shp.p), s = proj(P);
      if (s[2] <= 0) continue;
      ctx.fillStyle = ink(shp.ci).edge; ctx.strokeStyle = css('--halo'); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(s[0], s[1], 4, 0, TAU); ctx.stroke(); ctx.fill();
      ctx.font = `italic 500 13px ${css('--f-math')}`; ctx.lineWidth = 3; ctx.strokeText(o.space === 'Y' ? 'a′' : 'a', s[0] + 7, s[1] - 6); ctx.fillStyle = css('--ink'); ctx.fillText(o.space === 'Y' ? 'a′' : 'a', s[0] + 7, s[1] - 6);
    }
    // marked points 0, infinity, +-1, +-i
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `italic 500 13px ${css('--f-math')}`;
    for (const [lab, P] of [['0', [0, 0, -1]], ['∞', [0, 0, 1]], ['1', [1, 0, 0]], ['i', [0, 1, 0]], ['−1', [-1, 0, 0]], ['−i', [0, -1, 0]]]) {
      const f = P[0] * B.V[0] + P[1] * B.V[1] + P[2] * B.V[2];
      const a = smooth(0.05, 0.3, f); if (a <= 0) continue;
      const s = proj(P[2] === 0 ? [P[0] * 1.07, P[1] * 1.07, 0.1] : P.map((t) => t * 1.1));
      ctx.globalAlpha = a; ctx.lineWidth = 3; ctx.strokeStyle = css('--halo'); ctx.strokeText(lab, s[0], s[1]); ctx.fillStyle = css('--axis-label'); ctx.fillText(lab, s[0], s[1]);
    }
    ctx.globalAlpha = 1;
    if (o.after) o.after(ctx, proj, { lift, R, cx, cy, B });
    return { proj };
  }

  // ---- the phase legend chip: wheel and modulus strip (static) ----
  function legend(cv, label) {
    const { dpr } = fit(cv);
    const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = cv.clientWidth, h = cv.clientHeight; ctx.clearRect(0, 0, w, h);
    const cx = 36, cy = h / 2, R = 24, r0 = 14;
    for (let a = 0; a < 360; a += 1) { const c = wheel(a * DEG, 0.75); ctx.strokeStyle = `rgb(${c})`; ctx.lineWidth = R - r0; ctx.beginPath(); ctx.arc(cx, cy, (R + r0) / 2, -(a + 0.6) * DEG, -(a - 0.6) * DEG); ctx.stroke(); }
    ctx.fillStyle = css('--ink'); ctx.font = `italic 500 11px ${css('--f-math')}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('arg', cx, cy);
    const sx = 72, sy = 22, sw = 56, sh = 8;
    for (let i = 0; i < sw; i++) { const t = i / sw; const c = wheel(0.4, 0.5 + 0.3 * t); ctx.fillStyle = `rgb(${c})`; ctx.fillRect(sx + i, sy, 1, sh); }
    ctx.strokeStyle = css('--line-strong'); ctx.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
    ctx.fillStyle = css('--muted'); ctx.font = `400 10px ${css('--f-mono')}`; ctx.textAlign = 'left'; ctx.fillText('0', sx, sy + 18); ctx.textAlign = 'right'; ctx.fillText('∞', sx + sw, sy + 18);
    ctx.textAlign = 'center'; ctx.font = `italic 500 11px ${css('--f-math')}`; ctx.fillStyle = css('--ink-2'); ctx.fillText(label || '|F|', sx + sw / 2, sy + 18);
  }
  const phaseRGB = (u, v) => tiles(u, v, 1e-3, 1e-3, 12).map(Math.round);
  return { plane, ruler, globe, legend, F, Finv, lift, ink, css, phaseRGB };
})();
