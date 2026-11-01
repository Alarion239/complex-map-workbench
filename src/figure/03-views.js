  // =====================================================================================================
  // 3. The views
  // =====================================================================================================
  const aspect = (b) => (b.x1 - b.x0) / (b.y1 - b.y0);
  const maxW = (texs, pt) => Math.max(0, ...texs.map((t) => XD.tex(t, pt).w));
  const tickW = (b, step, tp) => { const sy = XD.axisSteps(b, step)[1], d = XD.decimals(sy); return maxW(XD.ticks(b.y0, b.y1, sy).map((v) => XD.tickTex(v, d)), tp); };
  // the room the last x tick label needs right of the frame (when the frame ends on that tick)
  const overR = (b, step, tp) => { const sx = XD.axisSteps(b, step)[0], t = XD.ticks(b.x0, b.x1, sx).pop(); return t != null && Math.abs(b.x1 - t) < 1e-9 * Math.max(1, Math.abs(t)) ? XD.tex(XD.tickTex(t, XD.decimals(sx)), tp).w / 2 + 1 : 0; };
  const head = (x0, x1, y, letter, tag, pt) => (letter ? XD.at(XD.tex(XD.lang === 'ru' ? `\\textit{${letter}}` : `\\text{${letter}}`, pt), x0, y, 'start', 'base', 'panel-letter') : '') + (tag ? XD.at(XD.tex(tag, pt), x1, y, 'end', 'base', 'panel-letter') : '');
  // the i-th panel letter in the figure's language: (a) (b) ... ; а б ... (set in italic by head)
  const panelLetter = (i) => (XD.lang === 'ru' ? RU_LETTERS[i] : `(${String.fromCharCode(97 + i)})`);
  const expandBox = (b, f) => { const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, w = (b.x1 - b.x0) * f / 2, h = (b.y1 - b.y0) * f / 2; return { x0: cx - w, x1: cx + w, y0: cy - h, y1: cy + h }; };
  const stepFor = (box, wpt) => niceStep(Math.max(box.x1 - box.x0, box.y1 - box.y0), Math.max(2, Math.min(5, Math.round(wpt / 42))));
  // a polyline set [[x, y], ...] from Region.mapCurve's flat arrays
  const unflat = (fl) => { const o = []; for (let i = 0; i + 1 < fl.length; i += 2) o.push([fl[i], fl[i + 1]]); return o; };
  // the curves of a shape mapped by F, sampled for a panel box at wpt (0.1 pt deviation)
  // the boundary of an area without boundary curves of its own (a formula: |Im z| < pi/2, 0 < arg z < pi/3 and ...):
  // the zero set of its level function by marching squares on a 720 x 720 grid of the window, joined by edge ids
  // into polylines, as curves {f, n0, closed} that mapCurve refines through F (so the images stay smooth)
  const lvlCache = new Map();
  function levelBoundary(s, win, n = 720) {
    const key = JSON.stringify([s.kind, s.expr, !!s.complement, win.x0, win.x1, win.y0, win.y1, n]);
    if (lvlCache.has(key)) return lvlCache.get(key);
    let L;
    try { L = Region.levelOf(s); } catch (e) { return []; }
    const dx = (win.x1 - win.x0) / n, dy = (win.y1 - win.y0) / n, N = n + 1, G = new Float64Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let v; try { v = L(C(win.x0 + i * dx, win.y0 + j * dy)); } catch (e) { v = NaN; } G[j * N + i] = Number.isFinite(v) ? v : NaN; }
    // edge e: horizontal (i, j)-(i+1, j) = 2 (j N + i), vertical (i, j)-(i, j+1) = 2 (j N + i) + 1; its crossing point
    const pt = new Map();
    const cross = (e) => {
      if (pt.has(e)) return pt.get(e);
      const v = e >> 1, i = v % N, j = (v - i) / N, a = G[v], b = e & 1 ? G[v + N] : G[v + 1], t = a / (a - b);
      const q = e & 1 ? [win.x0 + i * dx, win.y0 + (j + t) * dy] : [win.x0 + (i + t) * dx, win.y0 + j * dy];
      pt.set(e, q); return q;
    };
    const adj = new Map(), link = (a, b) => { for (const [x, y] of [[a, b], [b, a]]) { if (!adj.has(x)) adj.set(x, []); adj.get(x).push(y); } };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = j * N + i, a = G[v], b = G[v + 1], c = G[v + N + 1], d = G[v + N];
      if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d))) continue;
      const code = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const eB = 2 * v, eR = 2 * (v + 1) + 1, eT = 2 * (v + N), eL = 2 * v + 1; // bottom, right, top, left
      const es = [];
      if ((a > 0) !== (b > 0)) es.push(eB);
      if ((b > 0) !== (c > 0)) es.push(eR);
      if ((c > 0) !== (d > 0)) es.push(eT);
      if ((d > 0) !== (a > 0)) es.push(eL);
      if (es.length === 2) link(es[0], es[1]);
      else if (es.length === 4) { // a saddle: the centre's sign decides the pairing
        const m = (a + b + c + d) / 4 > 0;
        if (m === (a > 0)) { link(eB, eR); link(eT, eL); } else { link(eB, eL); link(eR, eT); }
      }
    }
    const used = new Set(), lines = [];
    for (const e0 of adj.keys()) {
      if (used.has(e0)) continue;
      const line = [e0]; used.add(e0);
      for (const dir of [1, 0]) for (;;) {
        const tip = dir ? line[line.length - 1] : line[0], nb = (adj.get(tip) || []).find((x) => !used.has(x));
        if (nb == null) break;
        used.add(nb); if (dir) line.push(nb); else line.unshift(nb);
      }
      const closed = line.length > 2 && (adj.get(line[0]) || []).includes(line[line.length - 1]);
      const P = line.map(cross);
      if (closed) P.push(P[0]);
      if (P.length > 1) lines.push(P);
    }
    for (const P of lines) {
      const k = P.length >> 1, a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)], dxl = b[0] - a[0], dyl = b[1] - a[1], l = Math.hypot(dxl, dyl);
      if (!(l > 0)) continue;
      const e = 0.25 * Math.min(dx, dy), m = P[k];
      let inL = NaN;
      try { inL = L(C(m[0] - dyl / l * e, m[1] + dxl / l * e)); } catch (err) { inL = NaN; }
      if (inL < 0) P.reverse();
    }
    const out = lines.map((P) => ({ n0: Math.min(400, Math.max(16, P.length >> 2)), closed: false, f: (t) => { const u = Math.max(0, Math.min(1, t)) * (P.length - 1), k = Math.min(P.length - 2, Math.floor(u)), r = u - k; return C(P[k][0] + (P[k + 1][0] - P[k][0]) * r, P[k][1] + (P[k + 1][1] - P[k][1]) * r); } }));
    if (lvlCache.size > 12) lvlCache.clear();
    lvlCache.set(key, out);
    return out;
  }
  function shapeCurves(s, F, box, wpt, srcWin) {
    let cs = [];
    try { cs = Region.curvesOf(s, srcWin) || []; } catch (e) { cs = []; }
    if (!cs.length && kindType(s) === 'area' && !(Region.KINDS[s.kind] && Region.KINDS[s.kind].boundary)) cs = levelBoundary(s, srcWin);
    return { pts: mapCurves(cs, F, box, wpt), cs };
  }
  // source curves (Region.curvesOf) mapped by F and sampled for a panel box at wpt
  function mapCurves(cs, F, box, wpt) {
    const k = 4 * wpt / (box.x1 - box.x0);
    const view = { cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, s: k, w: (box.x1 - box.x0) * k, h: (box.y1 - box.y0) * k };
    const out = [];
    for (const c of cs) {
      try {
        if (c && typeof c.f === 'function') { for (const fl of Region.mapCurve(c, F, view, { budget: 80000, maxDepth: 15 })) out.push(unflat(fl)); }
        else if (c && c.pts) { const seg = []; for (const p of c.pts) { const w = F(p.re != null ? p : C(p[0], p[1])); if (Number.isFinite(w.re) && Number.isFinite(w.im)) seg.push([w.re, w.im]); } if (seg.length > 1) out.push(seg); }
      } catch (e) { /* a curve that cannot be mapped is left out */ }
    }
    return out;
  }
  // a boundary piece that a drawn curve covers (the Joukowski circle on the edge of the disc's complement): the
  // curve is part of the figure, so that piece is not shown as an excluded (dashed) boundary
  function srcPoly(c, n) {
    const out = [];
    try {
      if (c && typeof c.f === 'function') for (let i = 0; i <= n; i++) { const z = c.f(i / n); if (fin(z)) out.push([z.re, z.im]); }
      else if (c && c.pts) for (const p of c.pts) { const z = p.re != null ? p : C(p[0], p[1]); if (fin(z)) out.push([z.re, z.im]); }
    } catch (e) { /* */ }
    return out;
  }
  function coveredBy(c, polys, tol) {
    const pts = srcPoly(c, 32);
    if (pts.length < 2 || !polys.length) return false;
    const d2 = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy, u = L > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L)) : 0, x = a[0] + u * vx - p[0], y = a[1] + u * vy - p[1]; return x * x + y * y; };
    return pts.every((p) => polys.some((q) => { for (let i = 1; i < q.length; i++) if (d2(p, q[i - 1], q[i]) <= tol * tol) return true; return false; }));
  }
  // B/W: curves told apart by their dash; in Homework the dash 3 2 means "boundary not included", so it is never used
  // for anything else there (dotted and dash-dot instead)
  const bwDash = (P, k) => (P.dashOpen ? [null, '0 1.8', '4 2.2 0 2.2'] : BW_DASH)[k % 3];
  const C = (re, im = 0) => ({ re, im });
  const kindType = (s) => (Region.KINDS[s.kind] ? Region.KINDS[s.kind].type : 'area');
  const fin = (w) => w && Number.isFinite(w.re) && Number.isFinite(w.im) && Math.abs(w.re) < 1e9 && Math.abs(w.im) < 1e9;
  // the content box of an art raster (non-white pixels) in world coordinates, or null
  function contentBox(r, box) {
    const { w, h, rgb } = r;
    let i0 = w, i1 = -1, j0 = h, j1 = -1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const q = 3 * (j * w + i); if (rgb[q] < 248 || rgb[q + 1] < 248 || rgb[q + 2] < 248) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
    if (i1 < 0) return null;
    const X = (i) => box.x0 + i / w * (box.x1 - box.x0), Y = (j) => box.y1 - j / h * (box.y1 - box.y0);
    return { x0: X(i0), x1: X(i1 + 1), y0: Y(j1 + 1), y1: Y(j0), touch: { l: i0 <= 1, r: i1 >= w - 2, t: j0 <= 1, b: j1 >= h - 2 } };
  }
  const unionBox = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), touch: { l: (a.touch && a.touch.l) || (b.touch && b.touch.l), r: (a.touch && a.touch.r) || (b.touch && b.touch.r), t: (a.touch && a.touch.t) || (b.touch && b.touch.t), b: (a.touch && a.touch.b) || (b.touch && b.touch.b) } });
  const ptsBox = (polys, win) => {
    let b = null;
    for (const seg of polys) for (const p of seg) { if (p[0] < win.x0 || p[0] > win.x1 || p[1] < win.y0 || p[1] > win.y1) continue; b = unionBox(b, { x0: p[0], x1: p[0], y0: p[1], y1: p[1] }); }
    return b;
  };
  // Fit: the content plus 8 %, snapped outward to half a tick step; a side the content runs off (an unbounded set)
  // keeps the screen window's edge there. Equal aspect is kept by the panel (one unit, one length).
  function fitBox(content, screen, wpt) {
    if (!content) return screen;
    const sw = screen.x1 - screen.x0, sh = screen.y1 - screen.y0;
    let b = { x0: content.x0, x1: content.x1, y0: content.y0, y1: content.y1 };
    const span0 = Math.max(b.x1 - b.x0, b.y1 - b.y0, 1e-9 * Math.max(sw, sh));
    // 8 % of each side's own span (at least 2 % of the long side), so a wide strip is not framed as a square
    const px = 0.08 * Math.max(b.x1 - b.x0, 0.25 * span0), py = 0.08 * Math.max(b.y1 - b.y0, 0.25 * span0);
    const t = content.touch || {};
    b = { x0: t.l ? screen.x0 : b.x0 - px, x1: t.r ? screen.x1 : b.x1 + px, y0: t.b ? screen.y0 : b.y0 - py, y1: t.t ? screen.y1 : b.y1 + py };
    // a set that runs off both opposite sides (a strip): its length comes from the scene, not from the pane's shape, so
    // the figure is the same from a phone or a wide window (3:2 around the view's centre; a vertical strip is square)
    if (t.l && t.r && !(t.t && t.b)) { const c = (screen.x0 + screen.x1) / 2, hw = 0.75 * (b.y1 - b.y0); b.x0 = c - hw; b.x1 = c + hw; }
    else if (t.t && t.b && !(t.l && t.r)) { const c = (screen.y0 + screen.y1) / 2, hh = 0.5 * (b.x1 - b.x0); b.y0 = c - hh; b.y1 = c + hh; }
    // (v16 review picture-9) the points the caption names are framed whole, even when an unbounded set (a line) keeps
    // the window's edge on that side: 8 % beyond the farthest point
    const mu = content.must;
    if (mu) {
      const mx = 0.08 * Math.max(mu.x1 - mu.x0, b.x1 - b.x0), my = 0.08 * Math.max(mu.y1 - mu.y0, b.y1 - b.y0);
      b = { x0: Math.min(b.x0, mu.x0 - mx), x1: Math.max(b.x1, mu.x1 + mx), y0: Math.min(b.y0, mu.y0 - my), y1: Math.max(b.y1, mu.y1 + my) };
    }
    // a sliver at least a quarter of the long side: a segment on the real axis is not a hairline panel
    const minSpan = 0.25 * Math.max(b.x1 - b.x0, b.y1 - b.y0);
    if (b.x1 - b.x0 < minSpan) { const c = (b.x0 + b.x1) / 2; b.x0 = c - minSpan / 2; b.x1 = c + minSpan / 2; }
    if (b.y1 - b.y0 < minSpan) { const c = (b.y0 + b.y1) / 2; b.y0 = c - minSpan / 2; b.y1 = c + minSpan / 2; }
    const st = stepFor(b, wpt) / 2;
    const snap = (v, up) => (up ? Math.ceil(v / st - 1e-9) : Math.floor(v / st + 1e-9)) * st;
    b = { x0: t.l ? snap(b.x0, true) : snap(b.x0, false), x1: t.r ? snap(b.x1, false) : snap(b.x1, true), y0: t.b ? snap(b.y0, true) : snap(b.y0, false), y1: t.t ? snap(b.y1, false) : snap(b.y1, true) };
    if (!(b.x1 > b.x0 && b.y1 > b.y0)) return screen;
    return b;
  }
  const snapScreen = (b, wpt) => { const st = stepFor(b, wpt) / 2; const r = { x0: Math.ceil(b.x0 / st - 1e-9) * st, x1: Math.floor(b.x1 / st + 1e-9) * st, y0: Math.ceil(b.y0 / st - 1e-9) * st, y1: Math.floor(b.y1 / st + 1e-9) * st }; return r.x1 > r.x0 && r.y1 > r.y0 ? r : b; };
  // the art of a panel: the app's renderer in art mode (fills only) for an exact window, then flattened and encoded
  async function artPanel(side, box, wpt, o, extra = {}) {
    const flat = o.ink === 'bw' ? 'grey' : extra.mode || 'indexed';
    const dpi = extra.dpi || (flat === 'rgb' ? 300 : 600);
    let r = await A.art(side, { box, wpt, dpi: dpi * (extra.ss || 1), ink: printInkFor(o, A.state().alpha), T: extra.T, alive: o.alive });
    if (!r) return null;
    if (extra.ss === 2) r = await down2(r);
    const a = await XD.art(r, box, { mode: flat, wpt, fade: extra.fade });
    a.dpi = dpi; a.raw = r;
    return a;
  }
  // (export review r3, editor-20) a raster rendered at twice the resolution, averaged 2 x 2: a discontinuity of the
  // map (a branch cut) gets a smooth edge instead of pixel steps; in slices, so no task nears 50 ms
  async function down2(r) {
    const w = r.w >> 1, h = r.h >> 1, out = new Uint8Array(w * h * 3), src = r.rgb, W2 = r.w;
    await sliced(w * h, (i0, i1) => {
      for (let i = i0; i < i1; i++) {
        const y = (i / w) | 0, x = i - y * w, a = 3 * (2 * y * W2 + 2 * x), b = a + 3 * W2;
        for (let c = 0; c < 3; c++) out[3 * i + c] = (src[a + c] + src[a + 3 + c] + src[b + c] + src[b + 3 + c] + 2) >> 2;
      }
    });
    return Object.assign({}, r, { w, h, rgb: out });
  }
  // an example's word label is stored in English (app.js exLabel, review math-5): it is set in the figure's language
  const EX_LABELS = new Set(['trailing edge']);
  const texLabel = (s, i) => {
    if (s.label) {
      const l = EX_LABELS.has(String(s.label)) && I18 ? I18.at(XD.lang || 'en').t(String(s.label)) : String(s.label);
      if (/[A-Za-z]{2}|\s/.test(l) || /[\u0400-\u04ff]/.test(l)) return `\\text{${l.replace(/[\\{}$&#%_^~]/g, '')}}`;
      return l.replace(/₀/g, '_0').replace(/₁/g, '_1').replace(/₂/g, '_2').replace(/₃/g, '_3').replace(/′/g, "'");
    }
    return null;
  };
  const cxTex = (z) => (CX.tex ? CX.tex(z, 3) : `${+z.re.toFixed(3)}${z.im >= 0 ? '+' : '-'}${Math.abs(+z.im.toFixed(3))}i`);
  // the vector layers of one plane panel: boundaries and curves (mapped by F), points (and their names)
  function planeLayers(o, P, side, F, box, wpt, shapes, srcWin, primeName) {
    const curves = [], points = [], chev = [];
    let bwI = 0, dashed = 0;
    // the drawn curves (source plane), for the open boundaries they cover
    let solids = null;
    const solidPolys = () => solids || (solids = shapes.filter((s) => kindType(s) === 'curve').flatMap((s) => { try { return (Region.curvesOf(s, srcWin) || []).map((c) => srcPoly(c, 720)); } catch (e) { return []; } }).filter((q) => q.length > 1));
    const tol = 2e-4 * Math.hypot(srcWin.x1 - srcWin.x0, srcWin.y1 - srcWin.y0);
    shapes.forEach((s, si) => {
      const t = kindType(s);
      if (t === 'point') return;
      const tn = tonesOf(s, o);
      const grid = s.kind === 'cgrid' || s.kind === 'pgrid';
      const open = t === 'area' && Region.isOpen && Region.isOpen(s);
      const sc = shapeCurves(s, F, box, wpt, srcWin), cs = sc.cs;
      let pts = sc.pts;
      let dash = open && P.dashOpen ? '3 2' : null;
      if (dash && cs.length) {
        // pieces of an open boundary that a drawn curve lies on are the curve's: they are left to it
        const cov = cs.map((c) => coveredBy(c, solidPolys(), tol));
        if (cov.some(Boolean)) pts = mapCurves(cs.filter((c, i) => !cov[i]), F, box, wpt);
      }
      if (o.ink === 'bw' && !grid && !dash) dash = bwDash(P, bwI++);
      const color = o.ink === 'bw' ? (grid ? '#666666' : '#000000') : (o.for === 'article' || grid ? tn.edge : t === 'area' ? tn.edge : tn.edge);
      if (dash === '3 2' && pts.some((q) => q.some((p) => p[0] >= box.x0 && p[0] <= box.x1 && p[1] >= box.y0 && p[1] <= box.y1))) dashed++;
      curves.push({ pts, w: grid ? P.lw.grid : t === 'area' ? P.lw.edge : P.lw.curve, color, dash, cap: dash && dash.indexOf('0 ') === 0 || dash === '4 2.2 0 2.2' ? 'round' : 'butt', open });
      // orientation chevrons (Homework): one on each piece of an area's boundary, at a point that shows in both panels
      if (P.chevrons && t === 'area') for (const c of cs.slice(0, 6)) if (c && typeof c.f === 'function') chev.push({ c, color, s });
    });
    let pi = 0;
    // (v16 review picture-7) with constructions the caption names points (z₀, z₃ …): every point is labelled as the
    // plane labels it (helpers have no label and no index), and a fixed constructed point is a ring, as on screen
    const cmFig = shapes.some((x) => x.def || x.at);
    const markOf = (s) => (cmFig && Construct.pointMark ? Construct.pointMark(s) : null);
    shapes.forEach((s) => {
      if (kindType(s) !== 'point' || !s.p) return;
      const mk = markOf(s);
      const z = C(s.p[0], s.p[1]), w = F(z);
      const k = mk === 'helper' ? -1 : pi++;
      if (!fin(w) || s._atInf) return;
      if (mk === 'helper') { points.push({ z: [w.re, w.im], r: 1.1, kind: 'ring', label: null, at: 'auto', sw: 0.5 }); return; }
      let label = null;
      if (P.named) label = String.fromCharCode(65 + (k % 26)) + (primeName ? "'" : '');
      else { const l = texLabel(s, k) || (cmFig ? `z_{${k}}` : null); label = l ? (primeName ? `${primeName}(${l})` : l) : null; }
      if (P.named || o.ink === 'bw') points.push({ z: [w.re, w.im], r: P.named ? 2.0 : 1.6, kind: P.named ? PTS[k % 4][0] : mk === 'ring' ? 'ring' : 'dot', fill: o.ink === 'bw' ? '#000000' : P.named ? PTS[k % 4][1] : '#000000', label, at: 'auto' });
      else points.push({ z: [w.re, w.im], r: mk === 'ring' ? 1.7 : 1.5, kind: mk === 'ring' ? 'ring' : 'dot', fill: '#000000', label, at: 'auto', sw: mk === 'ring' ? 0.6 : undefined });
    });
    return { curves, points, chev, dashed };
  }
  // where a boundary's orientation is shown: the parameter whose point and image both sit well inside their panels,
  // clear of the cross axes, of their crossing and of their tick labels in both panels (a piece that lies on an axis,
  // the real axis of a half-plane or the rays of a quarter plane, gets its mark between two ticks, away from 0); then
  // the middle of the piece's visible part. A long piece (a line or a ray, clipped far outside the window) is also
  // sampled densely where it crosses the source window. pn = {L: {box, st: [sx, sy]}, R: ...}
  function clipSeg(a, b, w) {
    let t0 = 0, t1 = 1;
    const dx = b.re - a.re, dy = b.im - a.im;
    for (const [p, q] of [[-dx, a.re - w.x0], [dx, w.x1 - a.re], [-dy, a.im - w.y0], [dy, w.y1 - a.im]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return t1 > t0 ? [t0, t1] : null;
  }
  function chevronAt(c, FL, FR, pL, pR, srcWin) {
    const inside = (w, b, m) => fin(w) && w.re > b.x0 + m * (b.x1 - b.x0) && w.re < b.x1 - m * (b.x1 - b.x0) && w.im > b.y0 + m * (b.y1 - b.y0) && w.im < b.y1 - m * (b.y1 - b.y0);
    // the clearance of a mark at w in a panel (fractions of the panel): from the nearer axis (enough at 12 %), from
    // the axes' crossing (enough at 24 %), and, on an axis, from its labelled ticks (best half way between two)
    const clear = (w, p) => {
      const b = p.box, W = b.x1 - b.x0, H = b.y1 - b.y0;
      const hasX = b.y0 < 0 && b.y1 > 0, hasY = b.x0 < 0 && b.x1 > 0;
      const dX = hasX ? Math.abs(w.im) / H : 1, dY = hasY ? Math.abs(w.re) / W : 1;
      const ox = Math.min(Math.max(0, b.x0), b.x1), oy = Math.min(Math.max(0, b.y0), b.y1);
      const dO = Math.hypot((w.re - ox) / W, (w.im - oy) / H);
      const half = (v, st) => (st > 0 ? 2 * Math.abs(v / st - Math.round(v / st)) : 1);
      const q = Math.min(dX < 0.04 ? half(w.re, p.st[0]) : 1, dY < 0.04 ? half(w.im, p.st[1]) : 1);
      return Math.min(0.12, dX, dY) + Math.min(0.12, 0.5 * dO) + 0.03 * q;
    };
    const ss = [];
    for (let i = 1; i < 240; i++) ss.push(i / 240);
    if (c.long && c.a && c.b && srcWin) { const iv = clipSeg(c.a, c.b, srcWin); if (iv) for (let i = 1; i < 240; i++) ss.push(iv[0] + (iv[1] - iv[0]) * i / 240); }
    const ok = [];
    for (const s of ss) {
      const z = c.f(s), a = FL(z), b = FR ? FR(z) : a;
      if (!inside(a, pL.box, 0.05) || (FR && !inside(b, pR.box, 0.05))) continue;
      ok.push({ s, cl: Math.min(clear(a, pL), FR ? clear(b, pR) : 1) });
    }
    if (!ok.length) return null;
    const s0 = Math.min(...ok.map((q) => q.s)), s1 = Math.max(...ok.map((q) => q.s)), mid = (s0 + s1) / 2, span = s1 - s0 || 1;
    let best = null;
    for (const q of ok) { const sc = 0.2 * Math.abs(q.s - mid) / span - q.cl; if (!best || sc < best.sc) best = { sc, s: q.s }; }
    return best.s;
  }
  // the sense of a boundary piece at s: +1 when its set lies on the left of increasing s, -1 on the right (an inner
  // boundary, the circle of a complement, the second ray of a sector). The arrowheads say "the set stays on the left"
  // (DESIGN.md), so a piece of sense -1 is marked against its parameter. L: the shape's level function (> 0 inside).
  function senseAt(c, L, s, win) {
    if (typeof L !== 'function') return 1;
    const z = c.f(s), za = c.f(Math.max(0, s - 1e-4)), zb = c.f(Math.min(1, s + 1e-4));
    if (!fin(z) || !fin(za) || !fin(zb)) return 1;
    const dx = zb.re - za.re, dy = zb.im - za.im, l = Math.hypot(dx, dy);
    if (!(l > 0)) return 1;
    const span = win ? Math.hypot(win.x1 - win.x0, win.y1 - win.y0) : 1 + Math.hypot(z.re, z.im);
    let v = 0;
    for (const k of [1e-4, 1e-3, 1e-2]) {
      const e = k * span, nx = -dy / l * e, ny = dx / l * e;
      let a = NaN, b = NaN;
      try { a = L(C(z.re + nx, z.im + ny)); b = L(C(z.re - nx, z.im - ny)); } catch (err) { /* */ }
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) v += a > b ? 1 : -1;
    }
    return v < 0 ? -1 : 1;
  }
  const chevMark = (X, Y, c, F, s, color, lw, sense = 1) => {
    const z = c.f(s), a = F(z);
    if (!fin(a)) return '';
    const ax = X(a.re), ay = Y(a.im);
    // the direction of travel at s in the panel, from a step short enough to follow a curved image (< 0.5 pt)
    let bx = NaN, by = NaN;
    for (let h = 1e-3, k = 0; k < 24; k++, h /= 4) {
      const b = F(c.f(Math.max(0, Math.min(1, s + sense * h))));
      if (!fin(b)) continue;
      bx = X(b.re); by = Y(b.im);
      if (Math.hypot(bx - ax, by - ay) < 0.5) break;
    }
    if (!Number.isFinite(bx) || Math.hypot(bx - ax, by - ay) < 1e-9) return '';
    return XD.chevron(ax, ay, Math.atan2(by - ay, bx - ax), 3.8, color, lw);
  };

  // the export window of a view without its pane: a reference pane of 480 x 360 CSS px at the view's centre and scale
  const REF_PANE = [480, 360];
  const sceneWin = (v) => ({ x0: v.cx - REF_PANE[0] / 2 / v.s, x1: v.cx + REF_PANE[0] / 2 / v.s, y0: v.cy - REF_PANE[1] / 2 / v.s, y1: v.cy + REF_PANE[1] / 2 / v.s });
  // Y's window: the box of the image under FR of what X's panel shows (the areas, curves and points whose FL lies in
  // boxL), 0.5 % trimmed at each end (a pole), plus 8 % of each side; null when nothing shows
  function imageWin(FL, FR, boxL, srcWin, shapes) {
    const xs = [], ys = [];
    const inL = (a) => fin(a) && a.re >= boxL.x0 && a.re <= boxL.x1 && a.im >= boxL.y0 && a.im <= boxL.y1;
    const keep = (z) => { let a, b; try { a = FL(z); if (!inL(a)) return; b = FR(z); } catch (e) { return; } if (fin(b)) { xs.push(b.re); ys.push(b.im); } };
    const lv = [];
    for (const s of shapes) {
      const t = kindType(s);
      if (t === 'area') { try { lv.push(Region.levelOf(s)); } catch (e) { /* */ } }
      else if (t === 'point') { if (s.p) keep(C(s.p[0], s.p[1])); }
      else { try { for (const c of Region.curvesOf(s, srcWin) || []) for (const p of srcPoly(c, 720)) keep(C(p[0], p[1])); } catch (e) { /* */ } }
    }
    if (lv.length) {
      const n = 160, dx = (srcWin.x1 - srcWin.x0) / n, dy = (srcWin.y1 - srcWin.y0) / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const z = C(srcWin.x0 + (i + 0.5) * dx, srcWin.y0 + (j + 0.5) * dy);
        if (lv.some((L) => { try { return L(z) >= 0; } catch (e) { return false; } })) keep(z);
      }
    }
    if (xs.length < 8) return null;
    xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
    const k = Math.floor(0.005 * xs.length), b = { x0: xs[k], x1: xs[xs.length - 1 - k], y0: ys[k], y1: ys[ys.length - 1 - k] };
    const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    if (!(span > 0)) return null;
    const px = 0.08 * Math.max(b.x1 - b.x0, 0.25 * span), py = 0.08 * Math.max(b.y1 - b.y0, 0.25 * span);
    return { x0: b.x0 - px, x1: b.x1 + px, y0: b.y0 - py, y1: b.y1 + py };
  }

  // ---------- (1) X -> Y: two plane panels and the F arrow (or one of them) ----------
  async function figXY(o, P, W, T, view0) {
    const st = A.state();
    const panels = o.panels === 'L' ? ['L'] : o.panels === 'R' ? ['R'] : ['L', 'R'];
    const [tp, lp] = T;
    const shapes = A.shapes();
    const planeOf = (side) => (side === 'L' ? st.lFlat : st.rImage);
    const Fs = { L: A.F('L'), R: A.F('R') };
    const vars = { L: A.panelVar('L'), R: A.panelVar('R') };
    // windows: Fit (content, from a quick render and the curves) or As on screen. Fit does not depend on the panes'
    // sizes (a phone, a tablet, a wide window give one figure): X's window comes from its view (centre, scale) and a
    // fixed reference pane (sceneWin); Y's from the image of what X's panel shows (imageWin). A set that runs off a
    // side keeps that window's edge there.
    const scene = o.crop !== 'screen' && A.viewOf;
    const srcWin = scene ? expandBox(sceneWin(A.viewOf('L0')), 3) : expandBox(A.screenBox('L0'), 3);
    const boxes = {}, touches = {};
    const roughW = W / panels.length;
    for (const side of panels) {
      if (!planeOf(side)) continue;
      if (!scene) { boxes[side] = snapScreen(A.screenBox(side), roughW); continue; }
      let ref = null;
      if (side === 'R') {
        // (only Y shown: the image of X's reference window, in the source plane)
        const bL = boxes.L || (st.lFlat ? null : sceneWin(A.viewOf('L0')));
        ref = imageWin(boxes.L ? Fs.L : (z) => z, Fs.R, bL || sceneWin(A.viewOf('L0')), srcWin, shapes);
      }
      if (!ref) ref = sceneWin(A.viewOf(side));
      // the quick render looks twice as far as the window, so a bounded set is framed whole and an unbounded one is
      // told by touching this larger window's edges
      const big = expandBox(ref, 2);
      const q = await A.art(side, { box: big, wpt: 300, dpi: 72, ink: printInkFor(o, st.alpha), alive: o.alive });
      if (!q) return null;
      let cb = contentBox(q, big), must = null;
      for (const s of shapes) {
        if (kindType(s) === 'area') continue;
        if (kindType(s) === 'point') { const w = Fs[side](C(s.p[0], s.p[1])); if (fin(w) && w.re >= big.x0 && w.re <= big.x1 && w.im >= big.y0 && w.im <= big.y1) { cb = unionBox(cb, { x0: w.re, x1: w.re, y0: w.im, y1: w.im }); must = unionBox(must, { x0: w.re, x1: w.re, y0: w.im, y1: w.im }); } continue; }
        const b = ptsBox(shapeCurves(s, Fs[side], big, 300, srcWin).pts, big);
        if (b) {
          const ex = 0.01;
          b.touch = { l: b.x0 <= big.x0 + ex * (big.x1 - big.x0), r: b.x1 >= big.x1 - ex * (big.x1 - big.x0), b: b.y0 <= big.y0 + ex * (big.y1 - big.y0), t: b.y1 >= big.y1 - ex * (big.y1 - big.y0) };
          cb = unionBox(cb, b);
        }
      }
      if (cb && must && shapes.some((x) => x.def || x.at)) cb = Object.assign({}, cb, { must });   // (constructions: picture-9)
      boxes[side] = fitBox(cb, ref, roughW);
      touches[side] = cb && cb.touch;
    }
    const axes = o.axes || P.axes;
    const two = panels.length === 2;
    const mirror = two && axes === 'box' && W < 300;
    const steps = {};
    for (const side of panels) if (boxes[side]) steps[side] = stepFor(boxes[side], two ? W / 2 : W);
    // the F arrow's label: F (Article), w = formula (Homework, when it is short)
    const Fname = A.fTex();
    let arrowTex = two ? Fname : null;
    if (two && o.for !== 'article') {
      // w = \dfrac{..}{..} when the formula is one fraction (narrow), else the inline formula when it is short
      const raw = A.formulaRaw ? A.formulaRaw() : null, f = A.formulaTex();
      const cands = [];
      // (named by the image panel's variable, w or w_k, as its axes are)
      if (raw && /^\\frac\{/.test(raw) && raw.length < 90) cands.push(`${vars.R}=${raw.replace(/^\\frac/, '\\dfrac')}`);
      if (f && f.length < 60) cands.push(`${vars.R}=${f}`);
      for (const c of cands) if (XD.tex(c, lp).w < W * 0.2) { arrowTex = c; break; }
    }
    const arrowLab = arrowTex ? XD.tex(arrowTex, lp) : null;
    const arrowSpan = two ? Math.max(axes === 'box' ? 22 : 26, arrowLab ? arrowLab.w + 12 : 0) : 0;
    const titles = (side) => [`\\operatorname{Re} ${vars[side]}`, `\\operatorname{Im} ${vars[side]}`];
    const ah = 4.6;
    const asp = (side) => (boxes[side] ? aspect(boxes[side]) : A.paneAspect(side));
    let mL, gut, mR, top, bottom;
    if (axes === 'box') {
      mL = boxes[panels[0]] ? tickW(boxes[panels[0]], steps[panels[0]], tp) + 3 : 2;
      const bL = two && !mirror && boxes.R ? tickW(boxes.R, steps.R, tp) + 3 : 0;
      gut = two ? arrowSpan + 10 + bL : 0;
      const last = panels[panels.length - 1];
      mR = mirror && boxes.R ? tickW(boxes.R, steps.R, tp) + 3 : Math.max(2, boxes[last] ? overR(boxes[last], steps[last], tp) : 0);
      top = lp * 1.15 + 3; bottom = tp * 1.05 + 4.2;
    } else {
      const nA = XD.tex(titles(panels[0])[0], lp).w, nB = two ? XD.tex(titles('R')[0], lp).w : 0;
      mL = 3; gut = two ? ah * 0.3 + 2 + nA + 8 + arrowSpan + 8 : 0; mR = ah * 0.3 + 2 + (two ? nB : nA) + 2;
      const t1 = XD.tex(titles(panels[0])[1], lp);
      top = t1.a + t1.d + ah + 5; bottom = 3;
    }
    let h = (W - mL - gut - mR) / panels.reduce((a, s) => a + asp(s), 0);
    h = Math.min(h, W * (two ? 0.62 : 0.8), P.maxH - top - bottom);
    const used = mL + gut + mR + h * panels.reduce((a, s) => a + asp(s), 0);
    const x0 = (W - used) / 2;
    const items = [], lines = [];
    let defs = '';
    const xs = {}; let xc = x0 + mL;
    for (const side of panels) { xs[side] = xc; xc += h * asp(side) + gut; }
    const y = top;
    const panelOut = {};
    let chevDrawn = 0;
    for (const [i, side] of panels.entries()) {
      const wpt = h * asp(side), x = xs[side];
      if (!boxes[side]) {
        // a globe: the picture as on screen, no axes
        const r = await A.art(side, { wpt, hpt: h, dpi: 300, ink: printInkFor(o, st.alpha), alive: o.alive });
        if (!r) return null;
        const bx = { x0: 0, x1: 1, y0: 0, y1: h / wpt };
        const a = await XD.art(r, bx, { mode: o.ink === 'bw' ? 'grey' : 'rgb', wpt });
        items.push(`<image x="${f2(x)}" y="${f2(y)}" width="${f2(wpt)}" height="${f2(h)}" preserveAspectRatio="none" xlink:href="${a.url}"/>`);
        // (round 3: the art layer leaves the globe's marks out; its labels and the points' images are vectors)
        if (r.globe) {
          const c = [0, r.w, 0, r.h], k = wpt / r.w, proj = globeProj(r.globe, r, c, x, y, k);
          const Fp = side === 'R' && A.defo && A.defo().on ? A.homF(A.defo().T) : Fs[side];
          if (!(view0 === 'xyL' && st.main === 'phase')) items.push(shapes.filter((s) => kindType(s) === 'point' && s.p).map((s, q) => { const e = proj(Fp(C(s.p[0], s.p[1]))); return e ? XD.marker('dot', e[0], e[1], 1.6, o.ink === 'bw' ? '#000000' : PTS[q % 4][1], '#ffffff', 0.4) : ''; }).join(''));
          items.push(globeLabels(r.globe, r, c, x, y, k, tp - 1));
        }
        if (two && axes === 'box') items.push(head(x, x + wpt, y - 3, panelLetter(i), vars[side], lp));
        continue;
      }
      const bx = boxes[side];
      const tch = touches[side] || {};
      const fade = P.fade && axes !== 'box' && tch ? { l: tch.l ? 8 : 0, r: tch.r ? 8 : 0, t: tch.t ? 8 : 0, b: tch.b ? 8 : 0 } : null;
      const art = await artPanel(side, bx, wpt, o, { fade: fade && (fade.l || fade.r || fade.t || fade.b) ? fade : null });
      if (!art) return null;
      const lay = planeLayers(o, P, side, Fs[side], bx, wpt, shapes, srcWin, side === 'R' && two ? (P.named ? "'" : Fname) : null);
      panelOut[side] = { lay, art };
      const over = (X, Y) => {
        let m = '';
        if (P.chevrons) for (const c of lay.chev) {
          const pn = (sd) => ({ box: boxes[sd] || bx, st: XD.axisSteps(boxes[sd] || bx, steps[sd] || steps[side]) });
          const s0 = chevronAt(c.c, two ? Fs.L : Fs[side], two ? Fs.R : null, two ? pn('L') : pn(side), pn('R'), srcWin);
          let L = null;
          try { L = Region.levelOf(c.s); } catch (e) { L = null; }
          const cm = s0 != null ? chevMark(X, Y, c.c, Fs[side], s0, c.color, 0.8, senseAt(c.c, L, s0, srcWin)) : '';
          if (cm) { m += cm; chevDrawn++; }
        }
        return m;
      };
      const p = XD.panel({ x, y, w: wpt, h, box: bx, step: steps[side], art: [art], curves: lay.curves, points: lay.points, axes, minimal: P.minimal, ylab: side === 'R' && mirror ? 'right' : 'left', tickPt: tp, labelPt: lp, ink: '#000000', lw: P.lw, axisTitles: titles(side), over });
      items.push(p.markup); defs += p.defs; lines.push(...p.lines);
      if (axes === 'box') items.push(head(x, x + wpt, y - 3, two ? panelLetter(i) : '', vars[side], lp));
      else if (axes === 'none') items.push(head(x, x + wpt, y - 3, '', vars[side], lp));
    }
    if (two) {
      // (cross axes: the arrow keeps clear of both real axes, so it never reads as their continuation)
      const oys = axes === 'box' ? [] : panels.filter((sd) => boxes[sd]).map((sd) => { const b = boxes[sd]; return Math.min(y + h, Math.max(y, y + (b.y1 / (b.y1 - b.y0)) * h)); });
      const lab = arrowLab ? arrowLab.a + arrowLab.d + 3 : 0;
      const ay = [0.5, 0.36, 0.64, 0.24, 0.76, 0.14, 0.86].map((f) => y + f * h).find((v) => oys.every((oy) => v - oy > lab + 6 || oy - v > 6)) || y + h / 2;
      let a0, a1;
      if (axes === 'box') { a0 = xs.L + h * asp('L') + 5; a1 = a0 + arrowSpan; }
      else { a0 = xs.L + h * asp('L') + ah * 0.3 + 2 + XD.tex(titles('L')[0], lp).w + 8; a1 = xs.R - 8; }
      items.push(XD.mapArrow(a0, a1, ay, arrowTex, lp, P.lw.arrow, '#000000'));
    }
    const H = y + h + bottom;
    // the caption's "Dashed" note: only when a dashed (open) boundary is actually drawn
    const open = Object.values(panelOut).some((q) => q.lay.dashed > 0);
    return { items, defs, lines, H, info: { boxes, open, named: P.named && shapes.some((s) => kindType(s) === 'point'), chevrons: P.chevrons && chevDrawn > 0, panels } };
  }

  // ---------- (2) Phase: colour (hue wheel, level lines, a ring key) and black and white (a contour portrait) ----------
  // level sets arg f = k pi/6 by marching squares on an n x n grid (branch jumps of arg excluded)
  // (round 3: in slices, a yield once 8 ms have passed and after each level, so no task holds the page near 50 ms; the
  // same lines as before)
  async function argLevels(F, box, n, ks) {
    const G = [], V = [], dx = (box.x1 - box.x0) / n, dy = (box.y1 - box.y0) / n;
    let t0 = performance.now();
    for (let j = 0; j <= n; j++) {
      const r = new Float64Array(n + 1), v = new Array(n + 1); for (let i = 0; i <= n; i++) { const w = F(C(box.x0 + i * dx, box.y0 + j * dy)); r[i] = fin(w) ? Math.atan2(w.im, w.re) : NaN; v[i] = w; } G.push(r); V.push(v);
      if (performance.now() - t0 > 8) { await breathe(); t0 = performance.now(); }
    }
    // (export review r3, editor-20) an edge across a branch cut is not crossed by a level line: there F jumps, and its
    // midpoint value is far from the mean of the ends (a continuous F is within its second difference of it). The
    // test is made once per edge, only where a level crosses
    const cont = new Map();
    const smooth = (a, b, A0, B0) => {
      const key = a[1] === b[1] ? `h${a[1]},${Math.min(a[0], b[0])}` : `v${a[0]},${Math.min(a[1], b[1])}`;
      if (cont.has(key)) return cont.get(key);
      const wa = V[a[1]][a[0]], wb = V[b[1]][b[0]], m = F(C(box.x0 + (a[0] + b[0]) / 2 * dx, box.y0 + (a[1] + b[1]) / 2 * dy));
      const ok = !fin(m) || !fin(wa) || !fin(wb) || Math.hypot(m.re - (wa.re + wb.re) / 2, m.im - (wa.im + wb.im) / 2) <= 0.25 * Math.hypot(wa.re - wb.re, wa.im - wb.im) + 1e-12 * (Math.hypot(wa.re, wa.im) + Math.hypot(wb.re, wb.im));
      cont.set(key, ok);
      return ok;
    };
    const out = {};
    for (const k of ks) {
      await breathe();
      const th = k * Math.PI / 6, segs = [];
      const g = (v) => { let d = v - th; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI; return d; };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => [a, b, g(G[b][a])]);
        if (c.some((q) => !Number.isFinite(q[2]))) continue;
        const pts = [];
        for (let e = 0; e < 4; e++) {
          const P1 = c[e], P2 = c[(e + 1) % 4];
          if ((P1[2] < 0) !== (P2[2] < 0) && Math.abs(P1[2] - P2[2]) < Math.PI && smooth(P1, P2)) { const s = P1[2] / (P1[2] - P2[2]); pts.push([box.x0 + (P1[0] + s * (P2[0] - P1[0])) * dx, box.y0 + (P1[1] + s * (P2[1] - P1[1])) * dy]); }
        }
        if (pts.length >= 2) segs.push([pts[0], pts[1]]);
        if (pts.length === 4) segs.push([pts[2], pts[3]]);
      }
      out[k] = joinSegs(segs);
    }
    return out;
  }
  // chain the cell segments into polylines, so dash patterns run along a whole level line
  function joinSegs(segs) {
    const key = (p) => `${p[0].toFixed(9)},${p[1].toFixed(9)}`, ends = new Map(), used = new Uint8Array(segs.length);
    segs.forEach((s, i) => { for (const e of [0, 1]) { const k = key(s[e]); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
    const lines = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; used[i] = 1;
      const line = [segs[i][0], segs[i][1]];
      for (const dir of [1, 0]) {
        for (;;) {
          const tip = dir ? line[line.length - 1] : line[0], nb = (ends.get(key(tip)) || []).find((j) => !used[j]);
          if (nb == null) break;
          used[nb] = 1; const s2 = segs[nb], nxt = key(s2[0]) === key(tip) ? s2[1] : s2[0];
          if (dir) line.push(nxt); else line.unshift(nxt);
        }
      }
      lines.push(line);
    }
    return lines;
  }
  // grey modulus bands for B/W: floor(log2|f|) even -> grey 12 %, odd -> white
  async function bandsArt(F, box, wpt, dpi) {
    const w = Math.round(wpt * dpi / 72), h = Math.round(w * (box.y1 - box.y0) / (box.x1 - box.x0)), lum = new Uint8Array(w * h);
    // (round 3: row by row, with a yield once 8 ms have passed)
    let t0 = performance.now();
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const f = F(C(box.x0 + (i + 0.5) / w * (box.x1 - box.x0), box.y1 - (j + 0.5) / h * (box.y1 - box.y0))), m = Math.log2(Math.hypot(f.re, f.im));
        lum[j * w + i] = Number.isFinite(m) && (Math.floor(m) & 1) === 0 ? 0xE0 : 0xFF;
      }
      if (performance.now() - t0 > 8) { await breathe(); t0 = performance.now(); }
    }
    const png = await XD.encodePNG({ w, h, type: 0, data: lum });
    return { url: 'data:image/png;base64,' + b64(png), box, lum, w, h, enc: 'grey', bytes: png.length, dpi };
  }
  // the ring key: the app's hue wheel on an annulus, as an RGB raster at dpi
  async function ringKey(Rpt, dpi) {
    const n = Math.round(2 * Rpt * dpi / 72), rgb = new Uint8Array(n * n * 3).fill(255);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n * 2 - 1, v = 1 - (j + 0.5) / n * 2;
      const t = (Math.atan2(v, u) + Math.PI) / (2 * Math.PI), c = A.hue(t);
      rgb.set(c, 3 * (j * n + i));
    }
    const png = await XD.encodePNG({ w: n, h: n, type: 2, data: rgb });
    return 'data:image/png;base64,' + b64(png);
  }
  // zeros and poles of F in a box (Calc.zerosPoles), bounded in time
  function zerosPoles(F, box) {
    if (!Calc.zerosPoles) return [];
    try { return (Calc.zerosPoles(F, box, { target: null, max: 24, budget: 120000, grid: 24, deadline: performance.now() + 400 }) || []).filter((r) => r && r.z && fin(r.z)); } catch (e) { return []; }
  }
  async function figPhase(o, P, W, T) {
    const [tp, lp] = T;
    const F = A.plotF();
    const scr = A.screenBox('L');
    const bw = o.ink === 'bw';
    // Fit: the zeros and poles with a margin of their spread (at least one unit), inside the screen window
    let zp = zerosPoles(F, scr), box = scr;
    if (o.crop !== 'screen' && zp.length) {
      let b = null; for (const r of zp) b = unionBox(b, { x0: r.z.re, x1: r.z.re, y0: r.z.im, y1: r.z.im });
      const span = Math.max(b.x1 - b.x0, b.y1 - b.y0, 1), m = 0.5 * span;
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, half = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + m;
      box = { x0: Math.max(scr.x0, cx - half), x1: Math.min(scr.x1, cx + half), y0: Math.max(scr.y0, cy - half), y1: Math.min(scr.y1, cy + half) };
      const stp = stepFor(box, W) / 2;
      box = { x0: Math.floor(box.x0 / stp) * stp, x1: Math.ceil(box.x1 / stp) * stp, y0: Math.floor(box.y0 / stp) * stp, y1: Math.ceil(box.y1 / stp) * stp };
      zp = zerosPoles(F, box);
    } else box = snapScreen(scr, W);
    const dc0 = A.capParts().dc || 'enhanced', keyW = bw || dc0 === 'classic' || dc0 === 'cauchy' ? 0 : Math.min(64, W * 0.2);
    const step = stepFor(box, W - keyW);
    const mL = tickW(box, step, tp) + 3, top = lp * 1.15 + 3, bottom = tp * 1.05 + 4.2;
    let w = W - mL - Math.max(4, keyW ? 4 : overR(box, step, tp)) - keyW, h = w / aspect(box);
    const hmax = Math.min(W * 0.95, P.maxH - top - bottom);
    if (h > hmax) { h = hmax; w = h * aspect(box); }
    const x = (W - keyW - w - mL - 4) / 2 + mL;
    let art;
    if (bw) art = await bandsArt(F, box, w, 300);
    else { art = await artPanel('L', box, w, Object.assign({}, o, { ink: 'colour' }), { mode: 'rgb', dpi: 300 }); if (!art) return null; }
    // the level lines, on a grid fine enough for 0.5 pt cells (bounded by the cost of F)
    const t0 = performance.now(); for (let i = 0; i < 50; i++) F(C(box.x0 + i * 0.013, box.y0 + i * 0.017)); const per = (performance.now() - t0) / 50;
    const n = Math.max(60, Math.min(240, Math.floor(Math.sqrt(400 / Math.max(per, 1e-4)))));
    const dc = (A.capParts().dc) || 'enhanced', ownLines = !bw && (dc === 'modulus' || dc === 'grid' || dc === 'classic' || dc === 'cauchy');
    const ks = ownLines ? [] : [...Array(12).keys()].map((k) => k - 5);
    const L = await argLevels(F, box, n, ks);
    const curves = [];
    for (const k of ks) {
      const heavy = k === 0, pi = k === 6;
      if (bw) curves.push({ pts: L[k], w: heavy || pi ? 0.7 : 0.35, color: '#000000', dash: pi ? '3 2' : null, cap: 'butt', noObst: true });
      else curves.push({ pts: L[k], w: 0.35, color: '#1a1a1a', cap: 'butt', noObst: true });
    }
    const points = zp.map((r) => (r.kind === 'pole' ? { z: [r.z.re, r.z.im], kind: 'ring', r: 1.7, sw: 0.7 } : { z: [r.z.re, r.z.im], r: 1.6, fill: '#000000', stroke: '#ffffff', sw: 0.5 }));
    // the steps view's stage draws the shapes on its plane, so its figure does too
    if (A.svOn()) { const lay = planeLayers(o, P, 'L', A.F('L'), box, w, A.shapes(), expandBox(A.screenBox('L0'), 3), null); curves.push(...lay.curves); points.push(...lay.points); }
    const p = XD.panel({ x, y: top, w, h, box, step, art: [art], curves, points, axes: o.axes === 'cross' ? 'cross' : 'box', ylab: 'left', tickPt: tp, labelPt: lp, ink: '#000000', lw: P.lw, axisTitles: [`\\operatorname{Re} ${A.panelVar('L')}`, `\\operatorname{Im} ${A.panelVar('L')}`] });
    const items = [p.markup, head(x, x + w, top - 3, '', A.panelVar('L'), lp)];
    if (keyW) {
      const kx = x + w + 6 + keyW / 2, ky = top + h / 2, R = keyW / 2 - 13, r0 = R * 0.55, kid = `${XD.ns}-key`;
      const url = await ringKey(R, 300);
      items.push(`<clipPath id="${kid}"><path d="M${f2(kx - R)} ${f2(ky)}a${f2(R)} ${f2(R)} 0 1 0 ${f2(2 * R)} 0a${f2(R)} ${f2(R)} 0 1 0 ${f2(-2 * R)} 0ZM${f2(kx - r0)} ${f2(ky)}a${f2(r0)} ${f2(r0)} 0 1 1 ${f2(2 * r0)} 0a${f2(r0)} ${f2(r0)} 0 1 1 ${f2(-2 * r0)} 0Z" clip-rule="evenodd"/></clipPath>`
        + `<image x="${f2(kx - R)}" y="${f2(ky - R)}" width="${f2(2 * R)}" height="${f2(2 * R)}" preserveAspectRatio="none" clip-path="url(#${kid})" xlink:href="${url}"/>`
        + `<circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(R)}" fill="none" stroke="#000000" stroke-width="0.5"/><circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(r0)}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
      items.push(XD.at(XD.tex('0', tp), kx + R + 1.5, ky, 'start', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\pi/2', tp), kx, ky - R - 1.5, 'middle', 'bottom', 'key'));
      items.push(XD.at(XD.tex('\\pm\\pi', tp), kx - R - 1.5, ky, 'end', 'mid', 'key'));
      items.push(XD.at(XD.tex('-\\pi/2', tp), kx, ky + R + 1.5, 'middle', 'top', 'key'));
      items.push(XD.at(XD.tex(`\\arg ${A.fname()}`, tp), kx, ky - R - 12, 'middle', 'bottom', 'key'));
    }
    return { items, defs: p.defs, lines: p.lines, H: top + h + bottom, info: { box, zp, bw, art } };
  }

  // ---------- (3) Landscape: one 3D panel, cropped to the relief, a clean frame and vector floor labels ----------
  async function figLand(o, P, W, T) {
    const [tp, lp] = T;
    const asp = A.paneAspect('L');
    const wpt = W - 8, hpt = wpt * Math.min(asp, 0.8);
    // the window: the screen's, with its edges rounded (to a step of about an eighth of each side), so the caption and
    // the floor labels read [-8, 8] x [-5, 5], not [-8.33, 8.33] x [-5.13, 5.13]
    let landBox = null;
    const lb = A.landBox ? A.landBox() : null;
    if (lb && [lb.x0, lb.x1, lb.y0, lb.y1].every(Number.isFinite)) {
      const rnd = (a0, a1) => { const st = niceStep(a1 - a0, 8), b0 = Math.round(a0 / st) * st, b1 = Math.round(a1 / st) * st; return b1 > b0 ? [b0, b1] : [a0, a1]; };
      const [x0, x1] = rnd(lb.x0, lb.x1), [y0, y1] = rnd(lb.y0, lb.y1);
      landBox = { x0, x1, y0, y1 };
    }
    // what is drawn (the relief and its block): the pixel bounds of the non-white
    const look = (r) => {
      let i0 = r.w, i1 = -1, j0 = r.h, j1 = -1;
      for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const q = 3 * (j * r.w + i); if (r.rgb[q] < 232 || r.rgb[q + 1] < 232 || r.rgb[q + 2] < 232) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
      return [i0, i1, j0, j1];
    };
    let r = await A.art('L', { wpt, hpt, dpi: 300, ink: printInkFor(o, A.state().alpha), alive: o.alive, landBox });
    if (!r) return null;
    {
      // the crop is enlarged to the panel (up to 1.6 x): rendered again at 300 dpi times that, so the printed image
      // stays at 300 ppi or more
      const [a0, a1] = look(r), kk = wpt / r.w, cwpt = a1 >= a0 ? (a1 - a0 + 36 / kk) * kk : wpt;
      const up = Math.min((W - 8) / cwpt, 1.6);
      if (up > 1.02) { const r2 = await A.art('L', { wpt, hpt, dpi: Math.ceil(300 * up), ink: printInkFor(o, A.state().alpha), alive: o.alive, landBox }); if (!r2) return null; r = r2; }
    }
    // crop to what is drawn, with a margin for the floor labels
    const unit = { x0: 0, x1: r.w, y0: 0, y1: r.h };
    let [i0, i1, j0, j1] = look(r);
    const L0 = r.land;
    if (L0 && L0.MVP && GLR.M4) {
      // the block's floor corners: the floor labels sit just outside them
      const [ax0, ay0] = L0.aspect || [1, 1];
      for (const [cx0, cy0] of [[-ax0, -ay0], [ax0, -ay0], [ax0, ay0], [-ax0, ay0]]) {
        const c = GLR.M4.apply(L0.MVP, [cx0, cy0, L0.floorZ]);
        if (c[3] <= 1e-6) continue;
        const ii = (c[0] / c[3] * 0.5 + 0.5) * r.w, jj = (1 - (c[1] / c[3] * 0.5 + 0.5)) * r.h;
        i0 = Math.min(i0, ii); i1 = Math.max(i1, ii); j0 = Math.min(j0, jj); j1 = Math.max(j1, jj);
      }
    }
    if (i1 < 0) { i0 = 0; i1 = r.w - 1; j0 = 0; j1 = r.h - 1; }
    const k = wpt / r.w; // pt per pixel
    const pad = 18 / k;
    const c0 = Math.max(0, Math.floor(i0 - pad)), c1 = Math.min(r.w, Math.ceil(i1 + pad)), d0 = Math.max(0, Math.floor(j0 - pad * 0.4)), d1 = Math.min(r.h, Math.ceil(j1 + pad * 0.7));
    const cw = c1 - c0, ch = d1 - d0, rgb = new Uint8Array(cw * ch * 3);
    for (let j = 0; j < ch; j++) rgb.set(r.rgb.subarray(3 * ((j + d0) * r.w + c0), 3 * ((j + d0) * r.w + c0 + cw)), 3 * j * cw);
    const crop = { w: cw, h: ch, rgb };
    let scale = Math.min((W - 8) / (cw * k), 1.6);
    if (ch * k * scale > P.maxH - 8) scale = (P.maxH - 8) / (ch * k);
    const iw = cw * k * scale, ih = ch * k * scale;
    const x = (W - iw) / 2, top = 4;
    const art = await XD.art(crop, unit, { mode: o.ink === 'bw' ? 'grey' : 'rgb', wpt: iw });
    const items = [`<image x="${f2(x)}" y="${f2(top)}" width="${f2(iw)}" height="${f2(ih)}" preserveAspectRatio="none" xlink:href="${art.url}"/>`];
    items.push(`<rect x="${f2(x)}" y="${f2(top)}" width="${f2(iw)}" height="${f2(ih)}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
    const lines = [{ x0: x, y0: top, x1: x + iw, y1: top + ih, kind: 'frame' }];
    // floor labels: Re along the front edge, Im along the side edge, projected from the camera of the render
    const L = r.land;
    if (L && L.MVP && GLR.M4) {
      const proj = (p) => { const c = GLR.M4.apply(L.MVP, p); if (c[3] <= 1e-6) return null; const px = (c[0] / c[3] * 0.5 + 0.5) * L.w, py = (1 - (c[1] / c[3] * 0.5 + 0.5)) * L.h; const ii = px * r.w / L.w, jj = py * r.h / L.h; return [x + (ii - c0) * k * scale, top + (jj - d0) * k * scale]; };
      const [ax, ay] = L.aspect || [1, 1], z0 = L.floorZ, eye = L.eye || [1, 1, 1], bx = L.box;
      const sx = eye[0] < 0 ? -1 : 1, sy = eye[1] < 0 ? -1 : 1;
      const Xw = (v) => ((v - bx.x0) / (bx.x1 - bx.x0) - 0.5) * 2 * ax, Yw = (v) => ((v - bx.y0) / (bx.y1 - bx.y0) - 0.5) * 2 * ay;
      let tk = '';
      const edge = (vals, at, out, name) => {
        const stp = vals.step, dec = XD.decimals(stp);
        let mid = null, dirm = null;
        // the floor's front edge as an axis line (it lies in front of the relief)
        const e0 = proj(at(vals.lo)), e1 = proj(at(vals.hi));
        if (e0 && e1) tk += `M${f2(e0[0])} ${f2(e0[1])}L${f2(e1[0])} ${f2(e1[1])}`;
        for (const v of vals.list) {
          const p = at(v), a = proj(p), b = proj([p[0] + out[0] * 0.08, p[1] + out[1] * 0.08, z0]);
          if (!a || !b) continue;
          const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, u = [dx / l, dy / l];
          tk += `M${f2(a[0])} ${f2(a[1])}l${f2(u[0] * 2.5)} ${f2(u[1] * 2.5)}`;
          const it = XD.tex(XD.tickTex(v, dec), tp);
          const cx = a[0] + u[0] * (4.5 + Math.abs(u[0]) * it.w / 2), cy = a[1] + u[1] * (4.5 + Math.abs(u[1]) * (it.a + it.d) / 2);
          const bb = XD.boxOf(it, cx, cy, 'middle', 'mid');
          if (XD.boxes.some((q) => q.x0 < bb.x1 + 1 && q.x1 > bb.x0 - 1 && q.y0 < bb.y1 + 1 && q.y1 > bb.y0 - 1) || bb.x0 < x + 1 || bb.x1 > x + iw - 1 || bb.y1 > top + ih - 1) continue;
          items.push(XD.at(it, cx, cy, 'middle', 'mid', 'tick'));
          mid = mid || []; mid.push([cx, cy]); dirm = u;
        }
        if (mid && mid.length) {
          const m = mid[Math.floor(mid.length / 2)], it = XD.tex(name, lp);
          const cx = m[0] + dirm[0] * (it.w / 2 + 9), cy = m[1] + dirm[1] * (lp + 3);
          const bb = XD.boxOf(it, cx, cy, 'middle', 'mid');
          if (!XD.boxes.some((q) => q.x0 < bb.x1 + 1 && q.x1 > bb.x0 - 1 && q.y0 < bb.y1 + 1 && q.y1 > bb.y0 - 1) && bb.x0 > x + 1 && bb.x1 < x + iw - 1 && bb.y1 < top + ih - 1) items.push(XD.at(it, cx, cy, 'middle', 'mid', 'axis-name'));
        }
      };
      const tks = (a0, a1) => { const s = niceStep(a1 - a0, 4); return { step: s, list: XD.ticks(a0, a1, s), lo: a0, hi: a1 }; };
      const v = A.panelVar('L');
      edge(tks(bx.x0, bx.x1), (t) => [Xw(t), sy * ay, z0], [0, sy], `\\operatorname{Re} ${v}`);
      edge(tks(bx.y0, bx.y1), (t) => [sx * ax, Yw(t), z0], [sx, 0], `\\operatorname{Im} ${v}`);
      if (tk) items.push(`<path d="${tk}" stroke="#000000" stroke-width="0.5" fill="none" stroke-linecap="round"/>`);
    }
    return { items, defs: '', lines, H: top + ih + 4, info: { box: L && L.box, art } };
  }

  // ---------- (4) The deformation: a filmstrip of H_t, or the one-plane paths figure ----------
  async function figFilm(o, P, W, T) {
    const st = A.state();
    const [tp, lp] = T;
    const m = A.morphLen(), n = 4;
    const ts = [...Array(n).keys()].map((i) => i * m / (n - 1));
    const fracTex = (t) => { const q = t / m * 3; if (m === 1) return ['0', '1/3', '2/3', '1'][Math.round(q)] || (I18 && I18.comma(XD.lang) ? I18.texNum(CX.fmtNum(t, 2), XD.lang) : CX.fmtNum(t, 2)); return Math.abs(t - Math.round(t)) < 1e-9 ? String(Math.round(t)) : `${Math.round(t * 3)}/3`; };
    const shapes = A.shapes(), srcWin = expandBox(A.screenBox('L0'), 3);
    const scr = A.screenBox('R');
    const cols = W >= 400 || o.for === 'slides' ? 4 : 2, rows = n / cols;
    const roughW = (W - 30) / cols;
    // the shared window: the union of the frames' content, inside the screen window
    let cb = null;
    if (o.crop !== 'screen') for (const t of ts) {
      const q = await A.art('R', { box: scr, wpt: 120, dpi: 72, ink: printInkFor(o, st.alpha), T: t, alive: o.alive });
      if (!q) return null;
      cb = unionBox(cb, contentBox(q, scr));
    }
    const box = o.crop === 'screen' || !cb ? snapScreen(scr, roughW) : fitBox(cb, scr, roughW);
    const step = stepFor(box, roughW);
    const mL = tickW(box, step, tp) + 3, gap = 8, mR = Math.max(2, XD.tex(XD.tickTex(XD.ticks(box.x0, box.x1, step).pop() || 0, XD.decimals(step)), tp).w / 2 + 1);
    let pw = (W - mL - gap * (cols - 1) - mR) / cols, ph = pw / aspect(box);
    const hmax = Math.min((W * 0.5) / rows, (P.maxH - rows * (lp * 1.4 + tp * 1.05 + 9)) / rows);
    if (ph > hmax) { ph = hmax; pw = ph * aspect(box); }
    const x0 = (W - (mL + cols * pw + (cols - 1) * gap + mR)) / 2;
    const titles = ts.map((t, i) => XD.tex(XD.lang === 'ru' ? `\\textit{${RU_LETTERS[i]}}\\enspace t=${fracTex(t)}` : `\\text{(${String.fromCharCode(97 + i)})}\\enspace t=${fracTex(t)}`, lp));
    const dmax = Math.max(...titles.map((it) => it.d)), amax = Math.max(...titles.map((it) => it.a));
    const rowH = amax + dmax + 4 + ph + tp * 1.05 + 4.2;
    const items = [], lines = []; let defs = '';
    // tracked points: the point shapes, else three points of the first boundary
    let tracked = shapes.filter((s) => kindType(s) === 'point' && s.p).slice(0, 4).map((s) => C(s.p[0], s.p[1]));
    if (!tracked.length) {
      const a = shapes.find((s) => kindType(s) !== 'point');
      if (a) { let cs = []; try { cs = Region.curvesOf(a, srcWin) || []; } catch (e) { cs = []; } const c = cs.find((q) => typeof q.f === 'function'); if (c) tracked = [0.3, 0.5, 0.7].map((s) => c.f(s)).filter((z) => fin(z) && z.re > box.x0 && z.re < box.x1 && z.im > box.y0 && z.im < box.y1); }
    }
    const Hs = new Map();
    const Hof = (t) => { const k = t.toFixed(6); if (!Hs.has(k)) Hs.set(k, A.homF(t)); return Hs.get(k); };
    const path = (z, a, b) => XD.sample((u) => { const w = Hof(u)(z); return fin(w) ? [w.re, w.im] : null; }, a, b, 48, 0.002 * (box.x1 - box.x0));
    let anyOpen = false;
    for (const [i, t] of ts.entries()) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + mL + col * (pw + gap), yT = row * rowH + amax + dmax + 4;
      const art = await artPanel('R', box, pw, o, { T: t });
      if (!art) return null;
      const Ht = Hof(t);
      const curves = [];
      // (export review r3, editor-9: X's boundary at t = 0 is a thin gray line; a dash means "not included", as in every
      // Homework figure)
      const H0f = A.defo().qp ? Hof(0) : (z) => z;   // (the bracket's start, H_0 = Q o P)
      if (t > 0) for (const s of shapes) if (kindType(s) === 'area') curves.push({ pts: shapeCurves(s, H0f, box, pw, srcWin).pts, w: 0.4, color: '#999999', cap: 'butt' });
      shapes.forEach((s, si) => {
        if (kindType(s) === 'point') return;
        const tn = tonesOf(s, o), open = P.dashOpen && kindType(s) === 'area' && Region.isOpen && Region.isOpen(s);
        if (open) anyOpen = true;
        curves.push({ pts: shapeCurves(s, Ht, box, pw, srcWin).pts, w: P.lw.edge, color: o.ink === 'bw' ? '#000000' : tn.edge, dash: open ? '3 2' : null, cap: 'butt' });
      });
      const tolW = 1.4 * (box.x1 - box.x0) / pw;
      tracked.forEach((z, k) => {
        // (the dotted rest leaves out what is already drawn: where a path doubles back, its two dotted runs would
        // overlap out of phase and read as clustered dots)
        if (t < m) curves.push({ pts: unclutter(path(z, t, m), t > 0 ? path(z, 0, t) : [], tolW), w: 0.7, color: '#444444', dash: '0 1.8', cap: 'round' });
        if (t > 0) curves.push({ pts: path(z, 0, t), w: 0.6, color: o.ink === 'bw' ? '#000000' : PTS[k % 4][1], casing: 0.4, cap: 'round' });
      });
      const points = tracked.map((z, k) => { const w = Ht(z); return fin(w) ? { z: [w.re, w.im], r: 1.9, kind: PTS[k % 4][0], fill: o.ink === 'bw' ? '#000000' : PTS[k % 4][1], label: null } : null; }).filter(Boolean);
      const p = XD.panel({ x, y: yT, w: pw, h: ph, box, step, art: [art], curves, points, axes: 'box', ylab: col === 0 ? 'left' : 'none', xtrim: { l: col > 0, r: col < cols - 1 }, tickPt: tp, labelPt: lp, ink: '#000000', lw: { frame: 0.5, tick: 0.5 } });
      items.push(p.markup); defs += p.defs; lines.push(...p.lines);
      items.push(XD.at(titles[i], x, yT - 3 - dmax, 'start', 'base', 'title'));
    }
    return { items, defs, lines, H: rows * rowH, info: { box, ts, tracked, m, labs: ts.map(fracTex), open: anyOpen } };
  }
  // polylines (world units) without the stretches within tol of the prior polylines or of their own earlier course
  function unclutter(segs, prior, tol) {
    const dense = (sg) => { const o = []; for (let i = 1; i < sg.length; i++) { const a = sg[i - 1], b = sg[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (tol / 3))); for (let k = i === 1 ? 0 : 1; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return o; };
    const P = prior.flatMap((sg) => dense(sg)), own = [], out = [], t2 = tol * tol, lag = 12;
    const near = (p, list, upto) => { for (let i = 0; i < upto; i++) { const q = list[i]; const dx = q[0] - p[0], dy = q[1] - p[1]; if (dx * dx + dy * dy < t2) return true; } return false; };
    for (const sg of segs) {
      let cur = [];
      for (const p of dense(sg)) {
        if (near(p, P, P.length) || near(p, own, Math.max(0, own.length - lag))) { if (cur.length > 1) out.push(cur); cur = []; }
        else cur.push(p);
        own.push(p);
      }
      if (cur.length > 1) out.push(cur);
    }
    return out;
  }
  // ---------- the deformation's paths as vectors (notes/paths-aesthetics/AS-BUILT.md; app.js pathsSvg draws them) ----------
  // t -> f(t) for t in [a, b] as runs of [x, y, t] (figure pt): n uniform times, each gap refined while its chord is
  // over 1.2 pt or its midpoint strays over 0.03 pt from it; a new run where f is null (the far side, a pole) or jumps
  // (a chord still over 12 pt at depth 12)
  function sampleRunsT(f, a, b, n = 64) {
    const ev = (t) => { const p = f(t); return p && isFinite(p[0]) && isFinite(p[1]) && Math.abs(p[0]) < 1e5 && Math.abs(p[1]) < 1e5 ? [p[0], p[1], t] : null; };
    const runs = []; let cur = [];
    const cut = () => { if (cur.length > 1) runs.push(cur); cur = []; };
    const rec = (p, q, d) => {
      const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
      if (d >= 12) { if (L > 12) cut(); cur.push(q); return; }
      const m = ev(0.5 * (p[2] + q[2]));
      if (!m) { cut(); cur.push(q); return; }
      const dev = Math.hypot(m[0] - 0.5 * (p[0] + q[0]), m[1] - 0.5 * (p[1] + q[1]));
      if ((L < 1.2 && dev < 0.1) || (dev < 0.03 && d >= 1 && L < 24)) { cur.push(q); return; }
      rec(p, m, d + 1); rec(m, q, d + 1);
    };
    let p = ev(a); if (p) cur.push(p);
    for (let i = 1; i <= n; i++) { const q = ev(a + (b - a) * i / n); if (p && q) rec(p, q, 0); else { cut(); if (q) cur.push(q); } p = q; }
    cut();
    return runs;
  }
  // the paths of the points zs under f (a point of the plane -> figure pt, or null where it is not drawn: the far side
  // of the globe) as app.js pathsSvg items: runs sampled in pt, the ring at z, the end dot, the marks of
  // app.js pathMarkTimes (arrowheads with their directions, the bars where steps meet, the time dots); limb: f's null is
  // the globe's far side, so a run that ends before t = m goes behind the limb there (a chevron), and one that starts
  // after t = 0 comes from behind
  function pathItems(zs, Hof, m, f, limb = false) {
    const at = (z, t) => { const q = Hof(t)(z); return fin(q) ? f(q) : null; };
    const mt = A.pathMarkTimes ? A.pathMarkTimes(m) : { arrows: [0.5 * m], dots: [0.25 * m, 0.75 * m], nodes: [] };
    const h = m / 512;
    return zs.map((z) => {
      const runs = sampleRunsT((u) => at(z, u), 0, m, 64 * Math.ceil(m));
      const dirAt = (t) => { const a = at(z, Math.max(0, t - h)), b = at(z, Math.min(m, t + h)), d = a && b ? Math.hypot(b[0] - a[0], b[1] - a[1]) : 0; return { p: at(z, t), d: d > 1e-9 ? [(b[0] - a[0]) / d, (b[1] - a[1]) / d] : null }; };
      const lr = runs[runs.length - 1], limbOut = [], limbIn = [];
      if (limb) runs.forEach((r, i) => { if (r[r.length - 1][2] < m - 1e-9) limbOut.push(i); if (r[0][2] > 1e-9) limbIn.push(i); });
      return { runs, z: runs.length && runs[0][0][2] <= 0 ? at(z, 0) : null, e: lr && lr[lr.length - 1][2] >= m - 1e-9 ? at(z, m) : null, arrows: mt.arrows.map(dirAt), nodes: mt.nodes.map(dirAt), dots: mt.dots.map((t) => at(z, t)), limbOut, limbIn };
    });
  }
  // the paths figure: one plane at t = end, the region's image over X's outline (dashed gray), and the paths
  // t -> H_t(z) of the points the app's morph figure keeps (its selection and its caption: buildFigure), drawn here
  // by app.js pathsSvg: 0.5 pt lines, a ring at z, dots at t = m/4, 3m/4, an arrowhead at m/2, a filled dot at F(z)
  async function figPaths(o, P, W, T) {
    const st = A.state();
    const [tp, lp] = T;
    const m = A.morphLen(), shapes = A.shapes(), srcWin = expandBox(A.screenBox('L0'), 3), scr = A.screenBox('R');
    const Hs = new Map();
    const Hof = (t) => { const k = t.toFixed(6); if (!Hs.has(k)) Hs.set(k, A.homF(t)); return Hs.get(k); };
    // the window: what is drawn at t = end and X's outline, inside the screen window (the paths are chosen in it, so
    // every start lies inside the frame; a path that leaves it ends in a chevron)
    let cb = null;
    if (o.crop !== 'screen') {
      const q = await A.art('R', { box: scr, wpt: 150, dpi: 72, ink: printInkFor(o, st.alpha), T: m, alive: o.alive });
      if (!q) return null;
      cb = contentBox(q, scr);
      for (const s of shapes) if (kindType(s) !== 'point') { const b = ptsBox(shapeCurves(s, (z) => z, scr, 150, srcWin).pts, scr); if (b) cb = unionBox(cb, b); }
    }
    const mL0 = 24, box = o.crop === 'screen' || !cb ? snapScreen(scr, W - mL0) : fitBox(cb, scr, W - mL0);
    const step = stepFor(box, W - mL0);
    const mL = tickW(box, step, tp) + 3, top = lp * 1.15 + 3, bottom = tp * 1.05 + 4.2;
    let w = W - mL - Math.max(4, overR(box, step, tp)), h = w / aspect(box);
    const hmax = Math.min(W * 0.75, P.maxH - top - bottom);
    if (h > hmax) { h = hmax; w = h * aspect(box); }
    const x = (W - w - mL - 4) / 2 + mL;
    // the paths and the caption that names them (app.js: the screen's rule at the figure's size)
    const leg = await A.morphPaths({ box, w, h, alive: o.alive, lang: XD.lang, paths: A.defo().paths });
    if (!leg || (o.alive && !o.alive())) return null;
    const kept = leg.kept.map((k) => C(k.z[0], k.z[1]));
    const art = await artPanel('R', box, w, o, { T: m });
    if (!art) return null;
    const Hm = Hof(m), curves = [];
    const H0f = A.defo().qp ? Hof(0) : (z) => z;   // (the bracket's start, H_0 = Q o P)
    for (const s of shapes) if (kindType(s) !== 'point') curves.push({ pts: shapeCurves(s, H0f, box, w, srcWin).pts, w: 0.4, color: '#999999', cap: 'butt' });
    let bwI = 0;
    for (const s of shapes) {
      const t = kindType(s);
      if (t === 'point') continue;
      const tn = tonesOf(s, o), open = t === 'area' && Region.isOpen && Region.isOpen(s);
      let dash = open && P.dashOpen ? '3 2' : null;
      if (o.ink === 'bw' && !dash) dash = bwDash(P, bwI++);
      curves.push({ pts: shapeCurves(s, Hm, box, w, srcWin).pts, w: t === 'area' ? P.lw.edge : P.lw.curve, color: o.ink === 'bw' ? '#000000' : tn.edge, dash, cap: dash && (dash.indexOf('0 ') === 0 || dash === '4 2.2 0 2.2') ? 'round' : 'butt' });
    }
    const over = (X, Y) => A.pathsSvg(pathItems(kept, Hof, m, (q) => [X(q.re), Y(q.im)]), { u: 1, clip: { x, y: top, w, h }, id: `${XD.ns}-mp` });
    const p = XD.panel({ x, y: top, w, h, box, step, art: [art], curves, points: [], axes: o.axes === 'cross' ? 'cross' : 'box', ylab: 'left', tickPt: tp, labelPt: lp, ink: '#000000', lw: P.lw, axisTitles: [`\\operatorname{Re} ${A.panelVar('R')}`, `\\operatorname{Im} ${A.panelVar('R')}`], over });
    const items = [p.markup, head(x, x + w, top - 3, '', `${A.panelVar('L')},\\ ${A.panelVar('R')}`, lp)];
    let cap = leg.captionTex || '';
    // (X's outline is gray and solid here, so a dash means only "not included": export review r3, editor-9)
    for (const [a, b] of [[' (dashed outline)', ' (gray outline)'], [', with dashed outlines,', ', with gray outlines,'], [', with a dashed outline,', ', with a gray outline,']]) {
      const a2 = using(XD.lang, () => $t(a)), b2 = using(XD.lang, () => $t(b));
      cap = cap.split(a2).join(b2);
    }
    if (!P.dashOpen) cap = cap.replace(/\s*Dashed boundaries do not belong to the sets\./, '');
    if (!P.dashOpen && XD.lang !== 'en') { const d = using(XD.lang, () => $t('Dashed boundaries do not belong to the sets.')); cap = cap.split(' ' + d).join('').split(d).join(''); }
    return { items, defs: p.defs, lines: p.lines, H: top + h + bottom, info: { box, kept: kept.length, m }, captionTex: cap };
  }
