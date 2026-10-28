'use strict';
// Integrals (issue #20, phase 3: moved out of app.js): ∫γ F dz along a shape's curve or an area's boundary, the
// right-click menu's integral item, and the integral popover with its plot and the Cauchy plot. The
// app hands it what it needs once, Integrals.init(api) at start-up (src/app/07-preimages-integrals.js, integralsApi):
// its functions and constants as they are, and the state it reassigns (S, intPop, ...) as getters on api, read as A.S
// and so on. The state the rest of the app reads too (intPop, lastPan, holdMenuT, cauchyCache) stays the app's.
const Integrals = (() => {
  let A = null;
  let C, ICONS, SND, V, armOutside, cauchyCache, closePalette, copyText, cxShort, fnHtml, focusF, hasCalc, intLabel,
    integrateShape, kindType, lColor, lFlat, leftStage, leftView, liftC, morphOn, nSteps, openMenu, project, rImage,
    requestRender, rightStage, shapeGPU, shapeInk, shapeKey, shapeNames, snd, sndListenAsk, sndListenOf,
    sndStopPlay, stageF, sub, toast, touchUI, tourEmit, trans, zerosPolesTimed;
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
      if (r.mesh) for (const c of r.mesh.contours) if (c.pts && c.pts.length > 2) out.push(...clipPolyline(c.pts.map((z) => [z.re, z.im]), !!c.closed, A.clipWin));
    } else {
      let curves = [];
      try { curves = Region.curvesOf(s, A.clipWin); } catch (e) { curves = []; }
      for (const c of curves) {
        if (c.long) { // a line or a ray: its part in the meshing window
          const cl = Region.clipLine(c.a, CX.sub(c.b, c.a), A.clipWin, 0, 1);
          if (cl) out.push({ pts: [[cl[0].re, cl[0].im], [cl[1].re, cl[1].im]], closed: false, part: true });
          continue;
        }
        if (c.pts) {
          const ps = c.closed ? c.pts.slice(0, -1) : c.pts, xy = ps.map((z) => [z.re, z.im]);
          // an open traced curve (a curve formula) runs out toward infinity: its part in the meshing window, like a
          // line (its closed loops are counterclockwise, Curves.loops)
          if (c.traced && !c.closed) out.push(...clipPolyline(xy, false, A.clipWin));
          else if (c.traced && Curves.simpleLoops) {
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
    const sel = A.S.shapes.find((s) => s.id === A.selected && s.visible !== false && kindType(s) !== 'point');
    const pop = !sel && A.intPop ? A.S.shapes.find((s) => s.id === A.intPop.id && s.visible !== false) : null;
    // coarser while a shape is being dragged (a pan changes nothing here)
    const dense = !(A.drag && (A.drag.mode === 'move' || A.drag.mode === 'handle' || A.drag.mode === 'draw'));
    const key = JSON.stringify([A.chainSig[leftStage()], leftStage(), sel ? sel.id : '', pop ? pop.id : '', dense, A.clipWin, A.S.shapes.map((s) => (s.visible === false ? '' : shapeKey(s)))]);
    if (key === integ.gkey) return integ.geom;
    const names = shapeNames();
    const list = sel ? [sel] : pop ? [pop] : A.S.shapes.filter((s) => s.visible !== false && kindType(s) !== 'point' && s.kind !== 'cgrid' && s.kind !== 'pgrid');
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
    if (g.bad) it.error = $t('The curve passes through a singularity of an earlier step');
    else if (!hasCalc('lineIntegral')) it.error = $t('Line integrals are not available in this build');
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
    const g = A.intPop && A.intPop.it && A.intPop.it.g;
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
      ctx.strokeStyle = A.TH.halo; ctx.globalAlpha = A.TH.haloA; ctx.lineWidth = 6; ctx.stroke();
      ctx.globalAlpha = 1; ctx.strokeStyle = A.TH.accent; ctx.lineWidth = 2.5; ctx.stroke();
      const along = c.closed && xy.length > 2 ? Float64Array.from([...xy, xy[0], xy[1]]) : Float64Array.from(xy);
      const fr = [0.125, 0.375, 0.625, 0.875];
      ctx.fillStyle = A.TH.halo; arrowsAlong(ctx, along, fr, 8.5);
      ctx.fillStyle = A.TH.accent; arrowsAlong(ctx, along, fr, 6);
      // the start of the curve (where the running integral is 0)
      if (xy.length >= 2 && Number.isFinite(xy[0]) && Number.isFinite(xy[1])) { ctx.fillStyle = A.TH.halo; ctx.strokeStyle = A.TH.accent; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(xy[0], xy[1], 4, 0, TAU); ctx.fill(); ctx.stroke(); }
    }
    ctx.restore();
  }
  // the shapes whose curves pass within reach of pane pixel (x, y): [{s, d}], nearest first. The left plane and the
  // Phase portrait show them in the left plane's coordinates; the image plane of Image shows their images.
  function curvesNear(pane, side, x, y) {
    let F = null, view;
    if (side === 'L') { if (!lFlat()) return []; view = leftView(); F = leftStage() ? stageF(leftStage()) : null; }
    else if (rImage() && !morphOn() && !trans.k) { view = V.right; F = stageF(rightStage()); }
    else return [];
    pane.setView(view);
    const W = pane.w, H = pane.h, out = [];
    for (const s of A.S.shapes) {
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
  // (v15: the plane menu, src/planemenu.js, shows these items in its object group)
  function openIntegralMenu(pane, side, x, y, cx, cy) {
    const items = integralItems(pane, side, x, y, cx, cy);
    if (!items.length) return false;
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
  // the line integral item of one curve near pane pixel (x, y), and its Listen along: [{label, run, listen?, piece?}]. The curve
  // is the shape prefer (the one under the pointer) when it passes there, else the nearest (issue #13: one integral,
  // not one per curve in reach)
  function integralItems(pane, side, x, y, cx, cy, prefer) {
    const all = curvesNear(pane, side, x, y);
    if (!all.length) return [];
    const near = [all.find((n) => n.s.id === prefer) || all[0]];
    const names = shapeNames();
    // (v16.5 V03: the label, its variable and its closed-curve test are intLabel's, shared with the palette)
    /** @type {{ label: string, run: () => any, listen?: boolean, piece?: boolean }[]} */
    const items = near.map(({ s }) => ({ label: intLabel(s, names), run: () => openIntegralPop(s.id, cx, cy) }));
    if (SND) {
      for (const { s } of near) {
        if ((A.sndP.on && A.sndP.events) || sndListenOf(s)) items.push({ listen: true, label: snd.play || snd.prep ? $t('Stop listening') : $t('Listen along {name}', { name: names.get(s.id) || Region.KINDS[s.kind].label }), run: () => (snd.play || snd.prep ? sndStopPlay(true) : sndListenAsk(s)) });
        // (a composed curve, once Listen along plays the function: its score has its own item)
        if (SND.along && !snd.play && sndListenOf(s)) items.push({ piece: true, label: $t('Play the composition (Grieg, arranged on this curve)'), run: () => sndListenAsk(s, true) });
      }
    }
    return items;
  }
  // TEMP-DEBUG-HOOK
  // a complex value for copying: components within tol read 0
  const cxCopy = (w, tol) => {
    if (!CX.isFin(w)) return '';
    const re = Math.abs(w.re) <= tol ? 0 : w.re, im = Math.abs(w.im) <= tol ? 0 : w.im;
    return CX.fmt(C(re, im), 12).replace(/\s/g, '');
  };
  function openIntegralPop(id, cx, cy, o) {
    closePalette();
    const s = A.S.shapes.find((x) => x.id === id);
    if (!s) return null;
    const pop = h('div', { class: 'pop int-pop', role: 'dialog', 'aria-label': $t('Line integral') });
    $('popHost').append(pop);
    A.popEl = pop;
    A.intPop = { id, el: pop, cx, cy, it: null, x: null, timer: 0, beside: !!(o && o.beside), bx0: o && o.bx0 != null ? o.bx0 : null };
    tourEmit('integral-opened', { shape: id });
    pop._onClose = () => {
      if (!A.intPop || A.intPop.el !== pop) return;
      clearTimeout(A.intPop.timer);
      A.intPop = null; integ.gkey = '';
      requestRender('OL', 'OR', lColor() && A.S.dc === 'cauchy' ? 'L' : null);
    };
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePalette(); } });
    fillIntPop();
    placeIntPop();
    armOutside(null);
    const first = pop.querySelector('button');
    if (first) first.focus({ preventScroll: true });
    // the Cauchy style follows the popover's curve when nothing is selected
    integ.gkey = '';
    requestRender('OL', 'OR', lColor() && A.S.dc === 'cauchy' ? 'L' : null);
    return first;
  }
  function placeIntPop() {
    if (!A.intPop) return;
    const pop = A.intPop.el, pw = pop.offsetWidth, ph = pop.offsetHeight;
    let x = A.intPop.cx + 12, y = A.intPop.cy + 12;
    if (x + pw > window.innerWidth - 12) x = Math.max(12, A.intPop.cx - pw - 12);
    if (y + ph > window.innerHeight - 12) y = Math.max(12, Math.min(window.innerHeight - ph - 12, A.intPop.cy - ph - 12));
    // (v16.5 V03: opened from the palette, the result sits beside its curve in X, never over Y, where its image is)
    if (A.intPop.beside) {
      const R = $('paneR').getBoundingClientRect();
      if (R.width > 0 && R.left > pw + 24 && x + pw > R.left - 8) x = Math.max(12, Math.min(A.intPop.bx0 != null ? A.intPop.bx0 - pw - 12 : x, R.left - 8 - pw));
    }
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
    pop.dataset.side = y < A.intPop.cy ? 'top' : 'bottom';
  }
  // the chain, the focus or the shapes changed under an open popover: integrate again once things settle
  function refreshIntPop() {
    if (!A.intPop) return;
    clearTimeout(A.intPop.refresh);
    A.intPop.refresh = setTimeout(() => {
      if (!A.intPop) return;
      const s = A.S.shapes.find((x) => x.id === A.intPop.id);
      if (!s || s.visible === false) { closePalette(); return; }
      if (A.drag) { refreshIntPop(); return; }
      fillIntPop();
    }, 120);
  }
  // integrate and fill the popover; the zeros and poles inside follow a moment later
  function fillIntPop() {
    const P = A.intPop;
    if (!P) return;
    const s = A.S.shapes.find((x) => x.id === P.id);
    const g = shapeGeom(s, true);
    if (!g) { closePalette(); return; }
    const F = focusF();
    P.it = integrateGeom(g, F);
    P.x = null;
    renderIntPop();
    clearTimeout(P.timer);
    if (P.it.closed && !P.it.error) P.timer = setTimeout(() => { if (A.intPop !== P) return; P.x = integralExtra(P.it, F); renderIntPop(); }, 30);
    requestRender('OL', 'OR');
  }
  function renderIntPop() {
    const P = A.intPop;
    if (!P || !P.it) return;
    const it = P.it, pop = P.el, Fh = fnHtml(), dv = leftStage() === 0 ? '<i>z</i>' : `<i>w</i>${sub(leftStage())}`;
    const tol = it.errBound || 0;
    const copyBtn = (text, what) => {
      const b = h('button', { class: 'icon-btn small', 'data-tip': $t('Copy'), 'aria-label': $t('Copy {what}', { what }), html: ICONS.copy, disabled: text ? null : true });
      b.addEventListener('click', () => { copyText(text); b.innerHTML = ICONS.check; b.classList.add('copied'); setTimeout(() => { b.innerHTML = ICONS.copy; b.classList.remove('copied'); }, 1200); });
      return b;
    };
    const row = (k, v, copy, cls) => h('div', { class: 'int-row' + (cls ? ' ' + cls : '') }, h('span', { class: 'int-k', html: k }), h('span', { class: 'int-v', html: v }), copy || h('span', { class: 'int-pad' }));
    const sym = it.closed ? '∮' : '∫';
    const part = it.g.comps.some((c) => c.part);
    const close = h('button', { class: 'icon-btn small', 'data-tip': $t('Close  Esc'), 'aria-label': $t('Close'), html: ICONS.close, onclick: () => closePalette() });
    const kids = [h('div', { class: 'pop-title' }, h('span', { class: 'int-title', html: (it.closed ? $t('{sym} around {name}{part}', { sym, name: it.name.replace(/[&<>]/g, ''), part: part ? $t(' <span class="int-part">(visible part)</span>') : '' }) : $t('{sym} along {name}{part}', { sym, name: it.name.replace(/[&<>]/g, ''), part: part ? $t(' <span class="int-part">(visible part)</span>') : '' })) }), h('span', { class: 'grow' }), close)];
    const body = h('div', { class: 'int-body' });
    if (it.error) body.append(h('div', { class: 'int-note err' }, it.error));
    else {
      body.append(row(`${sym}<sub><i>γ</i></sub> ${Fh} d${dv}`, cxShort(it.value, tol * 1e8), copyBtn(cxCopy(it.value, tol), $t('the integral'))));
      if (it.closed) {
        const r = C(it.value.im / TAU, -it.value.re / TAU), rt = tol / TAU;
        body.append(row(`(1/2π<i>i</i>) ∮ ${Fh} d${dv}`, cxShort(r, rt * 1e8), copyBtn(cxCopy(r, rt), $t('the integral over 2πi'))));
        const x = P.x, int = (n) => String(n).replace('-', '−');
        if (!x) body.append(h('div', { class: 'int-note' }, $t('Counting zeros and poles inside…')));
        else {
          body.append(row($t('winding of {Fh}∘<i>γ</i> about 0', { Fh }), x.ok ? int(x.wind) : '—', null));
          if (x.found) {
            const agree = x.ok && !x.partial && x.zeros - x.poles === x.wind;
            body.append(row(x.partial ? $t('zeros − poles found inside') : $t('zeros − poles inside'), `<span class="${agree ? 'ok' : ''}">${int(x.zeros)} − ${int(x.poles)} = ${int(x.zeros - x.poles)}</span>`, null));
            const lst = h('div', { class: 'int-list' });
            let iz = 0, shown = 0;
            for (const r of x.list) {
              const pole = r.kind === 'pole';
              if (!pole) iz++;
              if (shown++ >= 6) continue;
              const nm = pole ? $t('pole') : (leftStage() === 0 ? `<i>z</i>${sub(iz)}` : `<i>r</i>${sub(iz)}`);
              const extra = (r.mult > 1 ? ` <span class="int-m">×${r.mult}</span>` : '') + (Math.abs(r.w) !== 1 ? $t(' <span class="int-m">wound {w}×</span>', { w: int(r.w) }) : '');
              lst.append(h('div', { class: 'int-row sub' }, h('span', { class: 'int-k', html: `<span class="sw${pole ? ' pole' : ''}"></span>${nm}${extra}` }), h('span', { class: 'int-v', html: cxShort(r.z, Math.max(it.g.box.x1 - it.g.box.x0, it.g.box.y1 - it.g.box.y0)) })));
            }
            if (shown > 6) lst.append(h('div', { class: 'int-note' }, $tn('and {n} more', 'and {n} more', shown - 6)));
            if (x.list.length) body.append(lst);
            if (x.partial) body.append(h('div', { class: 'int-note' }, $t('The search stopped early; there may be more inside.')));
            else if (x.ok && x.zeros - x.poles !== x.wind) body.append(h('div', { class: 'int-note', html: $t('The counts differ: {Fh} has a branch cut or an essential singularity inside the curve, where the argument principle does not apply.', { Fh }) }));
          }
          if (!x.ok) body.append(h('div', { class: 'int-note', html: $t('{Fh} vanishes, blows up or jumps on the curve, so the argument principle does not apply.', { Fh }) }));
        }
      }
    }
    // the running integral t ↦ ∫γ[0,t] F dz from 0: start ○, end ●, and for a closed curve the gap back to 0 (∮)
    const cv = h('canvas', { class: 'int-plot', width: 264 * 2, height: 128 * 2, 'aria-hidden': 'true' });
    body.append(cv, h('div', { class: 'int-cap', html: $t('Running integral of {Fh} from 0 (○) to its value (●){choice}', { Fh, choice: it.closed && !it.error ? $t('; the dashed gap back to 0 is ∮') : '' }) }));
    kids.push(body);
    pop.replaceChildren(...kids);
    pop.setAttribute('aria-label', it.closed ? $t('Line integral around {name}', { name: it.name }) : $t('Line integral along {name}', { name: it.name }));
    drawIntPlot(cv, it);
  }
  function drawIntPlot(cv, it) {
    const ctx = cv.getContext('2d'), dpr = 2, W = 264, Hh = 128;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = A.TH.plane; ctx.fillRect(0, 0, W, Hh);
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
    ctx.strokeStyle = A.TH.gridMajor; ctx.lineWidth = 1;
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
      ctx.strokeStyle = A.TH.accent; ctx.lineWidth = 1.25; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(end[0], end[1]); ctx.lineTo(zx, zy); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.lineWidth = 1.5; ctx.strokeStyle = ink; ctx.fillStyle = A.TH.plane;
    ctx.beginPath(); ctx.arc(zx, zy, 3.5, 0, TAU); ctx.fill(); ctx.stroke();
    if (end && it.error) {
      const [ex, ey] = end;
      ctx.strokeStyle = A.TH.pole; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(ex - 4, ey - 4); ctx.lineTo(ex + 4, ey + 4); ctx.moveTo(ex + 4, ey - 4); ctx.lineTo(ex - 4, ey + 4); ctx.stroke();
    } else if (end) { ctx.fillStyle = ink; ctx.beginPath(); ctx.arc(end[0], end[1], 3.5, 0, TAU); ctx.fill(); }
    ctx.strokeStyle = A.TH.line; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, W - 1, Hh - 1);
  }
  // the selected curve's integral, from the keyboard or the palette: the popover opens over the left plane
  function integrateSelected() {
    const s = A.S.shapes.find((x) => x.id === A.selected && x.visible !== false && kindType(x) !== 'point');
    const list = s ? [s] : A.S.shapes.filter((x) => x.visible !== false && kindType(x) !== 'point' && x.kind !== 'cgrid' && x.kind !== 'pgrid');
    if (!list.length) { toast(touchUI() ? $t('Draw a curve or a region first: hold a finger on a curve, then choose Integrate.') : $t('Draw a curve or a region first: right-click a curve to integrate along it.')); return null; }   // (v16.5 UX17: a phone's words)
    // (v16.5 V03: with several curves and none selected, ask; never integrate along a curve chosen for you)
    if (!s && list.length > 1) { toast(touchUI() ? $t('Pick a curve to integrate along: hold a finger on it, then choose Integrate.') : $t('Pick a curve to integrate along: select it, or right-click it.')); return null; }
    return integrateShape(list[0].id);
  }
  function cauchyPlot() {
    if (!hasCalc('cauchyNodes')) return null;
    const geom = integralGeom();
    const g = geom.find((x) => x.s.id === A.selected && x.closed) || geom.find((x) => x.closed);
    if (!g || g.bad) return null;
    const key = integ.gkey + '|' + g.s.id + '|' + A.chainSig[nSteps()] + '|' + A.S.focus;
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

  function init(api) {
    A = api;
    ({ C, ICONS, SND, V, armOutside, cauchyCache, closePalette, copyText, cxShort, fnHtml, focusF, hasCalc, intLabel, integrateShape, kindType, lColor, lFlat, leftStage, leftView, liftC, morphOn, nSteps, openMenu, project, rImage, requestRender, rightStage, shapeGPU, shapeInk, shapeKey, shapeNames, snd, sndListenAsk, sndListenOf, sndStopPlay, stageF, sub, toast, touchUI, tourEmit, trans, zerosPolesTimed } = api);
  }
  return { init, curvePieces, sphereProj, drawIntHighlight, openIntegralMenu, integralItems, openIntegralPop, refreshIntPop, integrateSelected, cauchyPlot, plotF };
})();
