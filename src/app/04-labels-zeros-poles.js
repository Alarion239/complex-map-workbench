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
  // labels: STIX italic for variables, the UI face for words. it: {x, y, text, word?, rad? (marker radius)}
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
    const t0 = labelProbe ? performance.now() : 0;
    try { flushLabelsIn(pane, r); } finally { pane.view = v0; if (labelProbe) labelProbe(performance.now() - t0, r.curves.length); }
  }
  // (a probe for the time of a pass and the curves it keeps the labels off, set by the test page and the perf run: none in the
  // published page)
  let labelProbe = null;
  function setLabelProbe(f) { labelProbe = f; }
  // (#1059) a point's label keeps the offset of its last full placement, per point id: on the move it is drawn there
  // (no re-pick, so no side flips). A full placement is a function of the view alone (the parked-frame rule), so the
  // offset it records is not carried into the next full placement: the stop may move a label that the moving frames held
  const labelSlots = new Map();
  const LABEL_DEFAULT = [7, -7];   // north-east of the point
  // (a spot's cost: the curves it touches count CURVE_COST_PER each, up to CURVE_COST_CAP; a label nearer another marker, AMBIGUOUS_COST)
  const CURVE_COST_CAP = 3, CURVE_COST_PER = 0.5, AMBIGUOUS_COST = 4;
  // (the points that are gone, deleted or replaced with the chain, lose their offsets)
  function pruneLabelSlots() {
    if (!labelSlots.size) return;
    const live = new Set();
    for (const s of S.shapes) live.add(s.id);
    for (const s of S.targets || []) live.add(s.id);
    for (const id of labelSlots.keys()) if (!live.has(id)) labelSlots.delete(id);
  }
  function flushLabelsIn(pane, r) {
    const ctx = pane.ctx, W = pane.w, H = pane.h;
    const lite = !!r.lite;
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
      else groups.push({ x: it.x, y: it.y, texts: [it.text], word, id: it.id });
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
      // a candidate spot at offset (dx, dy) from the point, or null when a label, a marker or a handle is there
      const evalCand = (dx, dy, pen) => {
        const x0 = g.x + dx, y1 = g.y + dy, y0 = y1 - th, x1 = x0 + tw;
        if (x0 < 2 || x1 > W - 2 || y0 < 2 || y1 > H - 2) return null;
        const hit = (b) => x0 < b.x1 && x1 > b.x0 && y0 < b.y1 && y1 > b.y0;
        if (placed.some(hit) || hard.some(hit)) return null;
        if (marks.some(([mx, my, rad]) => (Math.abs(mx - g.x) >= 2.5 || Math.abs(my - g.y) >= 2.5) && x0 < mx + rad && x1 > mx - rad && y0 < my + rad && y1 > my - rad)) return null;
        // a label nearer another marker than its own reads as that marker's: allowed only as a last resort
        const bx = (x0 + x1) / 2, by = (y0 + y1) / 2, dOwn = Math.hypot(bx - g.x, by - g.y);
        const amb = marks.some(([mx, my]) => (Math.abs(mx - g.x) >= 2.5 || Math.abs(my - g.y) >= 2.5) && Math.hypot(bx - mx, by - my) < dOwn - 1);
        const cc = curveCost(x0, y0, x1, y1);
        return { x: x0, y: y1, cost: Math.min(CURVE_COST_CAP, CURVE_COST_PER * cc) + pen + (amb ? AMBIGUOUS_COST : 0) };
      };
      const slot = g.id !== undefined ? labelSlots.get(g.id) : undefined;
      let x, y;
      if (lite && g.id !== undefined) {
        // on the move: the last full placement's offset, drawn as it is
        [x, y] = [g.x + (slot || LABEL_DEFAULT)[0], g.y + (slot || LABEL_DEFAULT)[1]];
      } else {
        // at rest: the best candidate for the view alone, so a resting picture does not depend on the path taken to it
        let best = null, bestCost = Infinity;
        for (const [dx, dy, pen] of cands) {
          const e = evalCand(dx, dy, pen);
          if (e && e.cost < bestCost) { best = e; bestCost = e.cost; if (e.cost === 0) break; }
        }
        if (!best) continue;   // no free spot: dropped, never printed over another label or a handle
        ({ x, y } = best);
        if (g.id !== undefined) labelSlots.set(g.id, [x - g.x, y - g.y]);
      }
      placed.push({ x0: x - 1, x1: x + tw + 1, y0: y - th - 1, y1: y + 2, text });
      ctx.strokeStyle = TH.halo; ctx.strokeText(text, x, y);
      ctx.fillStyle = TH.ink; ctx.fillText(text, x, y);
    }
    ctx.restore();
    if (!lite) pruneLabelSlots();
    if (labelProbe) pane.labelsPlaced = placed;   // (what the last pass put down, kept only where a probe is set: the suites compare it at rest and after a glide)
  }
  // ([#252] a point of plane s seen in plane k > s is its image under k − s steps: that many primes; Hₜ's marks (< 0)
  // as they are)
  const primesOf = (s, p) => (p > 0 ? Math.max(0, p - shapeStage(s)) : p || 0);
  function drawPoints(pane, F, opt = {}) {
    if (artMode) return;
    const ctx = pane.ctx;
    let pi = 0;
    const labels = [];
    // ([#253] opt.k: the plane drawn; a shape of a later plane is not, of an earlier one its image)
    const list = opt.list || S.shapes.filter((s) => !!shapeF(s, F, opt.k));
    // (opt.lite: a view on the move, a glide or a scrub, has no curves to keep the labels off: sampling every curve through the
    // plane's map costs up to 600 evaluations a curve. Its labels keep their last full placement's offsets, so they do not
    // re-pick; the full placement of the view at rest keeps the curves off)
    if (!opt.thin && !opt.lite) labelCurves(pane, F, list.filter((s) => !shapeStage(s)));   // labels keep off these curves
    for (const s of list) {
      if (s.visible === false || kindType(s) !== 'point') continue;
      const mk = Construct.pointMark(s);   // ('helper' | 'ring' | null)
      const idx = mk === 'helper' ? -1 : pi++;
      if (s._atInf) continue;
      const w = (opt.list ? F : shapeF(s, F, opt.k))(C(s.p[0], s.p[1]));
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
        if (!opt.thin && s.id === selected && (opt.domain || (opt.editK > 0 && shapeStage(s) === opt.editK))) { ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke(); }
        if (!opt.thin && mk !== 'helper') labels.push({ x, y, id: s.id, text: opt.target ? targetLabel(s, idx) : pointLabel(s, idx, primesOf(s, opt.primes)), word: !!(s.label && (I18N.lang === 'en' ? /\s|[A-Za-z]{3,}/ : /\s|\p{L}{3,}/u).test(s.label)) });
        continue;
      }
      ctx.fillStyle = ink.edge;
      ctx.strokeStyle = TH.halo;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, opt.thin ? 2.6 : 4, 0, TAU); ctx.stroke(); ctx.fill();
      if (!opt.thin && s.id === selected && (opt.domain || (opt.editK > 0 && shapeStage(s) === opt.editK))) { ctx.strokeStyle = ink.edge; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, y, 8, 0, TAU); ctx.stroke(); }
      if (!opt.thin) labels.push({ x, y, id: s.id, text: opt.target ? targetLabel(s, idx) : pointLabel(s, idx, primesOf(s, opt.primes)), word:!!(s.label && (I18N.lang === 'en' ? /\s|[A-Za-z]{3,}/ : /\s|\p{L}{3,}/u).test(s.label)) });
    }
    if (labels.length) { labelReg(pane).lite = !!opt.lite; placeLabels(ctx, pane, labels); }
  }
  // branch cuts and poles of step k+1 live in the plane of stage k
  const offEdge = (pane, x, y, m) => x < m || y < m || x > pane.w - m || y > pane.h - m;
  function drawCuts(pane, k, editable, thin) {
    if (artMode) return [];
    const handles = [];
    if (editable && !thin && SV.on) drawCarriedCuts(pane, k, handles);
    const st = S.steps[k];
    const b = built[k];
    if (!st || st.on === false || !b || b.error) return handles;
    const ctx = pane.ctx;
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
      } else if (c.kind === 'circle' || c.kind === 'vline') {
        // [issue #5] a series' region of convergence: dashed, in the cut ink, over its halo
        ctx.setLineDash([6, 4]);
        for (const [style, w, a] of [[TH.halo, thin ? 2.5 : 3.5, TH.haloA], [TH.cut, thin ? 1.25 : 1.75, 1]]) {
          ctx.strokeStyle = style; ctx.lineWidth = w; ctx.globalAlpha = a;
          ctx.beginPath();
          if (c.kind === 'circle') { const [cx, cy] = pane.w2s(c.c), [ex] = pane.w2s(CX.add(c.c, C(c.r, 0))); ctx.arc(cx, cy, Math.abs(ex - cx), 0, TAU); } else { const bx = pane.box(), [px0, py0] = pane.w2s(C(c.x, bx.y0)), [px1, py1] = pane.w2s(C(c.x, bx.y1)); ctx.moveTo(px0, py0); ctx.lineTo(px1, py1); }
          ctx.stroke();
        }
        ctx.setLineDash([]); ctx.globalAlpha = 1;
        continue;
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
  // The point z of the cut's plane (stage a) that lands on w in plane b, F = the map between them, on the branch of q0:
  // of the exact preimages of w (the inverse branches, whatever the cut), the one nearest q0; else reached from q0 by
  // moving the target from F(q0) to w in small steps, a Newton solve at each (the continuation keeps the drag on one
  // branch). Off the image of F's branch (the exact preimages are then none) the continuation runs on Fc, the same map
  // with its cut turned half a turn away (cutFree), so a drag leaves the image either way. Null where there is none
  function cutPull(F, w, q0, a, b, Fc) {
    const ex = exactPre(a, b, [w.re, w.im]);
    if (ex && ex.zs.length) {
      let best = null, bd = Infinity;
      for (const z of ex.zs) { const d = CX.abs(CX.sub(z, q0)); if (d < bd) { bd = d; best = z; } }
      return best;
    }
    const G = Fc || F, w0 = G(q0), win = stageWin(a);
    return CX.isFin(w0) ? trackRoot(G, q0, 1, w0, w, Math.max(win.x1 - win.x0, win.y1 - win.y0), performance.now() + PRE_TRACK_MS) : null;
  }
  // The map from plane a to plane b of the cut handle's step j with its cut half a turn from the ray's, on the sheet that
  // agrees with the step's own values on the counter-clockwise side of the ray about p at q0 (there it is analytic, so a
  // pointer that leaves the image of the branch keeps a preimage). Null where the step has no sheet number to match
  // (CUT_SIDE: the turn, in radians, from the ray to the second point tested on its counter-clockwise side)
  const CUT_SIDE = 0.05;
  function cutFree(j, q0, p, a, b) {
    const st = S.steps[j - 1], bt = built[j - 1];
    if (!st || !bt || !bt.def || !bt.def.params.some((q) => q.key === 'k') || !Number.isFinite(Number(st.params.cut))) return null;
    const rel = CX.sub(q0, p), q1 = CX.add(p, CX.mul(rel, C(Math.cos(CUT_SIDE), Math.sin(CUT_SIDE))));
    const w0 = bt.f(q0), w1 = bt.f(q1), k0 = Math.round(+st.params.k || 0);
    // 1e-9 (relative): the candidate sheet must reproduce the step's own values at both samples, so a neighbouring sheet, whose values differ by far more, is rejected
    const near = (u, v) => CX.isFin(u) && CX.isFin(v) && CX.abs(CX.sub(u, v)) <= 1e-9 * (1 + CX.abs(v));
    for (const dk of [0, 1, -1, 2, -2, 3, -3, 4, -4]) {
      let f = null;
      try { f = Funcs.build({ type: st.type, params: Object.assign({}, st.params, { cut: Number(st.params.cut) + 180, k: k0 + dk }) }).f; } catch (e) { f = null; }
      if (typeof f !== 'function' || !near(f(q0), w0) || !near(f(q1), w1)) continue;
      const fs = [];
      for (let i = a + 1; i <= b; i++) { const g = i === j ? f : stepFn(i); if (g) fs.push(g); }
      return (z) => { for (const g of fs) z = g(z); return z; };
    }
    return null;
  }
  // The pieces of the screen curves that lie on no earlier part of their own path: a curve that winds round a circle (the
  // image of a cut under z^i or the logarithm) traces it many times, and a dash pattern laid over each turn from its own
  // phase fills the turns' gaps. A segment that lies within CUT_OVERLAP_PX of an earlier one (at least CUT_TURN_PX of the
  // path before it, with a direction within CUT_PARALLEL of it, either way round) is left out, and the pen lifts there.
  // Returns the polylines to stroke (null points break a polyline, as in the input)
  // (CUT_PARALLEL: the cosine of the angle between two segments that still count as one direction, 15°; CUT_JUMP: the share
  // of the pane's longer side that a step between two samples may span before the pen lifts)
  const CUT_OVERLAP_PX = 1.2, CUT_TURN_PX = 24, CUT_CELL_PX = 12, CUT_PARALLEL = 0.97, CUT_JUMP = 0.25;
  // (a grid cell's number: cell coordinates are far below 2^15 on a screen)
  const cutCellKey = (cx, cy) => (cx + 32768) * 65536 + (cy + 32768);
  function distinctArcs(curves) {
    const out = [], grid = new Map();
    for (const pts of curves) {
      let pen = null, arc = 0, cur = null;
      const lift = () => { if (cur && cur.length > 1) out.push(cur); cur = null; };
      for (const q of pts) {
        if (!q) { lift(); pen = null; continue; }
        if (!pen) { pen = q; continue; }
        const dx = q[0] - pen[0], dy = q[1] - pen[1], len = Math.hypot(dx, dy);
        if (!(len > 0)) { pen = q; continue; }
        const ux = dx / len, uy = dy / len, mx = (q[0] + pen[0]) / 2, my = (q[1] + pen[1]) / 2;
        const cx = Math.floor(mx / CUT_CELL_PX), cy = Math.floor(my / CUT_CELL_PX);
        let seen = false;
        for (let i = -1; i <= 1 && !seen; i++) {
          for (let j = -1; j <= 1 && !seen; j++) {
            for (const g of grid.get(cutCellKey(cx + i, cy + j)) || []) {
              if (arc - g.arc < CUT_TURN_PX || Math.abs(ux * g.ux + uy * g.uy) < CUT_PARALLEL) continue;
              const rx = mx - g.mx, ry = my - g.my;
              if (Math.abs(rx * g.uy - ry * g.ux) < CUT_OVERLAP_PX && Math.abs(rx * g.ux + ry * g.uy) <= g.len / 2 + CUT_OVERLAP_PX) { seen = true; break; }
            }
          }
        }
        if (seen) lift();
        else {
          if (!cur) cur = [pen];
          cur.push(q);
          const key = cutCellKey(cx, cy);
          if (!grid.has(key)) grid.set(key, []);
          grid.get(key).push({ mx, my, ux, uy, len, arc });
        }
        arc += len;
        pen = q;
      }
      lift();
    }
    return out;
  }
  // a curve given as screen points (null where there is none), stroked halo then cut ink, the pen lifted at a gap or a
  // jump of more than a quarter of the pane, and each distinct arc stroked once (distinctArcs)
  function strokeCurves(pane, curves, dash) {
    const ctx = pane.ctx;
    ctx.setLineDash(dash || []);
    const arcs = distinctArcs(curves.map((pts) => {
      let pen = null;
      return pts.flatMap((q) => {
        if (!q || Math.abs(q[0]) > 1e5 || Math.abs(q[1]) > 1e5) { pen = null; return [null]; }
        const jump = pen && Math.hypot(q[0] - pen[0], q[1] - pen[1]) > CUT_JUMP * Math.max(pane.w, pane.h);
        pen = q;
        return jump ? [null, q] : [q];
      });
    }));
    for (const [wd, al, col] of [[3.5, TH.haloA, TH.halo], [1.75, 1, TH.cut]]) {
      ctx.strokeStyle = col; ctx.globalAlpha = al; ctx.lineWidth = wd;
      ctx.beginPath();
      for (const pts of arcs) {
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]); ctx.globalAlpha = 1;
  }
  // (CUT_FLAT: under the 1.75 px stroke's half width, so a split chord never shows; CUT_DEPTH: a turn between two samples
  // is under 1.5 rad and 2^6 pieces of it are under 0.03 rad, which a circle of 100 px keeps within CUT_FLAT; CUT_BEND: a
  // chord of c px along an arc that turns by t rad is off it by about c t / 8, so a pair is tested only where c t exceeds
  // 8 CUT_FLAT, t read off the neighbouring chords: a straight bank costs no sample beyond the base set)
  const CUT_FLAT = 0.75, CUT_DEPTH = 6, CUT_SAMPLES = 480, CUT_BEND = 8 * CUT_FLAT;
  // the distance (px) of the point q from the segment a-b
  function segDist(q, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy;
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((q[0] - a[0]) * dx + (q[1] - a[1]) * dy) / l2)) : 0;
    return Math.hypot(q[0] - a[0] - t * dx, q[1] - a[1] - t * dy);
  }
  // One bank of the ray c (side +1 the counter-clockwise one) under F: the exact image of each sample, as screen points (null
  // where there is none; proj lifts a point of the plane to the screen, as a globe's, null when hidden) and as the plane's
  // points [re, im]. The samples run along the ray quadratically over its first 5/6 and geometrically past it; every
  // `step`-th of the full set is taken (step 4: a quarter of them, the same radii), a glide's frames being drawn
  // many times a second. A step of two visible samples whose midpoint is more than CUT_FLAT px off the segment between
  // them is split there, down to CUT_DEPTH halvings: near a branch point the image winds round a circle in turns a sample apart, and
  // the chords would cut across it
  function cutBank(pane, c, F, side, win, proj, step = 1) {
    const a = c.ang + side * 1e-7, Rm = 1.5 * Math.max(win.x1 - win.x0, win.y1 - win.y0) + CX.abs(c.p);
    const pts = [], ws = [];
    const at = (i) => {
      const rr = i <= 400 ? Rm * Math.pow(i / 400, 2) : Rm * Math.pow(1e4, (i - 400) / 80);
      const w = F(C(c.p.re + rr * Math.cos(a), c.p.im + rr * Math.sin(a)));
      return { w, q: CX.isFin(w) ? (proj ? proj(w) : pane.w2s(w)) : null };
    };
    const put = (p) => { pts.push(p.q); if (CX.isFin(p.w)) ws.push([p.w.re, p.w.im]); };
    const split = (i0, p0, i1, p1, depth) => {
      if (depth >= CUT_DEPTH || !p0.q || !p1.q) return;
      const im = (i0 + i1) / 2, pm = at(im);
      if (!pm.q || segDist(pm.q, p0.q, p1.q) <= CUT_FLAT) return;
      split(i0, p0, im, pm, depth + 1); put(pm); split(im, pm, i1, p1, depth + 1);
    };
    const base = [];
    for (let i = 0; i <= CUT_SAMPLES; i += step) base.push(at(i));
    // (the direction of the chord k -> k + 1; null where either end is hidden or there is no such chord)
    const dir = (k) => {
      const p = base[k], q = base[k + 1];
      return p && q && p.q && q.q ? Math.atan2(q.q[1] - p.q[1], q.q[0] - p.q[0]) : null;
    };
    const turn = (d0, d1) => (d0 == null || d1 == null ? 0 : Math.abs(Math.atan2(Math.sin(d1 - d0), Math.cos(d1 - d0))));
    for (let k = 0; k < base.length; k++) {
      if (k > 0 && base[k - 1].q && base[k].q) {
        const len = Math.hypot(base[k].q[0] - base[k - 1].q[0], base[k].q[1] - base[k - 1].q[1]), d = dir(k - 1);
        if (len * Math.max(turn(dir(k - 2), d), turn(d, dir(k))) > CUT_BEND) split((k - 1) * step, base[k - 1], k * step, base[k], 0);
      }
      put(base[k]);
    }
    return { pts, ws };
  }
  // The cuts' image curves with no handle, in the picture mapFor describes: mapFor(j - 1) is the map from the plane the
  // cut of step j lives in to the picture (null: that cut has no image there); proj lifts a plane point to the screen (a
  // globe's), the plane's own scale without it; step thins the samples (cutBank). pre = { k, jMin, H }: the cuts of the
  // steps from jMin on, which live in planes after the picture's, drawn as their preimages in plane k (the exact curves
  // the plane k at rest draws) carried by H (a map of plane k to the picture; none: the identity). The banks are stroked
  // as drawCarriedCuts draws them. look = { own, marks } makes the picture the cut's look at rest as well: with own(j0) true for the plane j0 a cut lives in, the hatches on the closed side of each
  // cut's solid bank and the dot at the image of its branch point (the marks of the plane the cut lives in); marks, an array, takes the editable cuts' handles
  // ({ x, y, step, deg }, for drawCutHandles: drawn, never hit-tested)
  function drawCutCurvesAt(pane, mapFor, proj, pre, step = 1, look = null) {
    if (artMode) return;
    carriedCuts = [];
    pane.ctx.save();
    pane.ctx.lineCap = 'round'; pane.ctx.lineJoin = 'round';
    for (let j = 1; j <= S.steps.length; j++) {
      const st = S.steps[j - 1], b = built[j - 1], F = st && st.on !== false && b && !b.error ? mapFor(j - 1) : null;
      if (!F) continue;
      for (const c of b.cuts) {
        if (c.kind !== 'ray') continue;
        const win = stageWin(j - 1);
        // (the clockwise bank is dashed under the solid one: where the two coincide, as along the whole ray of a cut at the start of a glide, the dashes are left out, so the
        // line is the single one the plane at rest draws)
        const banks = [-1, 1].map((side) => cutBank(pane, c, F, side, win, proj, step)), solid = banks[1].pts;
        banks.forEach(({ pts, ws }, i) => {
          const side = i ? 1 : -1;
          carriedCuts.push({ step: j, solid: side > 0, w: ws, s: pts });
          strokeCurves(pane, [side > 0 ? pts : pts.map((q, k) => (q && solid[k] && Math.hypot(q[0] - solid[k][0], q[1] - solid[k][1]) < CUT_COINCIDE_PX ? null : q))], side > 0 ? [] : [6, 4]);
          if (look && look.own && look.own(j - 1) && side > 0) hatchCurve(pane, pts);
        });
        if (look && look.own && look.own(j - 1)) branchDot(pane, F(c.p), proj);
        if (look && look.marks && c.editable) {
          const h = cutHandleAt(pane, F, c, st, win, proj, !!(look.own && look.own(j - 1)));
          if (h) look.marks.push({ x: h[0], y: h[1], step: j, deg: st.params.cut ?? 180 });
        }
      }
    }
    if (pre) {
      for (let j = Math.max(pre.k + 2, pre.jMin); j <= S.steps.length; j++) {
        const st = S.steps[j - 1], b = built[j - 1];
        if (!st || st.on === false || !b || b.error || derivIn(pre.k, j - 1)) continue;
        for (const c of b.cuts) {
          if (c.kind !== 'ray') continue;
          const tracks = cutPreTracks(pre.k, j, c);
          const ws = tracks.map((t) => t.map((z) => (pre.H ? pre.H(z) : z)));
          const pts = ws.map((t) => t.map((w) => (CX.isFin(w) ? (proj ? proj(w) : pane.w2s(w)) : null)));
          strokeCurves(pane, pts);
          carriedCuts.push({ step: j, solid: true, pre: true, w: ws.map((t) => t.filter(CX.isFin).map((w) => [w.re, w.im])), s: pts });
        }
      }
    }
    pane.ctx.restore();
  }
  let carriedCuts = [];
  const CUT_COINCIDE_PX = 1;   // screen px: samples of a cut's two banks this close are one point
  // the hatches of a cut's closed side along the screen polyline pts (null where it breaks), as drawCuts hatches a ray: a stroke every 7 px of arc length from 8 px on,
  // 5 px long, turned toward the clockwise side. Only the stretch of each segment inside the pane and HATCH_PAD px around it is stroked (a bank runs tens of thousands of px
  // out), the strokes keeping their place on the arc
  const HATCH_PAD = 20;
  function hatchCurve(pane, pts) {
    const ctx = pane.ctx;
    ctx.save();
    ctx.strokeStyle = TH.cut; ctx.globalAlpha = 1; ctx.lineWidth = 1.25; ctx.setLineDash([]);
    ctx.beginPath();
    let run = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      if (!a || !b) { run = 0; continue; }
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (!(L > 0)) continue;
      const dx = b[0] - a[0], dy = b[1] - a[1];
      // (the parameter range of the segment inside the padded pane, by slabs)
      let lo = 0, hi = 1;
      for (const [p0, d, size] of [[a[0], dx, pane.w], [a[1], dy, pane.h]]) {
        if (d === 0) { if (p0 < -HATCH_PAD || p0 > size + HATCH_PAD) hi = -1; continue; }
        const t0 = (-HATCH_PAD - p0) / d, t1 = (size + HATCH_PAD - p0) / d;
        lo = Math.max(lo, Math.min(t0, t1)); hi = Math.min(hi, Math.max(t0, t1));
      }
      if (hi >= lo) {
        const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
        // (the first stroke at or after the visible stretch's start: the strokes are at arc lengths 8 + 7 n)
        for (let t = 8 + 7 * Math.max(0, Math.ceil((run + lo * L - 8) / 7)); t - run < hi * L; t += 7) {
          if (t - run < 0) continue;
          const k = t - run, px = a[0] + ux * k, py = a[1] + uy * k;
          ctx.moveTo(px, py); ctx.lineTo(px + (nx - ux) * 3.54, py + (ny - uy) * 3.54);
        }
      }
      run += L;
    }
    ctx.stroke();
    ctx.restore();
  }
  // the dot at a cut's branch point, drawn as drawCuts draws it
  function branchDot(pane, w, proj) {
    if (!CX.isFin(w)) return;
    const [x, y] = proj ? proj(w) || [NaN, NaN] : pane.w2s(w), ctx = pane.ctx;
    if (!Number.isFinite(x)) return;
    ctx.save();
    ctx.fillStyle = TH.halo; ctx.strokeStyle = TH.cut; ctx.lineWidth = 1.5; ctx.globalAlpha = 1;
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  // where the editable cut c of step st has its handle in the picture F draws, [x, y] or null: on the plane the cut lives in (own), where drawCuts puts it (a third of the view's
  // smaller side along the solid bank from the branch point, st.handleR if the step has one that is in view and 20 px from it); on a later plane where drawCarriedCuts does (a third of the
  // plane's window, pulled in along the ray until it is in view and 20 px clear of the branch point's image)
  function cutHandleAt(pane, F, c, st, win, proj, own) {
    const d1 = C(Math.cos(c.ang + 1e-7), Math.sin(c.ang + 1e-7)), o = F(c.p);   // (d1: the ray's solid bank, the counter-clockwise one, on which the handle stays through the whole glide: it is the ray itself at the start and the plane's own solid bank at the end)
    const to = (w) => (CX.isFin(w) ? (proj ? proj(w) : pane.w2s(w)) : null);
    if (own) {
      const bx = pane.box();
      let R = Math.min(bx.x1 - bx.x0, bx.y1 - bx.y0) * 0.33;
      if (st.handleR > 0) { const q = to(F(CX.add(c.p, CX.scale(d1, st.handleR)))), p0 = to(o); if (q && p0 && !offEdge(pane, q[0], q[1], 24) && Math.hypot(q[0] - p0[0], q[1] - p0[1]) >= 20) R = st.handleR; }
      return to(F(CX.add(c.p, CX.scale(d1, R))));
    }
    const p0 = to(o) || [Infinity, Infinity];
    let R = st.handleR > 0 ? st.handleR : Math.min(win.x1 - win.x0, win.y1 - win.y0) * 0.33;
    for (let tries = 0; tries < 14; tries++, R *= 0.7) {
      const q = to(F(CX.add(c.p, CX.scale(d1, R))));
      if (!q || offEdge(pane, q[0], q[1], 24) || Math.hypot(q[0] - p0[0], q[1] - p0[1]) < 20) continue;
      return q;
    }
    return null;
  }
  // The cuts of the steps before plane k (each a ray in its own plane) in plane k, steps view: the image of each bank of the
  // ray under the steps between (the seam where the picture jumps), the counter-clockwise bank solid and the clockwise one
  // dashed, and for the editable cuts a handle on the solid curve (the ray's handle point carried the same way, pulled in
  // along the ray until it is in view and clear of the branch point's image). The handle is on that bank because a drag from
  // it into the picture, as the log's line Im w = θ − 2π moving up, stays inside the image where the pull-back exists; from
  // the other bank the same drag would leave the image. Pushes into handles
  function drawCarriedCuts(pane, k, handles) {
    carriedCuts = [];
    const ctx = pane.ctx;
    ctx.save();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let j = 1; j <= k; j++) {
      const st = S.steps[j - 1], b = built[j - 1];
      if (!st || st.on === false || !b || b.error || derivIn(j - 1, k)) continue;
      const F = rangeF(j - 1, k);
      for (const c of b.cuts) {
        if (c.kind !== 'ray') continue;
        const win = stageWin(j - 1);
        for (const side of [-1, 1]) {
          const { pts, ws } = cutBank(pane, c, F, side, win);
          carriedCuts.push({ step: j, solid: side > 0, w: ws, s: pts });
          strokeCurves(pane, [pts], side > 0 ? [] : [6, 4]);
        }
        if (!c.editable) continue;
        const d1 = C(Math.cos(c.ang + 1e-7), Math.sin(c.ang + 1e-7)), o = F(c.p);
        // (a branch point that lands at infinity, as log's: nothing to keep clear of)
        const [ox, oy] = CX.isFin(o) ? pane.w2s(o) : [Infinity, Infinity];
        let R = st.handleR > 0 ? st.handleR : Math.min(win.x1 - win.x0, win.y1 - win.y0) * 0.33;
        for (let tries = 0; tries < 14; tries++, R *= 0.7) {
          const q = CX.add(c.p, CX.scale(d1, R)), w = F(q);
          if (!CX.isFin(w)) continue;
          const [x, y] = pane.w2s(w);
          if (offEdge(pane, x, y, 24) || Math.hypot(x - ox, y - oy) < 20) continue;
          handles.push({ x, y, step: j, p: c.p, deg: st.params.cut ?? 180, F, q, from: j - 1, to: k });
          break;
        }
      }
    }
    drawCutPreimages(pane, k, handles);
    ctx.restore();
  }
  // The exact preimages in plane k of the ray c of step j's cut (Inverse.pointPre; the samples of one branch joined to the
  // nearest of the next): a list of curves, each a list of points of plane k. Kept per chain, cut, plane and extent, so a
  // glide's frames carry the same curves
  const cutPreCache = new Map();
  function cutPreTracks(k, j, c) {
    const win = stageWin(j - 1), Rm = 1.5 * Math.max(win.x1 - win.x0, win.y1 - win.y0) + CX.abs(c.p), tr = [];
    const key = `${k}|${j}|${c.ang}|${c.p.re},${c.p.im}|${Rm}|${chainSig[S.steps.length]}`;
    let tracks = cutPreCache.get(key);
    if (tracks) return tracks;
    for (let i = 0; i <= 240; i++) {
      const rr = Rm * Math.pow(i / 240, 2), ex = exactPre(k, j - 1, [c.p.re + rr * Math.cos(c.ang), c.p.im + rr * Math.sin(c.ang)]);
      if (!ex) break;
      const free = ex.zs.slice();
      for (const t of tr) {
        if (t.done) continue;
        const l = t.pts[t.pts.length - 1];
        let bi = -1, bd = Infinity;
        free.forEach((z, q) => { const d = CX.abs(CX.sub(z, l)); if (d < bd) { bd = d; bi = q; } });
        if (bi >= 0) t.pts.push(free.splice(bi, 1)[0]); else t.done = true;
      }
      if (i === 0) for (const z of free) tr.push({ pts: [z] });
    }
    tracks = tr.map((t) => t.pts);
    cutPreCache.set(key, tracks);
    while (cutPreCache.size > 16) cutPreCache.delete(cutPreCache.keys().next().value);
    return tracks;
  }
  // The cuts of the steps after plane k in plane k, steps view: each ray's exact preimage curves under the steps between
  // (Inverse.pointPre, whatever the cut), the samples of one branch joined to the nearest of the next; a handle on the first
  // curve in view. A chain with no exact preimages draws none
  function drawCutPreimages(pane, k, handles) {
    const n = S.steps.length;
    for (let j = k + 2; j <= n; j++) {
      const st = S.steps[j - 1], b = built[j - 1];
      if (!st || st.on === false || !b || b.error || derivIn(k, j - 1)) continue;
      const F2 = rangeF(k, j - 1), win = stageWin(j - 1);
      for (const c of b.cuts) {
        if (c.kind !== 'ray') continue;
        const tracks = cutPreTracks(k, j, c);
        const scr = tracks.map((t) => t.map((z) => pane.w2s(z)));
        strokeCurves(pane, scr);
        carriedCuts.push({ step: j, solid: true, pre: true, w: tracks.map((t) => t.map((z) => [z.re, z.im])), s: scr });
        if (!c.editable) continue;
        let R = st.handleR > 0 ? st.handleR : Math.min(win.x1 - win.x0, win.y1 - win.y0) * 0.33, done = false;
        for (let tries = 0; tries < 14 && !done; tries++, R *= 0.7) {
          const ex = exactPre(k, j - 1, [c.p.re + R * Math.cos(c.ang), c.p.im + R * Math.sin(c.ang)]);
          for (const z of ex ? ex.zs : []) {
            const [x, y] = pane.w2s(z);
            if (offEdge(pane, x, y, 24)) continue;
            handles.push({ x, y, step: j, p: c.p, deg: st.params.cut ?? 180, fwd: F2, q: z, from: k, to: j - 1 });
            done = true;
            break;
          }
        }
      }
    }
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
  function drawChevrons(pane, F0, k) {
    if (artMode) return;
    if (!S.chev) return;
    const ctx = pane.ctx;
    for (const s of S.shapes) {
      if (s.visible === false || kindType(s) === 'point' || s.kind === 'cgrid' || s.kind === 'pgrid') continue;
      const F = shapeF(s, F0, k);   // ([#253] a later plane's shape: its image, from its own plane)
      if (!F) continue;
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
      if (dragging && !hd.F && !hd.fwd) {
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
      chip(ctx, hd.x + 14, hd.y, `θ${handles.length > 1 ? sub(hd.step) : ''} ${I18N.num(CX.fmtNum(hd.deg, 1).replace('-', '−'))}°`, TH.cut, TH.cut);
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
        const msg = Construct.zpOffNote(dr.k, dr.kind, dr.i) || $t('Release to remove {t}', { t });   // (v16 [C12])
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
    for (const el of /** @type {NodeListOf<HTMLInputElement>} */ (document.querySelectorAll(`#propsPanel .insp-step[data-k="${k}"] input[data-zp]`))) {
      const row = el.closest('.zp-item');
      if (row) row.classList.toggle('wide1', wide);
      if (document.activeElement === el) continue;
      const [kind, i] = el.dataset.zp.split(':');
      const v = lists[kind][+i];
      if (v != null && el.value !== zpShow(v)) { el.value = zpShow(v); el.classList.remove('bad'); }
    }
  }
  // the Inspector's parameter fields of step k, rebuilt after a zero or pole is added or removed
  function refreshZpFields(k) {
    const st = S.steps[k - 1];
    if (!st || st.type !== 'zp') return;
    if (insp) insp.refreshParams(k);
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
    refreshZpFields(k);
    return list.length - 1;
  }
  // the Inspector's Add zero / Add pole (DESIGN.md 2.4): a new zero or pole at the visible centre of the step's
  // input (X when it shows that plane, else the view that plane would have), snapped to the grid; never Show alone
  function zpAddFromCard(k, kind) {
    const here = !!zpStep() && zpStep().k === k;
    const i = zpAdd(k, kind, here ? null : zpFreeSpot(k, fittedView(paneL, k - 1)));
    if (i < 0) return;
    commit();
    requestRender('OL');
    sndSay(kind === 'zeros' ? $t('Added zero {mark} of {f}.', { mark: zpSym(kind, i, S.steps[k - 1]), f: `f${sub(k)}` }) : $t('Added pole {mark} of {f}.', { mark: zpSym(kind, i, S.steps[k - 1]), f: `f${sub(k)}` }));
    const inp = document.querySelector(`#propsPanel .insp-step[data-k="${k}"] input[data-zp="${kind}:${i}"]`);
    if (inp) inp.scrollIntoView({ block: 'nearest' });
  }
  function zpRemove(k, kind, i) {
    const st = S.steps[k - 1];
    if (!st || st.type !== 'zp') return;
    const list = zpItems(st, kind);
    if (i < 0 || i >= list.length) return;
    cmZeroRemoved(k, kind, i);   // (v16 [C12])
    list.splice(i, 1);
    zpWrite(st, kind, list);
    if (zpSame(zpSel, k, kind, i)) zpSel = null;
    else if (zpSel && zpSel.k === k && zpSel.kind === kind && zpSel.i > i) zpSel.i--;
    zpHover = null;
    chainChanged(false);
    refreshZpFields(k);
    commit();
    requestRender('OL');
  }
  function paramField(st, k, q, pre = 'p') {
    const val = st.params[q.key] ?? q.def;
    // (the step in the chain at this moment: an Undo while the field is being typed puts new step objects in the chain, and the field follows them)
    const live = () => (S.steps.includes(st) ? st : S.steps[k - 1] && S.steps[k - 1].type === st.type ? S.steps[k - 1] : st);
    const upd = (v) => { live().params[q.key] = v; chainChanged(false); syncParam(k, q.key, pre); };
    let input, extra = null, before = null;
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
          input.setAttribute('data-tip', $t('Enter a number; {label} stays {choice}', { label: q.label, choice: st.params[q.key] ?? q.def }));
          return;
        }
        const v = Number(input.value);
        const okInt = q.type !== 'int' || (Number.isInteger(v) && (q.min == null || v >= q.min));
        input.classList.toggle('bad', !okInt); input.setAttribute('aria-invalid', String(!okInt));
        if (!okInt) input.setAttribute('data-tip', $t('Uses {choice}: {label} must be a whole number{choice2}', { choice: Math.max(q.min ?? -Infinity, Math.round(v)), label: q.label, choice2: q.min != null ? ` ≥ ${q.min}` : '' })); else input.removeAttribute('data-tip');
        upd(q.type === 'int' ? Math.round(v) : v);
      });
      input.addEventListener('change', () => {
        if (unread()) input.value = st.params[q.key] ?? q.def;
        const v = Number(input.value);
        if (q.type === 'int' && Number.isFinite(v)) { const r = Math.min(q.max ?? Infinity, Math.max(q.min ?? -Infinity, Math.round(v))); if (r !== v) { input.value = r; upd(r); } }
        input.classList.remove('bad'); input.removeAttribute('data-tip'); input.removeAttribute('aria-invalid');
        commit();
        // (a sheet typed into the field, in the Inspector or on a card, as ‹ › below; Square root's Try line)
        if (q.key === 'k' && q.type === 'int') tourEmit('sheet-changed', { k, sheet: Math.round(Number(input.value)) || 0 });
      });
      if (q.key === 'cut' && pre === 'p') input.dataset.cutStep = k;
      // a step's sheet: "‹ 0 of 2 ›": ‹ › step through the sheets ("of n" for a root), and Show all sheets opens Landscape
      // with All sheets on, the one view that draws them
      if (q.key === 'k' && q.type === 'int') {
        const n = st.type === 'root' ? Math.max(2, Math.round(+st.params.n || 2)) : 0;
        const go = (d) => { let v = Math.round(Number(st.params.k) || 0) + d; if (n) v = ((v % n) + n) % n; input.value = v; upd(v); commit(); tourEmit('sheet-changed', { k, sheet: v }); };
        before = h('button', { class: 'icon-btn sh-prev', type: 'button', 'aria-label': $t('Previous sheet'), 'data-tip': $t('Previous sheet'), onclick: (e) => { e.preventDefault(); go(-1); } }, '‹');
        extra = h('div', { class: 'sheet-ctl' },
          n ? h('span', { class: 'sh-of' }, $t('of {n}', { n })) : null,
          h('button', { class: 'icon-btn sh-next', type: 'button', 'aria-label': $t('Next sheet'), 'data-tip': $t('Next sheet'), onclick: (e) => { e.preventDefault(); go(1); } }, '›'),
          h('button', { class: 'btn ghost small sh-all', type: 'button', 'data-tip': $t('Landscape draws every sheet of the map as one surface'), onclick: (e) => { e.preventDefault(); showAllSheets(); } }, $t('Show all sheets')));
      }
    } else {
      // (a number field (a complex value or a list of them) shows the true minus, U+2212, as the zero
      // and pole fields and the Parameters' value fields do; the stored text keeps the hyphen. A formula field is as typed.)
      const num = q.type === 'cx' || q.type === 'coeffs' || q.type === 'cxlist';
      const raw = () => (num ? input.value.replace(/−/g, '-') : input.value);
      input = h('input', { class: 'inp', id, value: num ? numShow(val) : val, spellcheck: 'false', autocapitalize: 'off', autocorrect: 'off', autocomplete: 'off', 'data-fx': '' });
      if (num) input.dataset.num = '1';
      // (the letters the field binds, a series' n, a recurrence's u: never offered as new numbers)
      if (q.bound) input.dataset.bound = q.bound.join(',');
      // (a series' a_n or a recurrence's rule, or a field of a chain whose last change took over 8 ms, is applied
      // after a pause of 4× that cost, 150 to 250 ms for a_n and the rule, at most 250 ms for the others: one rebuild
      // per pause, not per key; the text stays live, Enter and leaving the field apply it at once)
      // (the pause belongs to the step typed on: if an example or chain switch has replaced it by the time the pause ends,
      // the text is dropped, not given by live() to the new chain's step of the same type at k)
      let due = 0, typedOn = null;
      const apply = () => { if (due) { clearTimeout(due); due = 0; } const on = typedOn; typedOn = null; if (on && live() !== on) return; upd(raw()); };
      input.addEventListener('input', () => {
        // (the tour's event for the user's typing in a formula field, not for the text a rebuild writes back)
        if (q.type === 'expr' || q.type === 'seq') tourEmit('formula-edited', { k, key: q.key });
        if (q.type === 'cx') { try { Expr.constValue(raw()); input.classList.remove('bad'); } catch (e) { input.classList.add('bad'); } }
        if (q.type === 'coeffs' || q.type === 'cxlist') Funcs.typedList(live(), q.key, raw());
        const cost = chainCost();
        if (q.type !== 'seq' && cost <= 8) { apply(); return; }
        clearTimeout(due);
        typedOn = live();
        due = setTimeout(apply, Math.min(250, Math.max(q.type === 'seq' ? 150 : 0, 4 * cost)));
      });
      input.addEventListener('change', () => { if (due) apply(); if (num && input.value !== numShow(raw())) input.value = numShow(raw()); commit(); });
      if (q.type === 'cx') extra = h('button', { class: 'icon-btn argand', 'data-tip': $t('Pick on an Argand diagram'), 'aria-label': $t('Pick {label} on an Argand diagram', { label: q.label }), html: ICONS.argand, onclick: (e) => { e.preventDefault(); e.stopPropagation(); if (padEl) closePad(); else openArgandPad(e.currentTarget, input); } });
    }
    input.dataset.pkey = q.key;
    // (a label in subscripts, aₙ, uₖ₊₁: its name for a screen reader in letters, "u k+1")
    if (q.say) input.setAttribute('aria-label', q.say);
    const wide = q.type === 'expr' || q.type === 'coeffs' || q.type === 'seq';
    const sym = PSYM[q.key];
    const labelText = sym ? sym[0] : q.label;
    // (a word before the symbol, "Cut angle θ", "Sheet k", "Power n", so a phone, which has no tooltips,
    // says what the field is; the symbol keeps its own span, where a step's index goes)
    const word = paramWord(st, q);
    const lab = h('label', { class: 'pl' + (word ? ' worded' : ''), for: id, 'data-tip': sym ? sym[1] : q.tip || q.label }, ...(word ? [h('span', { class: 'pw' }, word), ' ', h('span', { class: 'ps' }, labelText)] : [labelText]));
    if (q.type === 'int' || q.type === 'angle') scrubbable(lab, input, 1, q.type === 'int');
    return h('div', { class: 'pf' + (wide ? ' wide' : '') + (q.type === 'cx' ? ' cx' : '') + (word ? ' worded' : '') }, lab, extra ? h('div', { class: 'pair' }, before, input, extra) : input);
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
      if (Funcs.splitList(input.value).filter((x) => x.trim()).length !== 1) { refreshZpFields(k); syncZpFields(k); }
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
    // ([issue #6] the same function written another way: a repeat it ends stays)
    setStepAt(k - 1, Object.assign({ type: r.step.type, params: Object.assign(Funcs.defaults(r.step.type), r.step.params), on: st.on !== false }, st.repeat ? { repeat: { ...st.repeat } } : {}));
    zpSel = null;
    chainChanged(true);
    setFocus(k);
    commit();
    undoToast(to ? $t('f{k} is now given by its zeros and poles ({note}): drag them in its input plane.', { k: sub(k), note: r.note }) : $t('f{x} is now given by its coefficients.', { x: sub(k) }));
    return null;
  }
  // [v16.5 UX09] a finger: handles drawn 12 px and grabbed within 22 px (the nearest wins), as zeros and poles are; a
  // mouse: 7 px marks grabbed within 8 px. Before any press, a coarse pointer counts as a finger
  const fingerNow = () => (ptrTouch != null ? ptrTouch : touchUI());
  function handleAt(pane, sel, x, y) {
    const finger = ptrTouch;
    let best = null, bd = Infinity;
    for (const [key, hz] of Region.handlesOf(sel)) {
      if (sel.def || sel.fixed || (sel.at && sel.at[key])) continue;   // (a bound handle is no handle; v16.3: nor a fixed shape's)
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
      if (s.def || s.fixed || (s.at && s.at[key])) continue;   // (v16; v16.3 user-1: a fixed unit circle or axis)
      const [x, y] = pane.w2s(z);
      ctx.fillStyle = TH.surface; ctx.strokeStyle = k; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (key === 'c' || key === 'm') ctx.arc(x, y, hr, 0, TAU); else ctx.rect(x - hr, y - hr, 2 * hr, 2 * hr);
      ctx.fill(); ctx.stroke();
    }
  }
  function drawProbe(pane, z, color, casing) {
    if (!z || !CX.isFin(z)) return;
    let [x, y] = pane.w2s(z);
    const out = x < -10 || y < -10 || x > pane.w + 10 || y > pane.h + 10;
    const ctx = pane.octx;
    // a phone's inset (116 px) is too small for the cross: a dot, hollow and held at the edge when the point is off it
    if (pane.w <= 140 && pane.h <= 140) {
      x = Math.max(6, Math.min(pane.w - 6, x)); y = Math.max(6, Math.min(pane.h - 6, y));
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, 4, 0, 2 * Math.PI);
      ctx.lineWidth = 3.5; ctx.strokeStyle = casing || TH.halo; ctx.stroke();
      ctx.lineWidth = 1.5; ctx.strokeStyle = color;
      if (!out) { ctx.fillStyle = color; ctx.fill(); }
      ctx.stroke();
      ctx.restore();
      return;
    }
    if (out) return;
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

