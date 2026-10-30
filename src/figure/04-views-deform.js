  // ---------- (5) The deformation in every view (round 3, ROUND3.md): Phase, Landscape and the globes ----------
  // the deformation's kind in a view: 'plane' (X -> Y on the plane), 'deriv' (the merged plane over a d/dz step),
  // 'globe' (X -> Y on the Riemann sphere), 'phase' (the portrait of H_t), 'phaseGlobe' (on the sphere), 'land' (the
  // relief of H_t); null without the deformation. The paths figure exists where the app draws paths: plane, globe
  const defoOf = (view) => {
    const d = A && A.defo ? A.defo() : null;
    if (!d || !d.on) return null;
    if (view === 'morph') return 'plane';
    if (view === 'xyR') return d.rGlobe ? 'globe' : 'deriv';
    if (view === 'phase') return 'phase';
    if (view === 'xyL' && d.main === 'phase') return 'phaseGlobe';
    if (view === 'land') return 'land';
    return null;
  };
  const PATHS_OK = new Set(['plane', 'globe']);
  // the frames' times: n frames from 0 to m, and their labels (thirds when m is whole)
  const filmTimes = (m, n = 4) => [...Array(n).keys()].map((i) => i * m / (n - 1));
  const fracTexOf = (m) => (t) => { const q = t / m * 3; if (m === 1) return ['0', '1/3', '2/3', '1'][Math.round(q)] || (I18 && I18.comma(XD.lang) ? I18.texNum(CX.fmtNum(t, 2), XD.lang) : CX.fmtNum(t, 2)); return Math.abs(t - Math.round(t)) < 1e-9 ? String(Math.round(t)) : `${Math.round(t * 3)}/3`; };
  const frameTitle = (i, lab, lp) => XD.tex(XD.lang === 'ru' ? `\\textit{${RU_LETTERS[i]}}\\enspace t=${lab}` : `\\text{(${String.fromCharCode(97 + i)})}\\enspace t=${lab}`, lp);
  // the non-white bounds of a raster {w, h, rgb} (px): [i0, i1, j0, j1], or null
  const inkBounds = (r, thr = 246) => {
    let i0 = r.w, i1 = -1, j0 = r.h, j1 = -1;
    for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const q = 3 * (j * r.w + i); if (r.rgb[q] < thr || r.rgb[q + 1] < thr || r.rgb[q + 2] < thr) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
    return i1 < 0 ? null : [i0, i1, j0, j1];
  };
  // the same, in slices of rows with a yield once 8 ms have passed (a 300 dpi frame is 1-2 Mpx: no task near 50 ms)
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
  // the sphere's own labels (0, infinity, 1, i, -1, -i) beside the globe, where they face the camera
  function globeLabels(g, r, c, x, y, k, tp) {
    if (!g || !A.lift) return '';
    const P = (p) => { const q = GLR.M4.apply(g.MVP, p); if (q[3] <= 1e-6) return null; return [x + ((q[0] / q[3] * 0.5 + 0.5) * r.w - c[0]) * k, y + ((1 - (q[1] / q[3] * 0.5 + 0.5)) * r.h - c[2]) * k]; };
    const face = (p) => { const tv = [g.eye[0] - p[0], g.eye[1] - p[1], g.eye[2] - p[2]]; return (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / (Math.hypot(...tv) || 1); };
    let m = '';
    for (const [lab, p] of [['0', [0, 0, -1]], ['\\infty', [0, 0, 1]], ['1', A.lift(1, 0)], ['i', A.lift(0, 1)], ['-1', A.lift(-1, 0)], ['-i', A.lift(0, -1)]]) {
      if (face(p) < 0.3) continue;
      const q = P(p[2] === 0 && Math.abs(p[0]) + Math.abs(p[1]) > 0.5 ? [p[0] * 1.06, p[1] * 1.06, 0.1] : p.map((v) => v * 1.1));
      if (!q) continue;
      const it = XD.tex(lab, tp), b = XD.boxOf(it, q[0], q[1], 'middle', 'mid');
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
  // (export review r3, editor-18) the floor marks of a relief: Re and Im ticks along the front edges and their names,
  // through the render's camera L; toPt(ii, jj): raster px -> pt; fr: the panel {x, top, iw, ih}
  function landFloor(L, r, toPt, fr, tp, lp, tick = 2.5) {
    if (!L || !L.MVP || !GLR.M4) return '';
    const proj = (p) => { const q = GLR.M4.apply(L.MVP, p); if (q[3] <= 1e-6) return null; const px = (q[0] / q[3] * 0.5 + 0.5) * L.w, py = (1 - (q[1] / q[3] * 0.5 + 0.5)) * L.h; return toPt(px * r.w / L.w, py * r.h / L.h); };
    const [ax, ay] = L.aspect || [1, 1], z0 = L.floorZ, eye = L.eye || [1, 1, 1], bx = L.box;
    const sx = eye[0] < 0 ? -1 : 1, sy = eye[1] < 0 ? -1 : 1;
    const Xw = (v) => ((v - bx.x0) / (bx.x1 - bx.x0) - 0.5) * 2 * ax, Yw = (v) => ((v - bx.y0) / (bx.y1 - bx.y0) - 0.5) * 2 * ay;
    const free = (bb) => !XD.boxes.some((q) => q.x0 < bb.x1 + 1 && q.x1 > bb.x0 - 1 && q.y0 < bb.y1 + 1 && q.y1 > bb.y0 - 1) && bb.x0 > fr.x + 1 && bb.x1 < fr.x + fr.iw - 1 && bb.y0 > fr.top + 1 && bb.y1 < fr.top + fr.ih - 1;
    let tk = '', out = '';
    const edge = (vals, at, dir, name) => {
      const dec = XD.decimals(vals.step);
      let mid = null, dirm = null;
      const e0 = proj(at(vals.lo)), e1 = proj(at(vals.hi));
      if (e0 && e1) tk += `M${f2(e0[0])} ${f2(e0[1])}L${f2(e1[0])} ${f2(e1[1])}`;
      for (const v of vals.list) {
        const p = at(v), a = proj(p), b = proj([p[0] + dir[0] * 0.08, p[1] + dir[1] * 0.08, z0]);
        if (!a || !b) continue;
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, u = [dx / l, dy / l];
        const it = XD.tex(XD.tickTex(v, dec), tp);
        const cx = a[0] + u[0] * (tick + 2 + Math.abs(u[0]) * it.w / 2), cy = a[1] + u[1] * (tick + 2 + Math.abs(u[1]) * (it.a + it.d) / 2);
        if (!free(XD.boxOf(it, cx, cy, 'middle', 'mid'))) continue;
        tk += `M${f2(a[0])} ${f2(a[1])}l${f2(u[0] * tick)} ${f2(u[1] * tick)}`;
        out += XD.at(it, cx, cy, 'middle', 'mid', 'tick');
        (mid = mid || []).push([cx, cy]); dirm = u;
      }
      if (mid && mid.length) {
        const q = mid[Math.floor(mid.length / 2)], it = XD.tex(name, lp), cx = q[0] + dirm[0] * (it.w / 2 + 7), cy = q[1] + dirm[1] * (lp + 2);
        if (free(XD.boxOf(it, cx, cy, 'middle', 'mid'))) out += XD.at(it, cx, cy, 'middle', 'mid', 'axis-name');
      }
    };
    const tks = (a0, a1) => { const st = niceStep(a1 - a0, 3); return { step: st, list: XD.ticks(a0, a1, st), lo: a0, hi: a1 }; };
    const v = A.panelVar('L');
    edge(tks(bx.x0, bx.x1), (t) => [Xw(t), sy * ay, z0], [0, sy], `\\operatorname{Re} ${v}`);
    edge(tks(bx.y0, bx.y1), (t) => [sx * ax, Yw(t), z0], [sx, 0], `\\operatorname{Im} ${v}`);
    return (tk ? `<path d="${tk}" stroke="#000000" stroke-width="0.5" fill="none" stroke-linecap="round"/>` : '') + out;
  }
  // a polyline set in pt as a path
  const ptPath = (segs) => segs.map((sg) => sg.map((p, i) => `${i ? 'L' : 'M'}${f2(p[0])} ${f2(p[1])}`).join('')).join('');
  // the points whose paths a globe shows: the point shapes and points of the areas' boundaries whose paths show for
  // the most part (their samples on the front side), kept apart at their ends; Hof(t) -> H_t
  function globePathPoints(shapes, srcWin, Hof, m, proj, minPt, max = 8) {
    const cands = shapes.filter((s) => kindType(s) === 'point' && s.p).map((s) => C(s.p[0], s.p[1]));
    for (const s of shapes) {
      if (kindType(s) === 'point') continue;
      let cs = []; try { cs = Region.curvesOf(s, srcWin) || []; } catch (e) { cs = []; }
      for (const cv of cs.filter((q) => typeof q.f === 'function').slice(0, 4)) for (let i = 1; i < 16; i++) { const z = cv.f(i / 16); if (fin(z)) cands.push(z); }
    }
    const kept = [];
    for (const z of cands) {
      let vis = 0;
      for (let i = 0; i <= 12; i++) if (proj(Hof(m * i / 12)(z))) vis++;
      const e = proj(Hof(m)(z));
      if (vis < 8 || !e) continue;
      if (kept.every((q) => Math.hypot(q.e[0] - e[0], q.e[1] - e[1]) >= minPt)) kept.push({ z, e });
      if (kept.length >= max) break;
    }
    return kept.map((q) => q.z);
  }
  // Globe, Phase on the sphere, Landscape: a filmstrip of the view's own picture at the frames' times, one shared crop
  async function figFilmPic(o, P, W, T, kind) {
    const [tp, lp] = T;
    const d = A.defo(), m = d.m, ts = filmTimes(m), lab = fracTexOf(m);
    const side = kind === 'globe' ? 'R' : 'L';
    const st = A.state(), ink = printInkFor(o, st.alpha);
    const cols = W >= 400 || o.for === 'slides' ? 4 : 2, rows = 4 / cols, gap = 8;
    const keyW = kind === 'phaseGlobe' && o.ink !== 'bw' ? Math.min(54, W * 0.16) : 0;
    // (export review r3, editor-9) Homework dashes an open set's boundary: on the globe the figure draws it (the art
    // layer leaves its line out)
    const shapes = A.shapes(), srcWin = expandBox(A.screenBox('L0'), 3);
    const openS = kind === 'globe' && P.dashOpen ? shapes.filter((s) => kindType(s) === 'area' && Region.isOpen && Region.isOpen(s) && globeCurves(s, srcWin).length) : [];
    const cell = (W - keyW - gap * (cols - 1)) / cols;
    // the window of the relief: as in figLand (rounded edges), the same for every frame
    let landBox = null;
    if (kind === 'land') {
      const lb = A.landBox ? A.landBox() : null;
      if (lb && [lb.x0, lb.x1, lb.y0, lb.y1].every(Number.isFinite)) { const rnd = (a0, a1) => { const s2 = niceStep(a1 - a0, 8), b0 = Math.round(a0 / s2) * s2, b1 = Math.round(a1 / s2) * s2; return b1 > b0 ? [b0, b1] : [a0, a1]; }; const [x0, x1] = rnd(lb.x0, lb.x1), [y0, y1] = rnd(lb.y0, lb.y1); landBox = { x0, x1, y0, y1 }; }
    }
    // each frame rendered at 300 ppi of its printed size (the crop is unknown yet: render the pane's picture at the cell
    // width, then crop; the crop rarely loses more than a third, so 1.5 x keeps it above 300 ppi)
    const asp = Math.min(A.paneAspect(side), kind === 'land' ? 0.8 : 1);
    const wpt = cell * 1.5, hpt = wpt * asp, raws = [];
    for (const t of ts) {
      const r = await A.art(side, { wpt, hpt, dpi: 300, ink, T: t, alive: o.alive, landBox, skipLines: openS.map((s) => s.id) });
      if (!r) return null;
      raws.push(r);
    }
    // the shared crop: the union of what is drawn, with a little air
    let c = null;
    for (const r of raws) {
      const b = await inkBoundsA(r, kind === 'land' ? 232 : 246);
      if (b) c = c ? [Math.min(c[0], b[0]), Math.max(c[1], b[1]), Math.min(c[2], b[2]), Math.max(c[3], b[3])] : b;
      // (a relief: its floor too, where the floor marks go; export review r3, editor-18)
      const L = kind === 'land' ? r.land : null;
      if (L && L.MVP && GLR.M4) {
        const [ax, ay] = L.aspect || [1, 1];
        for (const [x, y] of [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]]) {
          const q = GLR.M4.apply(L.MVP, [x, y, L.floorZ]);
          if (q[3] <= 1e-6) continue;
          const i = Math.round((q[0] / q[3] * 0.5 + 0.5) * r.w), j = Math.round((1 - (q[1] / q[3] * 0.5 + 0.5)) * r.h);
          c = c ? [Math.min(c[0], i), Math.max(c[1], i), Math.min(c[2], j), Math.max(c[3], j)] : [i, i, j, j];
        }
      }
    }
    const r0 = raws[0];
    if (!c) c = [0, r0.w - 1, 0, r0.h - 1];
    c = [Math.max(0, c[0]), Math.min(r0.w - 1, c[1]), Math.max(0, c[2]), Math.min(r0.h - 1, c[3])];
    const padX = Math.round((kind === 'land' ? 0.07 : 0.03) * (c[1] - c[0])), padY = Math.round((kind === 'land' ? 0.09 : 0.03) * (c[3] - c[2]));
    c = [Math.max(0, c[0] - padX), Math.min(r0.w, c[1] + 1 + padX), Math.max(0, c[2] - padY), Math.min(r0.h, c[3] + 1 + padY)];
    const cw = c[1] - c[0], ch = c[3] - c[2];
    let pw = cell, ph = pw * ch / cw;
    const titleH = (it) => it.a + it.d + 4;
    const titles = ts.map((t, i) => frameTitle(i, lab(t), lp));
    const tH = Math.max(...titles.map(titleH));
    // (a relief with its floor is about as tall as it is wide: it may take three quarters of the width in height)
    const hmax = Math.min((W * (kind === 'land' ? 0.75 : 0.6)) / rows, (P.maxH + 2 - rows * (tH + 6)) / rows);
    if (ph > hmax) { ph = hmax; pw = ph * cw / ch; }
    const x0 = (W - keyW - (cols * pw + (cols - 1) * gap)) / 2;
    const k = pw / cw, items = [], lines = [];
    // the marked points and their paths (the globe): solid up to the frame's t, dotted after
    const Hs = new Map(), Hof = (t) => { const key = t.toFixed(6); if (!Hs.has(key)) Hs.set(key, A.homF(t)); return Hs.get(key); };
    let tracked = [];
    // (export review r3, editor-3) the point shapes are drawn wherever they face the camera; one hidden in every frame
    // is named in the caption
    const ptS = kind === 'globe' ? shapes.filter((s) => kindType(s) === 'point' && s.p) : [], ptShapes = ptS.map((s) => C(s.p[0], s.p[1]));
    const ptLab = ptS.map((s, q) => (P.named ? String.fromCharCode(65 + q) : texLabel(s, q)));
    const ptSeen = ptShapes.map(() => false), ptIn = ptShapes.map(() => []);
    const pxPt = 300 / 96 * k; // pt per CSS px of the render
    // (export review r3, verify-editor-3) a point shape whose path is not drawn is marked with the next marker shape after
    // the tracked points' (dot, square, ...), never a second kind of dot, and the caption names it by that shape
    const untracked = () => ptShapes.map((z, q) => q).filter((q) => !tracked.some((y) => y.re === ptShapes[q].re && y.im === ptShapes[q].im));
    for (const [i, t] of ts.entries()) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (pw + gap), y = row * (tH + ph + 6) + tH;
      const a = await XD.art(cropRGB(raws[i], c), { x0: 0, x1: 1, y0: 0, y1: 1 }, { mode: o.ink === 'bw' ? 'grey' : 'rgb', wpt: pw });
      items.push(`<image x="${f2(x)}" y="${f2(y)}" width="${f2(pw)}" height="${f2(ph)}" preserveAspectRatio="none" xlink:href="${a.url}"/>`);
      if (kind === 'land') { items.push(`<rect x="${f2(x)}" y="${f2(y)}" width="${f2(pw)}" height="${f2(ph)}" fill="none" stroke="#000000" stroke-width="0.5"/>`); lines.push({ x0: x, y0: y, x1: x + pw, y1: y + ph, kind: 'frame' }); }
      items.push(XD.at(titles[i], x, y - 4 - titles[i].d, 'start', 'base', 'title'));
      const g = raws[i].globe;
      if (g && (kind === 'globe' || kind === 'phaseGlobe')) {
        const proj = globeProj(g, raws[i], c, x, y, k);
        if (kind === 'globe') {
          if (i === 0) tracked = globePathPoints(shapes, srcWin, Hof, m, proj, 0.18 * pw, 4);
          let pm = '';
          for (const s of openS) {
            const d2 = ptPath(globeEdge(s, Hof(t), proj, srcWin)), col = o.ink === 'bw' ? '#000000' : tonesOf(s, o).edge;
            if (d2) pm += `<path d="${d2}" fill="none" stroke="#ffffff" stroke-width="${f2(3.5 * pxPt)}" stroke-linecap="round" stroke-opacity="1"/><path d="${d2}" fill="none" stroke="${col}" stroke-width="${f2(Math.max(0.6, 1.5 * pxPt))}" stroke-dasharray="3 2"/>`;
          }
          const un = untracked();
          ptShapes.forEach((z, q) => {
            const e = proj(Hof(t)(z)), u = un.indexOf(q);
            if (e) { ptSeen[q] = true; ptIn[q].push(i); }
            if (u < 0 || !e) return;
            const mk = PTS[(tracked.length + u) % 4];
            pm += XD.marker(mk[0], e[0], e[1], 1.9, o.ink === 'bw' ? '#000000' : mk[1], '#ffffff', 0.4);
          });
          tracked.forEach((z, q) => {
            const sample = (a0, b0) => XD.sample((u) => proj(Hof(u)(z)), a0, b0, 48, 0.25);
            const col2 = o.ink === 'bw' ? '#000000' : PTS[q % 4][1];
            if (t < m) pm += `<path d="${ptPath(sample(t, m))}" fill="none" stroke="#444444" stroke-width="0.7" stroke-dasharray="0 1.8" stroke-linecap="round"/>`;
            if (t > 0) { const d2 = ptPath(sample(0, t)); pm += `<path d="${d2}" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/><path d="${d2}" fill="none" stroke="${col2}" stroke-width="0.6" stroke-linecap="round"/>`; }
            const e = proj(Hof(t)(z));
            if (e) pm += XD.marker(PTS[q % 4][0], e[0], e[1], 1.9, col2, '#ffffff', 0.4);
          });
          items.push(pm);
        }
        items.push(globeLabels(g, raws[i], c, x, y, k, tp - 1));
      }
    }
    if (keyW) {
      const R = keyW / 2 - 12, r0k = R * 0.55, kx = W - keyW / 2, ky = rows * (tH + ph + 6) / 2 + tH / 2, kid = `${XD.ns}-key`;
      const url = await ringKey(R, 300);
      items.push(`<clipPath id="${kid}"><path d="M${f2(kx - R)} ${f2(ky)}a${f2(R)} ${f2(R)} 0 1 0 ${f2(2 * R)} 0a${f2(R)} ${f2(R)} 0 1 0 ${f2(-2 * R)} 0ZM${f2(kx - r0k)} ${f2(ky)}a${f2(r0k)} ${f2(r0k)} 0 1 1 ${f2(2 * r0k)} 0a${f2(r0k)} ${f2(r0k)} 0 1 1 ${f2(-2 * r0k)} 0Z" clip-rule="evenodd"/></clipPath>`
        + `<image x="${f2(kx - R)}" y="${f2(ky - R)}" width="${f2(2 * R)}" height="${f2(2 * R)}" preserveAspectRatio="none" clip-path="url(#${kid})" xlink:href="${url}"/>`
        + `<circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(R)}" fill="none" stroke="#000000" stroke-width="0.5"/><circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(r0k)}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
      items.push(XD.at(XD.tex('0', tp - 1), kx + R + 1.5, ky, 'start', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\pm\\pi', tp - 1), kx - R - 1.5, ky, 'end', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\arg H_t', tp - 1), kx, ky - R - 3, 'middle', 'bottom', 'key'));
    }
    const box = kind === 'land' && raws[0].land ? raws[0].land.box : null;
    // (export review r3, editor-18) the reliefs' floor marks: Re and Im along the front edges, through each frame's camera
    if (kind === 'land') for (const [i] of ts.entries()) {
      const L = raws[i].land, col = i % cols, row = Math.floor(i / cols);
      if (!L || !L.MVP) continue;
      const x = x0 + col * (pw + gap), y = row * (tH + ph + 6) + tH;
      const cid = `${XD.ns}-lf${i}`;
      items.push(`<clipPath id="${cid}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(pw)}" height="${f2(ph)}"/></clipPath><g clip-path="url(#${cid})">${landFloor(L, raws[i], (ii, jj) => [x + (ii - c[0]) * k, y + (jj - c[2]) * k], { x, top: y, iw: pw, ih: ph }, tp - 1, lp - 1, 2)}</g>`);
    }
    // (export review r3, editor-10) Phase on the sphere: the zeros and poles a frame hides on the far side
    let hiddenZP = 0, allZP = 0;
    if (kind === 'phaseGlobe') for (const [i, t] of ts.entries()) {
      const g = raws[i].globe, proj = g ? globeProj(g, raws[i], c, 0, 0, 1) : null;
      if (!proj) continue;
      for (const r of zerosPolesIn(A.plotFAt(t), expandBox(A.screenBox('L0'), 2), 30)) { allZP++; if (!proj(r.z)) hiddenZP++; }
      await breathe();
    }
    const pts = tracked.map((z) => ({ z, own: ptShapes.some((y) => y.re === z.re && y.im === z.im) }));
    // the other point shapes: their marker and the frames where they are on the far side
    const marks = kind === 'globe' ? untracked().map((q, u) => ({ q, z: ptShapes[q], lab: ptLab[q], mk: (tracked.length + u) % 4, hiddenIn: ts.map((t, i) => i).filter((i) => !ptIn[q].includes(i)) })).filter((x) => ptSeen[x.q]) : [];
    let Hfig = rows * (tH + ph + 6) - 2;
    // (verify-editor-3) a slide has no caption: a key under the frames says what each marker is (H_t(0.8i), H_t(0))
    if (o.for === 'slides' && (tracked.length || marks.length)) {
      const ent = [...tracked.map((z, q) => ({ mk: q % 4, z })), ...marks.map((x) => ({ mk: x.mk, z: x.z }))].map((e) => ({ mk: PTS[e.mk], it: XD.tex(`H_t(${cxTex(e.z)})`, tp) }));
      const r0m = 1.9, gapE = 10, wE = ent.map((e) => 2 * r0m + 2.5 + e.it.w), tot = wE.reduce((a, b) => a + b, 0) + gapE * (ent.length - 1);
      let xe = (W - keyW - tot) / 2;
      const ye = Hfig + 4 + tp * 0.6;
      for (const [q, e] of ent.entries()) {
        items.push(XD.marker(e.mk[0], xe + r0m, ye, r0m, o.ink === 'bw' ? '#000000' : e.mk[1], '#ffffff', 0.4));
        items.push(XD.at(e.it, xe + 2 * r0m + 2.5, ye, 'start', 'mid', 'key'));
        xe += wE[q] + gapE;
      }
      Hfig = ye + tp * 0.9;
    }
    return { items, defs: '', lines, H: Hfig, info: { film: kind, ts, m, labs: ts.map(lab), tracked, pts, marks, hidden: ptShapes.map((z, q) => ({ z, lab: ptLab[q] })).filter((x, q) => !ptSeen[q]), open: openS.length > 0, outline: kind === 'phaseGlobe' && shapes.some((s) => kindType(s) !== 'point'), hiddenZP: allZP && hiddenZP / allZP > 0.5 ? hiddenZP : 0, box, land: kind === 'land' } };
  }
  // Phase: a filmstrip of the portraits of H_t over one window (colour with level lines, or B/W contours)
  async function figFilmPhase(o, P, W, T) {
    const [tp, lp] = T;
    const d = A.defo(), m = d.m, ts = filmTimes(m), lab = fracTexOf(m);
    const bw = o.ink === 'bw', scr = A.screenBox('L');
    const Fs = ts.map((t) => A.plotFAt(t));
    // the window: the zeros and poles of every frame with a margin of their spread, inside the screen window
    let box = scr, zps = Fs.map(() => []);
    if (o.crop !== 'screen') {
      let b = null;
      // (each search is bounded at 40 ms and runs in a task of its own: the page keeps its frames)
      for (const F of Fs) { for (const r of zerosPolesIn(F, scr, 40)) b = unionBox(b, { x0: r.z.re, x1: r.z.re, y0: r.z.im, y1: r.z.im }); await breathe(); }
      if (b) {
        const span = Math.max(b.x1 - b.x0, b.y1 - b.y0, 1), half = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + 0.5 * span, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        box = { x0: Math.max(scr.x0, cx - half), x1: Math.min(scr.x1, cx + half), y0: Math.max(scr.y0, cy - half), y1: Math.min(scr.y1, cy + half) };
      }
    }
    const cols = W >= 400 || o.for === 'slides' ? 4 : 2, rows = 4 / cols, gap = 8;
    const dc = (A.capParts().dc) || 'enhanced', keyW = bw || dc === 'classic' || dc === 'cauchy' ? 0 : Math.min(54, W * 0.16);
    // (the window does not depend on the ink: colour and B/W show the same part of the plane; export review r3, editor-19)
    const roughW = (W - (dc === 'classic' || dc === 'cauchy' ? 0 : Math.min(54, W * 0.16)) - 30) / cols;
    const stp = stepFor(box, roughW) / 2;
    box = { x0: Math.floor(box.x0 / stp + 1e-9) * stp, x1: Math.ceil(box.x1 / stp - 1e-9) * stp, y0: Math.floor(box.y0 / stp + 1e-9) * stp, y1: Math.ceil(box.y1 / stp - 1e-9) * stp };
    const step = stepFor(box, roughW);
    zps = [];
    for (const F of Fs) { zps.push(zerosPolesIn(F, box, 40)); await breathe(); }
    const mL = tickW(box, step, tp) + 3, mR = Math.max(2, overR(box, step, tp));
    let pw = (W - keyW - mL - gap * (cols - 1) - mR) / cols, ph = pw / aspect(box);
    const titles = ts.map((t, i) => frameTitle(i, lab(t), lp));
    const tH = Math.max(...titles.map((it) => it.a + it.d + 4));
    const rowH0 = tH + tp * 1.05 + 4.2 + 2;
    const hmax = Math.min((W * 0.6) / rows, (P.maxH - rows * rowH0) / rows);
    if (ph > hmax) { ph = hmax; pw = ph * aspect(box); }
    const x0 = (W - keyW - (mL + cols * pw + (cols - 1) * gap + mR)) / 2;
    const rowH = rowH0 + ph;
    const items = [], lines = []; let defs = '';
    // level lines on a grid fine enough for the panel (bounded by the cost of F)
    const t0 = performance.now(); for (let i = 0; i < 50; i++) Fs[Fs.length - 1](C(box.x0 + i * 0.013, box.y0 + i * 0.017)); const per = (performance.now() - t0) / 50;
    // (a frame's grid costs about 25 ms of F: four of them, each in its own task)
    const n = Math.max(40, Math.min(120, Math.floor(Math.sqrt(25 / Math.max(per, 1e-4)))));
    const ownLines = !bw && (dc === 'modulus' || dc === 'grid' || dc === 'classic' || dc === 'cauchy');
    const ks = ownLines ? [] : [...Array(12).keys()].map((q) => q - 5);
    for (const [i, t] of ts.entries()) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + mL + col * (pw + gap), y = row * rowH + tH;
      let art;
      if (bw) { await breathe(); art = await bandsArt(Fs[i], box, pw, 300); }
      else { art = await artPanel('L', box, pw, Object.assign({}, o, { ink: 'colour' }), { mode: 'rgb', dpi: 300, T: t, ss: 2 }); if (!art) return null; }
      if (o.alive && !o.alive()) return null;
      await breathe();
      const L = await argLevels(Fs[i], box, n, ks), curves = [];
      for (const q of ks) {
        if (bw) curves.push({ pts: L[q], w: q === 0 || q === 6 ? 0.7 : 0.35, color: '#000000', dash: q === 6 ? '3 2' : null, cap: 'butt', noObst: true });
        else curves.push({ pts: L[q], w: 0.3, color: '#1a1a1a', cap: 'butt', noObst: true });
      }
      const points = zps[i].map((r) => (r.kind === 'pole' ? { z: [r.z.re, r.z.im], kind: 'ring', r: 1.6, sw: 0.6 } : { z: [r.z.re, r.z.im], r: 1.5, fill: '#000000', stroke: '#ffffff', sw: 0.5 }));
      const p = XD.panel({ x, y, w: pw, h: ph, box, step, art: [art], curves, points, axes: 'box', ylab: col === 0 ? 'left' : 'none', xtrim: { l: col > 0, r: col < cols - 1 }, tickPt: tp, labelPt: lp, ink: '#000000', lw: { frame: 0.5, tick: 0.5 } });
      items.push(p.markup); defs += p.defs; lines.push(...p.lines);
      items.push(XD.at(titles[i], x, y - 4 - titles[i].d, 'start', 'base', 'title'));
      await breathe();
    }
    if (keyW) {
      const R = keyW / 2 - 12, r0k = R * 0.55, kx = W - keyW / 2, ky = rows * rowH / 2, kid = `${XD.ns}-key`;
      const url = await ringKey(R, 300);
      items.push(`<clipPath id="${kid}"><path d="M${f2(kx - R)} ${f2(ky)}a${f2(R)} ${f2(R)} 0 1 0 ${f2(2 * R)} 0a${f2(R)} ${f2(R)} 0 1 0 ${f2(-2 * R)} 0ZM${f2(kx - r0k)} ${f2(ky)}a${f2(r0k)} ${f2(r0k)} 0 1 1 ${f2(2 * r0k)} 0a${f2(r0k)} ${f2(r0k)} 0 1 1 ${f2(-2 * r0k)} 0Z" clip-rule="evenodd"/></clipPath>`
        + `<image x="${f2(kx - R)}" y="${f2(ky - R)}" width="${f2(2 * R)}" height="${f2(2 * R)}" preserveAspectRatio="none" clip-path="url(#${kid})" xlink:href="${url}"/>`
        + `<circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(R)}" fill="none" stroke="#000000" stroke-width="0.5"/><circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(r0k)}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
      items.push(XD.at(XD.tex('0', tp - 1), kx + R + 1.5, ky, 'start', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\pm\\pi', tp - 1), kx - R - 1.5, ky, 'end', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\arg H_t', tp - 1), kx, ky - R - 3, 'middle', 'bottom', 'key'));
    }
    return { items, defs, lines, H: rows * rowH, info: { film: 'phase', ts, m, labs: ts.map(lab), box, bw, zp: zps, dc } };
  }
  // zeros and poles with a time bound of their own
  function zerosPolesIn(F, box, ms) {
    if (!Calc.zerosPoles) return [];
    try { return (Calc.zerosPoles(F, box, { target: null, max: 24, budget: 120000, grid: 24, deadline: performance.now() + ms }) || []).filter((r) => r && r.z && fin(r.z)); } catch (e) { return []; }
  }
  // the paths figure on the globe: H_t at t = end on the sphere over X's outline (the app's gray line), and the paths
  // t -> H_t(z) of a few points (the point shapes, else points of the boundaries) with heads at F(z)
  async function figGlobePaths(o, P, W, T) {
    const [tp] = T;
    const d = A.defo(), m = d.m, st = A.state();
    const asp = Math.min(A.paneAspect('R'), 1), wpt = W * 1.2, hpt = wpt * asp;
    const shapes = A.shapes(), srcWin = expandBox(A.screenBox('L0'), 3);
    const openS = P.dashOpen ? shapes.filter((s) => kindType(s) === 'area' && Region.isOpen && Region.isOpen(s) && globeCurves(s, srcWin).length) : [];
    const r = await A.art('R', { wpt, hpt, dpi: 300, ink: printInkFor(o, st.alpha), T: m, alive: o.alive, skipLines: openS.map((s) => s.id) });
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
    const Hs = new Map(), Hof = (t) => { const key = t.toFixed(6); if (!Hs.has(key)) Hs.set(key, A.homF(t)); return Hs.get(key); };
    // (the live globe's own points when it shows them, those mostly on the camera's side; else points of the boundaries)
    const live = A.globePaths ? A.globePaths() : null;
    let zs = live && live.length ? live.map((q) => C(q[0], q[1])).filter((z) => { let vis = 0; for (let i = 0; i <= 12; i++) if (proj(Hof(m * i / 12)(z))) vis++; return vis >= 8 && proj(Hof(m)(z)); }) : [];
    if (!zs.length) zs = globePathPoints(shapes, srcWin, Hof, m, proj, 0.07 * iw);
    const pxPt = 300 / 96 * k;
    let g = '';
    // (export review r3, editor-9) an open set's boundary, dashed (Homework); editor-3: a point shape whose path is not
    // drawn is marked at F(z) where it faces the camera, else named as hidden
    for (const s of openS) {
      const d2 = ptPath(globeEdge(s, Hof(m), proj, srcWin)), col = o.ink === 'bw' ? '#000000' : tonesOf(s, o).edge;
      if (d2) g += `<path d="${d2}" fill="none" stroke="#ffffff" stroke-width="${f2(3.5 * pxPt)}" stroke-linecap="round"/><path d="${d2}" fill="none" stroke="${col}" stroke-width="${f2(Math.max(0.6, 1.5 * pxPt))}" stroke-dasharray="3 2"/>`;
    }
    // (verify-editor-3) a point shape without an arrow: F(z) marked with a square (then a triangle, ...), not a second
    // kind of dot (the arrows start at dots); the caption names it by that shape
    const hidden = [], marks = [];
    let pq = -1;
    for (const s of shapes) {
      if (kindType(s) !== 'point' || !s.p) continue;
      const z = C(s.p[0], s.p[1]), lab = P.named ? String.fromCharCode(65 + ++pq) : texLabel(s, ++pq);
      if (zs.some((y) => y.re === z.re && y.im === z.im)) continue;
      const e = proj(Hof(m)(z));
      if (!e) { hidden.push({ z, lab }); continue; }
      const mk = 1 + marks.length % 3;
      marks.push({ z, lab, mk });
      g += XD.marker(PTS[mk][0], e[0], e[1], 1.9, o.ink === 'bw' ? '#000000' : PTS[mk][1], '#ffffff', 0.4);
    }
    g += A.pathsSvg(pathItems(zs, Hof, m, proj, true), { u: 1 });
    items.push(g, globeLabels(r.globe, r, c, x, y, k, tp - 1));
    return { items, defs: '', lines: [], H: y + ih + 4, info: { film: null, globePaths: true, m, kept: zs.length, pts: zs.map((z) => ({ z })), hidden, marks, open: openS.length > 0 } };
  }
