  // ---------- (5) The steps view's filmstrips, its two-plane figure and its paths on the sphere ----------
  // the non-white bounds of a raster {w, h, rgb} (px): [i0, i1, j0, j1], or null; in slices of rows with a yield once
  // 8 ms have passed (a 300 dpi frame is 1-2 Mpx: no task near 50 ms)
  const inkBoundsA = async (r, thr = 246) => {
    let i0 = r.w, i1 = -1, j0 = r.h, j1 = -1, t0 = performance.now();
    for (let j = 0; j < r.h; j++) {
      for (let i = 0; i < r.w; i++) { const q = 3 * (j * r.w + i); if (r.rgb[q] < thr || r.rgb[q + 1] < thr || r.rgb[q + 2] < thr) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
      if (performance.now() - t0 > 8) { await breathe(); t0 = performance.now(); }
    }
    return i1 < 0 ? null : [i0, i1, j0, j1];
  };
  const cropRGB = (r, c) => {
    const [c0, c1, d0, d1] = c, cw = c1 - c0, ch = d1 - d0, rgb = new Uint8Array(cw * ch * 3);
    for (let j = 0; j < ch; j++) rgb.set(r.rgb.subarray(3 * ((j + d0) * r.w + c0), 3 * ((j + d0) * r.w + c0 + cw)), 3 * j * cw);
    return { w: cw, h: ch, rgb };
  };
  // a globe's marks as vectors (the art layer leaves them out): w -> [x, y] in pt on the placed image, null on the far
  // side. g: the render's camera {MVP, eye, w, h}; r: the raster; c: its crop [c0, c1, d0, d1]; (x, y, k): the image's
  // corner and pt per raster px
  const globeProj = (g, r, c, x, y, k) => {
    if (!g || !GLR.M4 || !A.lift) return () => null;
    return (w, lift = 1.01) => {
      if (!fin(w)) return null;
      const p = A.lift(w.re, w.im), tv = [g.eye[0] - p[0], g.eye[1] - p[1], g.eye[2] - p[2]], l = Math.hypot(...tv) || 1;
      if ((tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / l <= 0.02) return null;
      const q = GLR.M4.apply(g.MVP, p.map((v) => v * lift));
      if (q[3] <= 1e-6) return null;
      const px = (q[0] / q[3] * 0.5 + 0.5) * g.w * r.w / g.w, py = (1 - (q[1] / q[3] * 0.5 + 0.5)) * g.h * r.h / g.h;
      return [x + (px - c[0]) * k, y + (py - c[2]) * k];
    };
  };
  // a sphere's mark is labelled when its normal makes more than this with the line to the eye (the screen's labels start to show
  // above it)
  const GLOBE_LABEL_FACE = 0.05;
  // the sphere's own labels (0, infinity, 1, i, -1, -i) beside the globe, where they face the camera and keep clear of its
  // outline and of the other labels
  function globeLabels(g, r, c, x, y, k, tp) {
    if (!g || !A.lift) return '';
    const P = (p) => { const q = GLR.M4.apply(g.MVP, p); if (q[3] <= 1e-6) return null; return [x + ((q[0] / q[3] * 0.5 + 0.5) * r.w - c[0]) * k, y + ((1 - (q[1] / q[3] * 0.5 + 0.5)) * r.h - c[2]) * k]; };
    const face = (p) => { const tv = [g.eye[0] - p[0], g.eye[1] - p[1], g.eye[2] - p[2]]; return (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / (Math.hypot(...tv) || 1); };
    const limb = GLR.globeLimb(g.eye, P), centre = P([0, 0, 0]);
    let m = '';
    for (const [lab, p] of [['0', [0, 0, -1]], ['\\infty', [0, 0, 1]], ['1', A.lift(1, 0)], ['i', A.lift(0, 1)], ['-1', A.lift(-1, 0)], ['-i', A.lift(0, -1)]]) {
      if (face(p) <= GLOBE_LABEL_FACE) continue;
      let q = P(p[2] === 0 && Math.abs(p[0]) + Math.abs(p[1]) > 0.5 ? [p[0] * 1.06, p[1] * 1.06, 0.1] : p.map((v) => v * 1.1));
      if (!q) continue;
      const it = XD.tex(lab, tp), boxAt = (at) => XD.boxOf(it, at[0], at[1], 'middle', 'mid');
      q = GLR.clearOfLimb(q, boxAt, limb, centre);
      if (!q) continue;
      const b = boxAt(q);
      if (XD.boxes.some((o2) => o2.x0 < b.x1 + 0.6 && o2.x1 > b.x0 - 0.6 && o2.y0 < b.y1 + 0.6 && o2.y1 > b.y0 - 0.6)) continue;
      m += XD.at(it, q[0], q[1], 'middle', 'mid', 'globe-label', 0.4);
    }
    return m;
  }
  // (export review r3, editor-9) an area's boundary curves (parametric) and their image under Ht on the globe, through
  // the camera (front side only), as polylines in pt
  const globeCurves = (s, srcWin) => {
    let cs = [];
    try { cs = Region.curvesOf(s, srcWin) || []; } catch (e) { cs = []; }
    // (a formula's boundary is a polyline of its level set: followed piece by piece as a curve of u in [0, 1])
    if (!cs.length && kindType(s) === 'area' && !(Region.KINDS[s.kind] && Region.KINDS[s.kind].boundary)) cs = levelBoundary(s, srcWin, 360);
    return cs.map((q) => (typeof q.f === 'function' ? q : q && q.pts && q.pts.length > 1 ? { f: (u) => { const n = q.pts.length - 1, x = Math.min(n, Math.max(0, u * n)), i = Math.min(n - 1, Math.floor(x)), a = q.pts[i], b = q.pts[i + 1], fr = x - i, A0 = a.re != null ? [a.re, a.im] : a, B0 = b.re != null ? [b.re, b.im] : b; return C(A0[0] + (B0[0] - A0[0]) * fr, A0[1] + (B0[1] - A0[1]) * fr); } } : null)).filter(Boolean);
  };
  // (dense, even steps of u: a boundary seen edge-on projects to a nearly straight run, which an adaptive sampler takes
  // for a jump; a piece ends where the curve goes behind the sphere)
  const globeEdge = (s, Ht, proj, srcWin, n = 1600) => globeCurves(s, srcWin).flatMap((cv) => {
    const out = []; let cur = [], prev = null;
    for (let i = 0; i <= n; i++) {
      let p = null; try { p = proj(Ht(cv.f(i / n))); } catch (e) { p = null; }
      if (!p || (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 30)) { if (cur.length > 1) out.push(cur); cur = []; }
      if (p) cur.push(p);
      prev = p;
    }
    if (cur.length > 1) out.push(cur);
    return out;
  });
  // a polyline set in pt as a path
  const ptPath = (segs) => segs.map((sg) => sg.map((p, i) => `${i ? 'L' : 'M'}${f2(p[0])} ${f2(p[1])}`).join('')).join('');
  // the steps view's filmstrip: one frame per plane of the thread, each that plane's picture as its stage shows
  // it (its surface, colouring and Inside regions), titled with the plane and the step into it, w_k = f_k(w_{k-1}).
  // As on screen, every frame shows the window all the planes share (the camera). Fit, on the plane, gives each frame
  // its own window: the box of the images in that plane of the shapes the camera shows in z, plus SV_FIT_PAD of each
  // side, widened to the camera's aspect so the frames keep one size, with its own ticks. A plane keeps the camera's
  // window when no shape is in view, or when the box is wider than SV_FIT_MAX cameras (an image running off to
  // infinity, as exp sends a strip, would be a speck in it)
  const SV_FIT_PAD = 0.1, SV_FIT_MAX = 10, SV_FILM_OVER = 1.5;
  const sameBox = (p, q) => ['x0', 'x1', 'y0', 'y1'].every((k) => Math.abs(p[k] - q[k]) <= 1e-9 * Math.max(1, Math.abs(p[k])));
  // the windows of the planes idx (indexes into A.svFrames()) when each is framed on its own (Fit, on the plane): the
  // boxes, one per plane, or null when every plane keeps the camera's window; and fellBack, true when a plane keeps it
  // because no shape is in view or its box is too wide
  function svFitBoxes(o, idx) {
    if (o.crop === 'screen' || A.svSurf() !== 'plane') return { boxes: null, fellBack: false };
    // (the shapes are traced in the camera's window grown 3 times each way, as the other views trace them, so a shape
    // running off the screen keeps its part)
    const cam = A.svBox(), srcWin = expandBox(cam, 3), shapes = A.shapes();
    const span = (b) => Math.max(b.x1 - b.x0, b.y1 - b.y0);
    let boxes = idx.map((i) => {
      const c = imageWin(A.svFrameF(i), cam, srcWin, shapes, { pad: SV_FIT_PAD });
      return c && span(c) <= SV_FIT_MAX * span(cam) ? widenTo(c, aspect(cam)) : null;
    });
    const fellBack = boxes.some((b) => !b);
    boxes = boxes.map((b) => b || cam);
    return { boxes: boxes.every((b) => sameBox(b, cam)) ? null : boxes, fellBack };
  }
  // The frames of a filmstrip (figSvFilm, figNumFilm) laid out in a grid of up to 4 columns (3 under 400 pt but on a slide):
  // 8 pt between frames, a title 4 pt above its frame (its height measured with that 4 pt), y tick labels 3 pt left of the
  // frame and at least 2 pt of room right of it for the last x label. titles: the frames' typeset titles; artAt(i, opts):
  // frame i's picture (svArt's options), in turn, null when cancelled; boxes: each frame's own window (its axes and
  // ticks), or null for pictures with no axes. -> {items, defs, lines, H}, or null
  async function filmGrid(o, P, W, T, titles, artAt, boxes) {
    const [tp] = T;
    const n = titles.length, gap = 8;
    const cols = Math.min(n, W >= 400 || o.for === 'slides' ? 4 : 3), rows = Math.ceil(n / cols);
    const ink = printInkFor(o, A.state().alpha);
    const tH = Math.max(...titles.map((it) => it.a + it.d + 4));
    // (with windows of their own, each frame carries its ticks: room for its y labels on the left and its x labels below)
    const roughW = (W - gap * (cols - 1)) / cols;
    const steps = boxes ? boxes.map((b) => stepFor(b, roughW)) : null;
    const mL = boxes ? Math.max(...boxes.map((b, i) => tickW(b, steps[i], tp))) + 3 : 0;
    const mR = boxes ? Math.max(2, ...boxes.map((b, i) => overR(b, steps[i], tp))) : 0;
    // (the x tick labels' row under a frame, as the plane figure's bottom margin: a label's line, 1.05 times its point
    // size, and its 4.2 pt gap from the frame)
    const below = boxes ? tp * 1.05 + 4.2 : 0;
    // (a row: its titles (tH), the frames, their tick labels, and ROW_GAP to the next row's titles; the last row keeps
    // ROW_GAP - 2 below it, the 4 pt the frames' strokes and tick marks need)
    const ROW_GAP = 6;
    const pw = (W - gap * (cols - 1) - cols * (mL + mR)) / cols;
    const raws = [];
    for (let i = 0; i < n; i++) {
      // (rendered at SV_FILM_OVER times the frame's width: the frames are small, and the extra pixels keep thin level
      // lines sharp in print)
      const r = await artAt(i, Object.assign({ wpt: pw * SV_FILM_OVER, dpi: 300, ink, alive: o.alive }, boxes ? { box: boxes[i] } : {}));
      if (!r) return null;
      raws.push(r);
    }
    const ph = Math.min(pw * raws[0].h / raws[0].w, (P.maxH - rows * (tH + ROW_GAP + below)) / rows);
    const items = [], lines = [];
    let defs = '';
    for (let i = 0; i < n; i++) {
      const x = (i % cols) * (mL + pw + mR + gap) + mL, y = Math.floor(i / cols) * (tH + ph + below + ROW_GAP) + tH, r = raws[i];
      if (boxes) {
        const a = await XD.art(cropRGB(r, [0, r.w, 0, r.h]), boxes[i], { mode: o.ink === 'bw' ? 'grey' : 'rgb', wpt: pw });
        const p = XD.panel({ x, y, w: pw, h: ph, box: boxes[i], step: steps[i], art: [a], curves: [], points: [], axes: 'box', ylab: 'left', tickPt: tp, labelPt: T[1], ink: '#000000', lw: P.lw });
        items.push(p.markup); defs += p.defs; lines.push(...p.lines);
      } else {
        const a = await XD.art(cropRGB(r, [0, r.w, 0, r.h]), { x0: 0, x1: 1, y0: 0, y1: 1 }, { mode: o.ink === 'bw' ? 'grey' : 'rgb', wpt: pw });
        items.push(`<image x="${f2(x)}" y="${f2(y)}" width="${f2(pw)}" height="${f2(ph)}" preserveAspectRatio="none" xlink:href="${a.url}"/>`);
        items.push(`<rect x="${f2(x)}" y="${f2(y)}" width="${f2(pw)}" height="${f2(ph)}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
        lines.push({ x0: x, y0: y, x1: x + pw, y1: y + ph, kind: 'frame' });
      }
      items.push(XD.at(titles[i], x, y - 4 - titles[i].d, 'start', 'base', 'title'));
    }
    return { items, defs, lines, H: rows * (tH + ph + below + ROW_GAP) - 2 };
  }
  async function figSvFilm(o, P, W, T) {
    const frames = A.svFrames();
    // (fellBack: a frame keeps the camera's window, so the caption says the windows are the planes' own where they fit)
    const fit = svFitBoxes(o, frames.map((f, i) => i));
    const boxes = fit.boxes;
    const titles = frames.map((f) => XD.tex(f.f ? `${f.name}=${f.f}(${f.prev})` : f.name, T[1]));
    const body = await filmGrid(o, P, W, T, titles, (i, opts) => A.svArt(i, opts), boxes);
    if (!body) return null;
    // (ownWin: the frames' windows differ, which the caption says)
    const ownWin = !!boxes && boxes.some((b) => !sameBox(b, boxes[0]));
    return Object.assign(body, { info: { svFilm: true, frames, ownWin, fellBack: ownWin && fit.fellBack, boxes } });
  }
  // a filmstrip over a Number: the shown plane's picture at o.numN values of the Number o.numName, evenly from o.numFrom to
  // o.numTo ({re, im}: along the segment between them for a complex Number), each titled with its value, laid out as the
  // planes' filmstrip. The Number is set as a change at rest and the app settles before each frame is drawn (A.numberAt);
  // it is back at its value and range at the end, also when the build is cancelled (A.numberHold)
  // (the frames a filmstrip over a Number takes: at least, at most, and by default)
  const NUM_FILM_MIN = 2, NUM_FILM_MAX = 12, NUM_FILM_N = 4;
  async function figNumFilm(o, P, W, T) {
    const nu = A.numbers().find((q) => q.name === o.numName);
    const a = o.numFrom, b = o.numTo, n = Math.max(NUM_FILM_MIN, Math.min(NUM_FILM_MAX, Math.round(o.numN) || NUM_FILM_N));
    if (!nu || !a || !b) return null;
    const vals = Array.from({ length: n }, (_, i) => ({ re: a.re + (b.re - a.re) * i / (n - 1), im: a.im + (b.im - a.im) * i / (n - 1) }));
    const labs = vals.map((v) => cxTexL({ re: +v.re.toPrecision(6), im: +v.im.toPrecision(6) }));
    const titles = labs.map((l) => XD.tex(`${nu.tex}=${l}`, T[1]));
    const k = A.svIndex(), release = A.numberHold(nu.name);
    if (!release) return null;
    let body;
    try {
      body = await filmGrid(o, P, W, T, titles, async (i, opts) => ((await A.numberAt(nu.name, vals[i], o.alive)) ? A.svArt(k, opts) : null), null);
    } finally { release(); }
    if (!body) return null;
    return Object.assign(body, { info: { numFilm: true, num: nu.tex, labs, plane: A.svFrames()[k].name } });
  }
  // the steps view's two-plane figure: plane o.svFrom and plane o.svTo of the thread (indexes into A.svFrames(); by
  // default z and the last plane) side by side, each as the Shown plane exports it, each headed by its name, with the
  // arrow of the map between them named over it (A.svMapTex). A plane on the plane surface has its box and axes as in
  // the other plane figures (Crop, Axes); on the sphere the frames are the stage's pictures, as in the filmstrip.
  // a TeX plane or map name as plain text: w_{2} -> w₂, f_{2}\circ f_{1} -> f₂∘f₁
  const plainName = (tex) => tex.replace(/_\{(\d+)\}/g, (m, d) => [...d].map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c]).join('')).replace(/\\circ ?/g, '∘').replace(/\\cdots/g, '⋯');
  // whether a box meets an axis name already placed (XD.boxes), within NAME_GAP pt; the passes that settle the left margin
  // with the panel it leaves, and the pt it may still be short by
  const NAME_GAP = 1, MARGIN_PASSES = 6, MARGIN_EPS = 0.01;
  const nameMeets = (b) => XD.boxes.some((q) => q.kind === 'axis-name' && q.x0 < b.x1 + NAME_GAP && q.x1 > b.x0 - NAME_GAP && q.y0 < b.y1 + NAME_GAP && q.y1 > b.y0 - NAME_GAP);
  async function figSvTwo(o, P, W, T) {
    const [tp, lp] = T, frames = A.svFrames(), n = frames.length;
    const from = Math.max(0, Math.min(n - 2, o.svFrom == null ? 0 : o.svFrom | 0)), to = Math.max(from + 1, Math.min(n - 1, o.svTo == null ? n - 1 : o.svTo | 0));
    const ids = [from, to], ink = printInkFor(o, A.state().alpha), mode = o.ink === 'bw' ? 'grey' : 'rgb';
    const plane = A.svSurf() === 'plane';
    const fit = svFitBoxes(o, ids);
    const boxes = plane ? fit.boxes || ids.map(() => A.svBox()) : null;
    const axes = plane ? o.axes || P.axes : 'none';
    let asp;
    if (plane) asp = boxes.map(aspect);
    else {
      const pr = await A.svArt(from, { wpt: 20, dpi: 72, ink, alive: o.alive });
      if (!pr) return null;
      asp = [pr.w / pr.h, pr.w / pr.h];
    }
    const steps = plane ? boxes.map((b) => stepFor(b, W / 2)) : null;
    const names = ids.map((i) => frames[i].name), arrowTex = A.svMapTex(from, to), arrowLab = XD.tex(arrowTex, lp);
    const arrowSpan = Math.max(axes === 'box' ? 22 : 26, arrowLab.w + 12);
    const titles = names.map((nm) => [`\\operatorname{Re} ${nm}`, `\\operatorname{Im} ${nm}`]);
    const ah = 4.6;
    // (imHalf: with cross axes, half the width of the first panel's imaginary-axis name, which stands centred over that axis)
    let mL, gut, mR, top, bottom, imHalf = 0;
    if (axes === 'box') {
      mL = tickW(boxes[0], steps[0], tp) + 3; gut = arrowSpan + 10 + tickW(boxes[1], steps[1], tp) + 3; mR = Math.max(2, overR(boxes[1], steps[1], tp));
      top = lp * 1.15 + 3; bottom = tp * 1.05 + 4.2;
    } else if (axes === 'none') {
      mL = 3; gut = arrowSpan + 16; mR = 2; top = lp * 1.15 + 3; bottom = 3;
    } else {
      const nA = XD.tex(titles[0][0], lp).w, nB = XD.tex(titles[1][0], lp).w, t1 = XD.tex(titles[0][1], lp);
      mL = 3; gut = ah * 0.3 + 2 + nA + 8 + arrowSpan + 8; mR = ah * 0.3 + 2 + nB + 2;
      top = Math.max(t1.a + t1.d + ah + 5, lp * 1.15 + 3); bottom = 3;
      imHalf = t1.w / 2;
    }
    // (past the colour plane the To plane's pane key, as the plain still of that plane carries it: the hue ring and the line
    // saying where the colour is carried from, in a column right of the second picture and of its real-axis name)
    const sk = A.svKey ? A.svKey(to) : null;
    const keyW = sk && sk.carried ? Math.min(KEY_COL_MAX, W * KEY_COL_FRAC) : 0;
    // (the key's column starts after the room kept right of the second picture, as in the plain still)
    const keyAt = mR;
    mR += keyW ? keyW + KEY_GAP : 0;
    const heightOf = () => Math.min((W - mL - gut - mR) / (asp[0] + asp[1]), W * 0.62, P.maxH - top - bottom);
    let h = heightOf();
    // (the first panel's imaginary axis stands at its left edge when its window is right of 0, and its name, centred over it,
    // and its tick labels, left of it, reach left of the panel: the left margin holds what reaches past it)
    // (the axis stands f of the panel's width in, and the panel narrows as the margin grows: a few passes settle the two)
    if (imHalf) {
      const b = boxes[0], f = Math.min(1, Math.max(0, -b.x0 / (b.x1 - b.x0))), reach = Math.max(imHalf + 1, tickW(b, steps[0], tp) + 3);
      for (let pass = 0; pass < MARGIN_PASSES; pass++) {
        const over = reach - f * h * asp[0];
        if (over <= mL + MARGIN_EPS) break;
        mL = over; h = heightOf();
      }
    }
    const used = mL + gut + mR + h * (asp[0] + asp[1]), x0 = (W - used) / 2, y = top;
    const xs = [x0 + mL, x0 + mL + h * asp[0] + gut];
    const items = [], lines = [];
    let defs = '';
    for (const k of [0, 1]) {
      const wpt = h * asp[k], x = xs[k];
      const r = await A.svArt(ids[k], Object.assign({ wpt, dpi: 300, ink, alive: o.alive }, plane ? { box: boxes[k] } : {}));
      if (!r) return null;
      if (plane) {
        const a = await XD.art(cropRGB(r, [0, r.w, 0, r.h]), boxes[k], { mode, wpt });
        const p = XD.panel({ x, y, w: wpt, h, box: boxes[k], step: steps[k], art: [a], curves: [], points: [], axes, minimal: P.minimal, ylab: 'left', tickPt: tp, labelPt: lp, ink: '#000000', lw: P.lw, axisTitles: titles[k] });
        items.push(p.markup); defs += p.defs; lines.push(...p.lines);
      } else {
        const a = await XD.art(cropRGB(r, [0, r.w, 0, r.h]), { x0: 0, x1: 1, y0: 0, y1: 1 }, { mode, wpt });
        items.push(`<image x="${f2(x)}" y="${f2(y)}" width="${f2(wpt)}" height="${f2(h)}" preserveAspectRatio="none" xlink:href="${a.url}"/>`);
        items.push(`<rect x="${f2(x)}" y="${f2(y)}" width="${f2(wpt)}" height="${f2(h)}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
        lines.push({ x0: x, y0: y, x1: x + wpt, y1: y + h, kind: 'frame' });
      }
      // (the name heads its panel at the top left corner; where the imaginary axis stands near that corner its name is there,
      // and the plane's name heads the panel at the top right corner)
      const nm = XD.tex(names[k], lp);
      const corners = [[x, 'start'], [x + wpt, 'end']];
      const [nx, na] = corners.find(([cx, ca]) => !nameMeets(XD.boxOf(nm, cx, y - 3, ca, 'base'))) || corners[0];
      items.push(XD.at(nm, nx, y - 3, na, 'base', 'title'));
    }
    // (cross axes: the arrow keeps clear of both real axes, so it never reads as their continuation)
    const oys = axes === 'cross' ? boxes.map((b) => Math.min(y + h, Math.max(y, y + (b.y1 / (b.y1 - b.y0)) * h))) : [];
    const { a0, a1, ay } = arrowPlace({ box: axes === 'box', xr: xs[0] + h * asp[0], xn: xs[1], y, h, oys, label: arrowLab, span: arrowSpan, off: axes === 'cross' ? ah * 0.3 + 2 + XD.tex(titles[0][0], lp).w + 8 : 8 });
    items.push(XD.mapArrow(a0, a1, ay, arrowTex, lp, P.lw.arrow, '#000000'));
    let keyBottom = 0;
    if (keyW) {
      const k = await carriedKey(sk.carried, xs[1] + h * asp[1] + keyAt + KEY_GAP + keyW / 2, y, keyW, tp, P.lw.frame);
      items.push(...k.items);
      keyBottom = k.bottom;
    }
    const ownWin = !!fit.boxes && !sameBox(boxes[0], boxes[1]);
    return { items, defs, lines, H: Math.max(y + h + bottom, keyBottom), info: { svTwo: true, keyLine: keyW ? sk.carried.text : null, frames: [frames[from], frames[to]], from, to, arrow: arrowTex, ownWin, fellBack: ownWin && fit.fellBack, boxes } };
  }
  // the steps view's paths figure on the sphere (o.sv, its A.svPathsFig()): the shown plane's globe and the paths
  // t -> H_t(z) of the step that leads to it, with heads at F(z), their starts chosen in the camera's window as on the
  // plane; the caption is the plane's own, then the paths' sentence
  // the width (pt) at which the steps view's paths are picked for the sphere: wide enough that, of the paths picked over the
  // whole source window, several lie wholly on the camera's side
  const SV_PATHS_PICK_W = 600;
  async function figGlobePaths(o, P, W, T) {
    const [tp] = T;
    const sv = o.sv, m = sv.m, st = A.state();
    const wpt = W * 1.2, hpt = wpt;
    const shapes = A.shapes(), srcWin = expandBox(A.screenBox('L0'), 3);
    const openS = P.dashOpen ? shapes.filter((s) => kindType(s) === 'area' && Region.isOpen && Region.isOpen(s) && globeCurves(s, srcWin).length) : [];
    const artArgs = { wpt, hpt, dpi: 300, ink: printInkFor(o, st.alpha), alive: o.alive, skipLines: openS.map((s) => s.id) };
    const r = await A.svArt(sv.i, artArgs);
    if (!r) return null;
    let c = (await inkBoundsA(r)) || [0, r.w - 1, 0, r.h - 1];
    const pad = Math.round(0.04 * (c[1] - c[0]));
    c = [Math.max(0, c[0] - pad), Math.min(r.w, c[1] + 1 + pad), Math.max(0, c[2] - pad), Math.min(r.h, c[3] + 1 + pad)];
    const cw = c[1] - c[0], ch = c[3] - c[2];
    let iw = Math.min(W - 8, W * 0.72), ih = iw * ch / cw;
    const hmax = Math.min(W * 0.75, P.maxH - 8);
    if (ih > hmax) { ih = hmax; iw = ih * cw / ch; }
    const x = (W - iw) / 2, y = 4, k = iw / cw;
    const a = await XD.art(cropRGB(r, c), { x0: 0, x1: 1, y0: 0, y1: 1 }, { mode: o.ink === 'bw' ? 'grey' : 'rgb', wpt: iw });
    const items = [`<image x="${f2(x)}" y="${f2(y)}" width="${f2(iw)}" height="${f2(ih)}" preserveAspectRatio="none" xlink:href="${a.url}"/>`];
    const proj = globeProj(r.globe, r, c, x, y, k);
    const Hs = new Map(), Hof = (t) => { const key = t.toFixed(6); if (!Hs.has(key)) Hs.set(key, sv.Fat(t)); return Hs.get(key); };
    // a path drawn from its ring to its end dot: every one of its 13 samples (t = 0 to m) on the camera's side
    const whole = (z) => { for (let i = 0; i <= 12; i++) if (!proj(Hof(m * i / 12)(z))) return false; return true; };
    // (the points the plane's figure would keep, those wholly on the camera's side)
    const sb = A.screenBox('L0'), bw = SV_PATHS_PICK_W, bh = bw * (sb.y1 - sb.y0) / (sb.x1 - sb.x0);
    const leg = await A.svPathsMorph({ box: sb, w: bw, h: bh, alive: o.alive, lang: XD.lang, keep: (z) => whole(C(z.re, z.im)) });
    if (!leg || (o.alive && !o.alive())) return null;
    const zs = leg.kept.map((q) => C(q.z[0], q.z[1]));
    const pxPt = 300 / 96 * k;
    let g = '';
    // (export review r3, editor-9) an open set's boundary, dashed (Homework)
    for (const s of openS) {
      const d2 = ptPath(globeEdge(s, Hof(m), proj, srcWin)), col = o.ink === 'bw' ? '#000000' : tonesOf(s, o).edge;
      if (d2) g += `<path d="${d2}" fill="none" stroke="#ffffff" stroke-width="${f2(3.5 * pxPt)}" stroke-linecap="round"/><path d="${d2}" fill="none" stroke="${col}" stroke-width="${f2(Math.max(0.6, 1.5 * pxPt))}" stroke-dasharray="3 2"/>`;
    }
    // (verify-editor-3) a point shape without an arrow: F(z) marked with a square (then a triangle, ...) where it faces
    // the camera, not a second kind of dot (the arrows start at dots)
    let nMarks = 0;
    for (const s of shapes) {
      if (kindType(s) !== 'point' || !s.p) continue;
      const z = C(s.p[0], s.p[1]);
      if (zs.some((y) => y.re === z.re && y.im === z.im)) continue;
      const e = proj(Hof(m)(z));
      if (!e) continue;
      const mk = 1 + nMarks++ % 3;
      g += XD.marker(PTS[mk][0], e[0], e[1], 1.9, o.ink === 'bw' ? '#000000' : PTS[mk][1], '#ffffff', 0.4);
    }
    g += A.pathsSvg(pathItems(zs, Hof, m, proj, true), { u: 1 });
    items.push(g, globeLabels(r.globe, r, c, x, y, k, tp - 1));
    return { items, defs: '', lines: [], H: y + ih + 4, info: { film: null, svPaths: true, svGlobe: true, m, kept: zs.length, sentence: leg.sentenceTex || '' } };
  }
