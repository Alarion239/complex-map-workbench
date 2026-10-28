  // ---- labels of points, roots, targets and curve ends: one placer per plane and frame ----
  // Callers queue their labels (placeLabels); once the frame's drawing is done (a microtask, before paint) they are
  // placed together, so a label avoids every other label, every marker, the selected shape's handles and the cut
  // handles, whichever was drawn first, and prefers spots off the curves. Labels at one point merge ("z₀ = z₁");
  // a label with no free spot is dropped rather than printed over another. pane.begin() discards a stale queue.
  function labelReg(pane) {
    if (!pane.labels) pane.labels = { items: [], marks: [], curves: [], view: Object.assign({}, pane.view), queued: false };
    return pane.labels;
  }
  // the curves drawn in this plane: shapes of 'list' under F (from drawPoints)
  function labelCurves(pane, F, list) { labelReg(pane).curves.push({ F, list }); }
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
    if (artMode) return;
    const ctx = pane.ctx;
    let pi = 0;
    const labels = [];
    if (!opt.thin) labelCurves(pane, F, opt.list || S.shapes);   // labels keep off these curves
    for (const s of opt.list || S.shapes) {
      if (s.visible === false || kindType(s) !== 'point') continue;
      const mk = typeof Construct !== 'undefined' ? Construct.pointMark(s) : null;   // (v16: 'helper' | 'ring' | null)
      const idx = mk === 'helper' ? -1 : pi++;
      if (s._atInf) continue;
      const w = F(C(s.p[0], s.p[1]));
      if (!CX.isFin(w)) continue;
      const [x, y] = pane.w2s(w);
      if (x < -20 || y < -20 || x > pane.w + 20 || y > pane.h + 20) continue;
      const ink = shapeInk(s);
      if (mk) {
        // (v16 review picture-10) the same outer extent as a dot (r 4 and its halo reach 5 px): a 1.5 px ring at r 3.5
        // inside a 3.5 px halo (1 px each side of the ring), unfilled, so it reads hollow on any pattern
        const rr = mk === 'helper' ? (opt.thin ? 2 : 2.75) : (opt.thin ? 2.4 : 3.5);
        ctx.strokeStyle = TH.halo; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
        ctx.strokeStyle = ink.edge; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, rr, 0, TAU); ctx.stroke();
        if (!opt.thin && s.id === selected && opt.domain) { ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke(); }
        if (!opt.thin && mk !== 'helper') labels.push({ x, y, text: opt.target ? targetLabel(s, idx) : pointLabel(s, idx, opt.primes || 0), word: !!(s.label && (I18N.lang === 'en' ? /\s|[A-Za-z]{3,}/ : /\s|\p{L}{3,}/u).test(s.label)) });
        continue;
      }
      ctx.fillStyle = ink.edge;
      ctx.strokeStyle = TH.halo;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, opt.thin ? 2.6 : 4, 0, TAU); ctx.stroke(); ctx.fill();
      if (!opt.thin && s.id === selected && opt.domain) { ctx.strokeStyle = ink.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke(); }
      if (!opt.thin) labels.push({ x, y, text: opt.target ? targetLabel(s, idx) : pointLabel(s, idx, opt.primes || 0), word:!!(s.label && (I18N.lang === 'en' ? /\s|[A-Za-z]{3,}/ : /\s|\p{L}{3,}/u).test(s.label)) });
    }
    if (labels.length) placeLabels(ctx, pane, labels);
  }
  // branch cuts and poles of step k+1 live in the plane of stage k
  const offEdge = (pane, x, y, m) => x < m || y < m || x > pane.w - m || y > pane.h - m;
  function drawCuts(pane, k, editable, thin) {
    if (artMode) return [];
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
          let R = Math.min(bx.x1 - bx.x0, bx.y1 - bx.y0) * 0.33;
          // (st.handleR: an example's own radius, clear of its curve, while that is in view and 20 px from the centre)
          if (st.handleR > 0) { const q = pane.w2s(CX.add(c.p, CX.scale(d, st.handleR))), o = pane.w2s(c.p); if (!offEdge(pane, q[0], q[1], 24) && Math.hypot(q[0] - o[0], q[1] - o[1]) >= 20) R = st.handleR; }
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
        if (thin && offEdge(pane, x, y, 4 * sc + 2)) continue;   // (review design-20: a card never shows half a mark)
        ctx.fillStyle = TH.zero; ctx.strokeStyle = TH.halo; ctx.lineWidth = 2.5 * sc;
        ctx.beginPath(); ctx.arc(x, y, 4 * sc, 0, TAU); ctx.stroke(); ctx.fill();
      }
    }
    for (const p of b.poles) {
      if (!CX.isFin(p)) continue;
      const [x, y] = pane.w2s(p);
      const r = 4.5 * sc;
      if (thin && offEdge(pane, x, y, r + 2)) continue;
      const cross = () => { ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); };
      ctx.strokeStyle = TH.halo; ctx.lineWidth = 4 * sc; cross();
      ctx.strokeStyle = TH.pole; ctx.lineWidth = 1.75 * sc; cross();
    }
    ctx.restore();
    return handles;
  }
  // images of the two banks of each ray cut, in the plane of stage R (dashed)
  function drawCutBanks(pane, R) {
    if (artMode) return;
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
    if (artMode) return;
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
    if (artMode) return;
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
      chip(ctx, hd.x + 14, hd.y, `θ ${I18N.num(CX.fmtNum(hd.deg, 1).replace('-', '−'))}°`, TH.cut, TH.cut);
    }
  }
  // ---- zeros and poles of a 'zp' step, dragged in its input plane (notes/ui-design/zeros-poles.md) ----
  // A zero is a filled dot in the zero ink with a pip, a pole a cross in the pole colour, labelled ζ₁, ζ₂, … and p₁, p₂, …
  // as on the card (shape handles are white squares and circles; target roots are rings in the target's colour).
  const ZP_KINDS = ['zeros', 'poles'];
  // [UX54] by its number, kept for life (Constr.zpNum: st.zpNums, else its place)
  const zpSym = (kind, i, st) => (kind === 'zeros' ? 'ζ' : 'p') + sub(Constr.zpNum(st, kind, i));
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
  // (review verify-4, design-17 / math-14: a zero or pole field shows the true minus, U+2212, as the Parameters' value
  // fields do; the stored text keeps the ASCII hyphen, so a field's text is read back through zpRaw)
  const zpShow = (raw) => String(raw).replace(/-/g, '−');
  const numShow = zpShow;
  const zpRaw = (el) => el.value.replace(/−/g, '-');
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
      const t = zpSym(kind, i, S.steps[zs.k - 1]);
      // (no label where handles crowd: closer than 18 px to one drawn before, unless it is held or selected)
      const crowd = !hot && !sel && zpHandlesL.slice(0, -1).some((q) => Math.hypot(q.x - x, q.y - y) < 18);
      ctx.font = `italic 500 13px ${TH.math}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      if (!crowd) {
        ctx.lineWidth = 3; ctx.strokeStyle = TH.halo; ctx.strokeText(t, x + 9, y - 8);
        ctx.fillStyle = kind === 'zeros' ? TH.ink : TH.pole; ctx.fillText(t, x + 9, y - 8);
      }
      if (dr && dr.off) {
        ctx.globalAlpha = 1;
        const msg = (typeof Construct !== 'undefined' && Construct.zpOffNote(dr.k, dr.kind, dr.i)) || $t('Release to remove {t}', { t });   // (v16 [C12])
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
    for (const el of document.querySelectorAll(`#pipeline .card[data-k="${k}"] input[data-zp], #propsPanel .insp-step[data-k="${k}"] input[data-zp]`)) {
      const row = el.closest('.zp-item');
      if (row) row.classList.toggle('wide1', wide);
      if (document.activeElement === el) continue;
      const [kind, i] = el.dataset.zp.split(':');
      const v = lists[kind][+i];
      if (v != null && el.value !== zpShow(v)) { el.value = zpShow(v); el.classList.remove('bad'); }
    }
  }
  // the card's parameter fields again (after a zero or pole was added or removed), keeping the field list's scroll
  function refreshZpCard(k) {
    const st = S.steps[k - 1];
    if (!st || st.type !== 'zp') return;
    for (const [sel, pre] of [[`#pipeline .card[data-k="${k}"] .params`, 'p']]) {
      const el = document.querySelector(sel);
      if (!el) continue;
      const top = el.scrollTop;
      el.innerHTML = '';
      el.append(zpFields(st, k, pre));
      el.scrollTop = top;
    }
    if (insp) insp.refreshParams(k);   // (v15: the Inspector's editor)
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
  function zpFreeSpot(k, vIn) {
    const st = S.steps[k - 1];
    if (!vIn) paneL.setView(leftView());
    const v = vIn || leftView(), d0 = Math.pow(10, Math.floor(Math.log10(40 / v.s)));
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
    if (list.length >= Funcs.ZP_MAX) { sndError(); toast(kind === 'zeros' ? $t('At most {zpMax} zeros (degree {zpMax}, as Write by zeros and poles allows).', { zpMax: Funcs.ZP_MAX }) : $t('At most {zpMax} poles (degree {zpMax}, as Write by zeros and poles allows).', { zpMax: Funcs.ZP_MAX })); return -1; }
    const z = v || zpFreeSpot(k);
    list.push(Funcs.zpItem(z));
    zpWrite(st, kind, list);
    zpSel = { k, kind, i: list.length - 1 };
    if (selected) { selected = null; buildShapeList(); }
    chainChanged(false);
    refreshZpCard(k);
    return list.length - 1;
  }
  // the Inspector's Add zero / Add pole (v15, DESIGN.md 2.4): a new zero or pole at the visible centre of the step's
  // input (X when it shows that plane, else the view that plane would have), snapped to the grid; never Show alone
  function zpAddFromCard(k, kind) {
    const here = !!zpStep() && zpStep().k === k;
    const i = zpAdd(k, kind, here ? null : zpFreeSpot(k, fittedView(paneL, k - 1)));
    if (i < 0) return;
    commit();
    requestRender('OL');
    sndSay(kind === 'zeros' ? $t('Added zero {mark} of {f}.', { mark: zpSym(kind, i, S.steps[k - 1]), f: `f${sub(k)}` }) : $t('Added pole {mark} of {f}.', { mark: zpSym(kind, i, S.steps[k - 1]), f: `f${sub(k)}` }));
    const inp = document.querySelector(`#propsPanel .insp-step[data-k="${k}"] input[data-zp="${kind}:${i}"], #pipeline .card[data-k="${k}"] input[data-zp="${kind}:${i}"]`);
    if (inp) inp.scrollIntoView({ block: 'nearest' });
  }
  function zpRemove(k, kind, i) {
    const st = S.steps[k - 1];
    if (!st || st.type !== 'zp') return;
    const list = zpItems(st, kind);
    if (i < 0 || i >= list.length) return;
    if (typeof Constr !== 'undefined') cmZeroRemoved(k, kind, i);   // (v16 [C12])
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
      const full = n[kind] >= MAX, one = kind === 'zeros' ? $tx('zp', 'zero') : $tx('zp', 'pole');
      const b = h('button', { class: 'zp-add ' + kind, type: 'button',
        'data-tip': full ? (kind === 'zeros' ? $tn('At most {n} zeros', 'At most {n} zeros', MAX) : $tn('At most {n} poles', 'At most {n} poles', MAX)) : kind === 'zeros' ? $t('Add a zero (or Shift-click in the input plane)') : $t('Add a pole (or Shift-⌘-click in the input plane)'),
        'aria-label': kind === 'zeros' ? $t('Add a zero to f{k} ({x} now)', { k: sub(k), x: n[kind] }) : $t('Add a pole to f{k} ({x} now)', { k: sub(k), x: n[kind] }),
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
    const id = `${pre}${k}_${kind}${i}`, sym = zpSym(kind, i, st);
    const input = h('input', { class: 'inp', id, value: zpShow(raw), spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'data-fx': '' });
    input.dataset.zp = `${kind}:${i}`;
    // the list is rebuilt from this field set's own fields (an emptied field drops out until it is left)
    const fields = () => [...input.closest('.params').querySelectorAll(`input[data-zp^="${kind}:"]`)];
    input.addEventListener('input', () => {
      input.classList.toggle('bad', !zpParse(zpRaw(input)));
      st.params[kind] = fields().map((el) => zpRaw(el).trim()).filter((x) => x).join(', ');
      Funcs.typedList(st, kind, st.params[kind]);
      chainChanged(false);
      requestRender('OL');
    });
    // (a field emptied, or holding a list '0.5, 0.5i': the card again, one field per item, so fields and handles
    // keep their indices)
    input.addEventListener('change', () => {
      if (Funcs.splitList(input.value).filter((x) => x.trim()).length !== 1) { refreshZpCard(k); syncZpFields(k); }
      else if (input.value !== zpShow(zpRaw(input))) input.value = zpShow(zpRaw(input));
      commit();
    });
    input.addEventListener('paste', () => setTimeout(() => { if (Funcs.splitList(input.value).filter((x) => x.trim()).length > 1) { input.blur(); } }, 0));
    const del = h('button', { class: 'icon-btn zp-del', type: 'button', 'data-tip': $t('Remove {sym}', { sym }), 'aria-label': kind === 'zeros' ? $t('Remove zero {i} of f{k}', { i: Constr.zpNum(st, kind, i), k: sub(k) }) : $t('Remove pole {i} of f{k}', { i: Constr.zpNum(st, kind, i), k: sub(k) }), html: ICONS.close,
      onclick: (e) => { e.stopPropagation(); zpRemove(k, kind, i); } });
    const lab = h('label', { class: 'pl zp-sym ' + kind, for: id, 'data-tip': kind === 'zeros' ? $t('Zero {sym}: drag it in the input plane', { sym }) : $t('Pole {sym}: drag it in the input plane', { sym }) }, sym);
    // (v15, review design-8: every zero and pole row has its Argand button, named by the indexed symbol)
    const arg = h('button', { class: 'icon-btn argand', type: 'button', 'data-tip': $t('Pick on an Argand diagram'), 'aria-label': $t('Pick {label} on an Argand diagram', { label: sym }), html: ICONS.argand,
      onclick: (e) => { e.preventDefault(); e.stopPropagation(); if (padEl) closePad(); else openArgandPad(e.currentTarget, input); } });
    return h('div', { class: 'pf zp-item' }, lab, h('div', { class: 'pair' }, input, arg, del));
  }
  // "Write by zeros and poles" (a polynomial, rational or rational custom step) and back ("Write by coefficients")
  function convertZp(k, to) {
    const st = S.steps[k - 1];
    if (!st) return null;
    let r;
    try { r = to ? Funcs.toZerosPoles(st) : Funcs.fromZerosPoles(st); } catch (e) { r = { error: e.message || String(e) }; }
    if (!r || r.error || !r.step) { sndError(); toast(((r && r.error) || $t('This step cannot be rewritten.')).replace(/\.?$/, '.')); return null; }
    S.steps[k - 1] = { type: r.step.type, params: Object.assign(Funcs.defaults(r.step.type), r.step.params), on: st.on !== false };
    zpSel = null;
    chainChanged(true);
    setFocus(k);
    commit();
    undoToast(to ? $t('f{k} is now given by its zeros and poles ({note}): drag them in its input plane.', { k: sub(k), note: r.note }) : $t('f{x} is now given by its coefficients.', { x: sub(k) }));
    return cardButton(k);
  }
  // [v16.5 UX09] a finger: handles drawn 12 px and grabbed within 22 px (the nearest wins), as zeros and poles are; a
  // mouse: 7 px marks grabbed within 8 px. Before any press, a coarse pointer counts as a finger
  const fingerNow = () => (ptrTouch != null ? ptrTouch : touchUI());
  function handleAt(pane, sel, x, y) {
    const finger = ptrTouch;
    let best = null, bd = Infinity;
    for (const [key, hz] of Region.handlesOf(sel)) {
      if (typeof Construct !== 'undefined' && (sel.def || sel.fixed || (sel.at && sel.at[key]))) continue;   // (v16: a bound handle is no handle; v16.3: nor a fixed shape's)
      const [hx, hy] = pane.w2s(hz);
      if (finger) { const d = Math.hypot(hx - x, hy - y); if (d < 22 && d < bd) { bd = d; best = key; } }
      else if (Math.abs(hx - x) < 8 && Math.abs(hy - y) < 8) return key;
    }
    return best;
  }
  function drawHandles(pane, list) {
    const s = (list || S.shapes).find((x) => x.id === selected);
    if (!s) return;
    const ctx = pane.octx;
    const k = shapeInk(s).edge, hr = fingerNow() ? 6 : 3.5;
    for (const [key, z] of Region.handlesOf(s)) {
      if (typeof Construct !== 'undefined' && (s.def || s.fixed || (s.at && s.at[key]))) continue;   // (v16; v16.3 user-1: a fixed unit circle or axis)
      const [x, y] = pane.w2s(z);
      ctx.fillStyle = TH.surface; ctx.strokeStyle = k; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (key === 'c' || key === 'm') ctx.arc(x, y, hr, 0, TAU); else ctx.rect(x - hr, y - hr, 2 * hr, 2 * hr);
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
      // display only: the decimal comma in Russian (GLOSSARY 2.3)
      if (t) { const [x, y] = pane.w2s(draft.cursor); chip(ctx, x + 14, y + 14, (I18N.lang === 'en' ? t : t.replace(/(\d)\.(\d)/g, '$1,$2')).replace(/-/g, '−')); }
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

