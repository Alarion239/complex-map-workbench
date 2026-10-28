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
      a *= dimK(s);
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
      cmFormAnchor('Y');
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
    sndCollide();
    // words in Archivo, the value in B612 Mono
    const head = (t) => `<span class="rp"><span class="rk"><span class="rw">${t}</span> <i>w</i></span> <span class="rv">${fmtCxHtml(hov.w)}</span></span>`;
    if (!hasCalc('zerosPoles')) { lr.innerHTML = head($tx('readout', 'at')); return; }
    if (!hov.list) { lr.innerHTML = head($t('finding the preimages of')); return; }
    const n = hov.list.reduce((a, r) => a + (r.mult || 1), 0);
    const where = !lFlat() ? $t(' (flat view)') : '';
    // a search cut short (a costly map): a lower bound, or no count at all when it found nothing
    let html = head(hov.list.partial && !n ? $t('preimage search stopped early{where} for', { where }) : (hov.list.partial ? $tn('at least {n} preimage{where} of', 'at least {n} preimages{where} of', n, { where }) : $tn('{n} preimage{where} of', '{n} preimages{where} of', n, { where })));
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
    if (artMode) return;
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
          labels.push({ x, y, text: r.mult > 1 ? $t('pole ×{mult}', { mult: r.mult }) : $t('pole'), word: true });
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
  // ([v16.5 fix regress-10] of a given list too: an undo step's snapshot names the shape it added or deleted, z₆, as the
  // rows did when it existed)
  function shapeNames(list) {
    const counts = {}, names = new Map(), pv = { n: 0 };
    for (const s of list || S.shapes) { const nk = nameKind(s); if (!fixedNm(s)) counts[nk] = (counts[nk] || 0) + 1; names.set(s.id, rowName(s, counts, pv, false)); }
    return names;
  }
  // (v16 review user-4, picture-8) a point's row is named as the plane labels it (z₀, or the user's label), so the names
  // in the definitions ("midpoint of z₀, z₂") are the names in the list; a helper (no label in the plane) by its
  // meet; a hidden point, which has no plane label, keeps "Point n". pv counts the visible points as drawPoints does
  // ([v16.5 fix rail-4] the unit circle or an axis made a fixed shape: by that name, "The unit circle" as a row title, and
  // no number, so the user's own circles stay Circle 1, 2, …; Construct.fixedName is the one rule)
  const fixedNm = (s) => (typeof Construct !== 'undefined' && Construct.fixedName ? Construct.fixedName(s) : null);
  const capFirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  function rowName(s, counts, pv, row = true) {
    const fx = fixedNm(s);
    if (fx) return row ? capFirst(fx) : fx;
    if (s.kind !== 'point') return shapeName(s, counts);
    const helper = typeof Construct !== 'undefined' && Construct.pointMark && Construct.pointMark(s) === 'helper';
    // (a labelled point takes a plane index too, as in drawPoints: the next free point is z₁ after it, not z₀)
    if (s.label) { if (!helper && s.visible !== false) pv.n++; return shapeName(s, counts); }
    // (a helper's meet name reads the curves' names, so only a row asks for it: shapeNames never recurses)
    if (helper) return (row && Construct.shapeLabel && Construct.shapeLabel(s)) || shapeName(s, counts);
    if (s.visible === false) return shapeName(s, counts);
    return pointLabel(s, pv.n++, 0);
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
  // the line integral item of one curve near pane pixel (x, y), and its Listen along: [{label, run, listen?}]. The curve
  // is the shape prefer (the one under the pointer) when it passes there, else the nearest (issue #13: one integral,
  // not one per curve in reach)
  function integralItems(pane, side, x, y, cx, cy, prefer) {
    const all = curvesNear(pane, side, x, y);
    if (!all.length) return [];
    const near = [all.find((n) => n.s.id === prefer) || all[0]];
    const names = shapeNames();
    // (v16.5 V03: the label, its variable and its closed-curve test are intLabel's, shared with the palette)
    const items = near.map(({ s }) => ({ label: intLabel(s, names), run: () => openIntegralPop(s.id, cx, cy) }));
    if (SND) for (const { s } of near) if ((sndP.on && sndP.events) || sndListenOf(s)) items.push({ listen: true, label: snd.play ? $t('Stop listening') : $t('Listen along {name}', { name: names.get(s.id) || Region.KINDS[s.kind].label }), run: () => (snd.play ? sndStopPlay(true) : sndListenAsk(s)) });
    return items;
  }
  // ---- the planes' context menu (v15, src/planemenu.js): what it needs from the app ----
  function planeMenuApi() {
    const paneOf = (side) => (side === 'R' ? paneR : paneL);
    const viewOf = (side) => (side === 'R' ? V.right : leftView());
    const flatSide = (side) => (side === 'R' ? rImage() : lFlat());
    const zpStepK = (k) => { const st = S.steps[k - 1]; return st && st.type === 'zp' ? st : null; };
    return {
      paneOf,
      sideOf: (el) => (!el || !paneL ? null : el === paneL.ocanvas ? 'L' : el === paneR.ocanvas ? 'R' : null),
      // the pane is on screen (a merged view shows one pane alone)
      shown: (side) => !!paneOf(side) && solo() !== (side === 'L' ? 'R' : 'L') && paneOf(side).ocanvas.getClientRects().length > 0,
      // what pane pixel (x, y) shows: {z, surface ('flat', 'globe', 'land'), plane ('X', 'Y', or 'D' for the
      // deformation), stage, s (px per unit on a flat pane)}; null off a globe or the relief
      at(side, x, y) {
        if (side === 'L') {
          const j = leftStage();
          if (lLand()) { const z = pickLand(x, y); return z && CX.isFin(z) ? { z, surface: 'land', plane: 'X', stage: j } : null; }
          if (lGlobe()) { const z = typeof pickSphereLeft === 'function' ? pickSphereLeft(x, y) : null; return z && CX.isFin(z) ? { z, surface: 'globe', plane: 'X', stage: j } : null; }
          paneL.setView(leftView());
          return { z: paneL.s2w(x, y), surface: 'flat', plane: 'X', stage: j, s: paneL.view.s };
        }
        const plane = morphOn() ? 'D' : 'Y', st = rightStage();
        if (rGlobe()) { const w = pickSphere(paneR, camS, x, y); return w && CX.isFin(w) ? { z: w, surface: 'globe', plane, stage: st } : null; }
        paneR.setView(V.right);
        return { z: paneR.s2w(x, y), surface: 'flat', plane, stage: st, s: paneR.view.s };
      },
      toClient(side, z) { if (!flatSide(side)) return null; const p = paneOf(side); p.setView(viewOf(side)); const [x, y] = p.w2s(z), r = p.ocanvas.getBoundingClientRect(); return [r.left + x, r.top + y]; },
      scale: (side) => (flatSide(side) ? viewOf(side).s : null),
      round: (side, z) => { const p = paneOf(side); p.setView(viewOf(side)); return zpRound(p, z); },
      yHtml, fnHtml, mapF: () => focusF(),
      // the zeros and poles: the same functions as the card's (and the Inspector's) buttons and fields
      zp: {
        max: Funcs.ZP_MAX,
        count: (k, kind) => { const st = zpStepK(k); return st ? zpItems(st, kind).length : 0; },
        remove: (k, kind, i) => zpRemove(k, kind, i),
        // a zero becomes a pole at the same value (or back): one undo step
        swap(k, kind, i) {
          const st = zpStepK(k);
          if (!st) return -1;
          const v = zpParse(zpItems(st, kind)[i] || '');
          if (!v) return -1;
          const other = kind === 'zeros' ? 'poles' : 'zeros', j = zpAdd(k, other, v);
          if (j < 0) return -1;
          const list = zpItems(st, kind);
          list.splice(i, 1);
          zpWrite(st, kind, list);
          zpSel = { k, kind: other, i: j };
          chainChanged(false); refreshZpCard(k); commit(); requestRender('OL');
          return j;
        },
        hit: (x, y, r) => { if (!lFlat() || !zpStep()) return null; const m = zpHit(x, y, r); return m ? { k: m.k, kind: m.kind, i: m.i } : null; },
        field: (k, kind, i) => [...document.querySelectorAll(`[data-k="${k}"] input[data-zp="${kind}:${i}"]`)].find((el) => el.getClientRects().length > 0) || null,
        // (the fields are the Inspector's: Edit opens step k there, the temporary Inspector when the panel is hidden)
        edit(k, kind, i) { inspectStep(k); const el = this.field(k, kind, i); if (el) { el.scrollIntoView({ block: 'nearest' }); el.focus(); el.select(); } return el; },
      },
      cutAt: (x, y) => (lFlat() ? (cutHandlesL.find((hd) => Math.hypot(hd.x - x, hd.y - y) < 12) || {}).step || 0 : 0),
      // step k in the Inspector (v15: a click on its card does the same)
      inspect: (k) => inspectStep(k),
      resetCut(k) { const st = S.steps[k - 1]; if (!st) return; const d = Number(Funcs.defaults(st.type).cut); setCut(k, Number.isFinite(d) ? d : 180, false); scheduleFix(); commit(); requestRender('L', 'R', 'T', 'OL'); },
      // the shape under the pointer: X's shapes at stage 0, Y's targets where they are edited
      shapeAt(side, x, y) {
        const target = side === 'R';
        if (target ? !(rImage() && targetsEditable()) : !(lFlat() && leftStage() === 0)) return null;
        const pane = paneOf(side);
        pane.setView(viewOf(side));
        const z = pane.s2w(x, y), tol = 7 / pane.view.s, list = target ? S.targets : S.shapes, win = target ? targetWin() : clipWin;
        // ([v16.5 UX56] a point first, as a press picks it: a point on a curve is the menu's subject, not the curve; the
        // other shapes there are named as where it lies)
        const rank = (s) => (kindType(s) === 'point' ? 0 : kindType(s) === 'area' ? 2 : 1);
        const cands = list.filter((s) => s.visible !== false).reverse().sort((a, b) => rank(a) - rank(b));
        const names = shapeNames();
        const nm = (s) => (typeof Construct !== 'undefined' && s.kind === 'point' && Construct.shapeLabel ? Construct.shapeLabel(s) : '') || names.get(s.id) || (target ? targetLabel(s, S.targets.indexOf(s)) : Region.KINDS[s.kind].label);
        const hits = [];
        for (const s of cands) {
          let hit = false;
          try { hit = Region.hitTest(s, z, tol, win); } catch (e) { hit = false; }
          if (hit) hits.push(s);
        }
        if (!hits.length) return null;
        const s = hits[0];
        return { id: s.id, name: nm(s), kind: s.kind, selected: selected === s.id, on: s.kind === 'point' ? hits.slice(1).filter((x) => kindType(x) === 'curve').map(nm) : [] };
      },
      hide(id) {
        const s = findShape(id);
        if (!s) return;
        const target = S.targets.includes(s);
        s.visible = false;
        if (selected === id) selected = null;
        if (target) targetsChanged(true); else shapesChanged(true);
        commit();
        undoToast($t('Shape hidden.'));
      },
      del: (id) => deleteShape(id),
      integralItems: (side, x, y, cx, cy, prefer) => integralItems(paneOf(side), side, x, y, cx, cy, prefer),
      // the keyboard probe of a focused X plane (sound's arrow-key probe), in pane pixels
      kbPoint(side) { if (side !== 'L' || !snd.kz || !lFlat()) return null; paneL.setView(leftView()); return paneL.w2s(snd.kz); },
      undoToast: (m) => undoToast(m),
      openMenu: (anchor, items, cls) => { closePalette(); return openMenu(anchor, items, cls); },
      armOutside: () => armOutside(null), close: () => closePalette(),
    };
  }
  // a right click or a long press at pane pixel (x, y): the plane menu (the integral menu where planemenu.js is absent)
  function planeMenuAt(pane, side, x, y, touch) {
    const r = pane.ocanvas.getBoundingClientRect();
    if (typeof PlaneMenu === 'undefined') return openIntegralMenu(pane, side, x, y, r.left + x, r.top + y);
    return PlaneMenu.open(side, null, { x, y, clientX: r.left + x, clientY: r.top + y, touch: !!touch });
  }
  // a drawing in progress: a polygon's vertices, a shape being dragged out (on a plane or a globe), a construction's
  // picks (or its picked curve)
  const drawing = () => !!draft || !!(drag && (drag.mode === 'draw' || drag.mode === 'gdraw')) || (typeof Construct !== 'undefined' && Construct.drafting());
  // a right-click (or a long press) while drawing cancels the drawing, as Esc does, and opens no menu (issue #13).
  // True when there was one
  function cancelDrawing() {
    if (!drawing()) return false;
    if (drag && (drag.mode === 'draw' || drag.mode === 'gdraw')) {
      if (drag.mode === 'draw' && typeof Construct !== 'undefined') Construct.drawEnd(null, !!drag.target);   // (its snapped start binds nothing)
      if (drag.mode === 'gdraw') gSnapMark = null;
      drag = null;
    }
    if (draft && draft.kind === 'lasso' && !draft.target) snd.loop = null;
    draft = null;
    if (typeof Construct !== 'undefined') Construct.cancel();
    requestRender('L', 'OL', 'OR', rGlobe() ? 'R' : null);
    return true;
  }
  // a right-click that did not pan: it cancels a drawing, else opens the plane menu there
  const rightClickAt = (pane, side, x, y, touch) => cancelDrawing() || planeMenuAt(pane, side, x, y, touch);
  // centre a flat plane's view at z (a double-click on the plane, issue #13)
  function centerView(side, z) {
    if (side === 'L' ? !lFlat() : !rImage()) return;
    if (side === 'L') { const v = leftView(); v.cx = z.re; v.cy = z.im; if (leftStage() > 0) leftAuto = false; sourceViewChanged(); requestRender('L', 'OL', 'OR'); }
    else { V.right.cx = z.re; V.right.cy = z.im; rightAuto = false; requestRender('R', 'OR'); }
    save();
  }
  // TEMP-DEBUG-HOOK (removed before publishing)
  window.__cmwPlaneMenu = () => ({ stage: (k, re, im) => { const w = stageF(k)(C(re, im)); return [w.re, w.im]; }, w2s: (side, re, im) => { const p = side === 'R' ? paneR : paneL; p.setView(side === 'R' ? V.right : leftView()); const [x, y] = p.w2s(C(re, im)), r = p.ocanvas.getBoundingClientRect(); return [r.left + x, r.top + y]; }, s2w: (side, cx, cy) => { const p = side === 'R' ? paneR : paneL; p.setView(side === 'R' ? V.right : leftView()); const r = p.ocanvas.getBoundingClientRect(), w = p.s2w(cx - r.left, cy - r.top); return [w.re, w.im]; }, view: (side) => Object.assign({}, side === 'R' ? V.right : leftView()), steps: () => JSON.parse(JSON.stringify(S.steps)), hist: () => ({ hi, n: hist.length }), shapes: () => JSON.parse(JSON.stringify(S.shapes)), targets: () => JSON.parse(JSON.stringify(S.targets)), selected: () => selected, drag: () => (drag ? drag.mode : null), focus: () => S.focus });
  // TEMP-DEBUG-HOOK
  // a complex value for copying: components within tol read 0
  const cxCopy = (w, tol) => {
    if (!CX.isFin(w)) return '';
    const re = Math.abs(w.re) <= tol ? 0 : w.re, im = Math.abs(w.im) <= tol ? 0 : w.im;
    return CX.fmt(C(re, im), 12).replace(/\s/g, '');
  };
  function openIntegralPop(id, cx, cy, o) {
    closePalette();
    const s = S.shapes.find((x) => x.id === id);
    if (!s) return null;
    const pop = h('div', { class: 'pop int-pop', role: 'dialog', 'aria-label': $t('Line integral') });
    $('popHost').append(pop);
    popEl = pop;
    intPop = { id, el: pop, cx, cy, it: null, x: null, timer: 0, beside: !!(o && o.beside), bx0: o && o.bx0 != null ? o.bx0 : null };
    tourEmit('integral-opened', { shape: id });
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
    // (v16.5 V03: opened from the palette, the result sits beside its curve in X, never over Y, where its image is)
    if (intPop.beside) {
      const R = $('paneR').getBoundingClientRect();
      if (R.width > 0 && R.left > pw + 24 && x + pw > R.left - 8) x = Math.max(12, Math.min(intPop.bx0 != null ? intPop.bx0 - pw - 12 : x, R.left - 8 - pw));
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
    if (!list.length) { toast(touchUI() ? $t('Draw a curve or a region first: hold a finger on a curve, then choose Integrate.') : $t('Draw a curve or a region first: right-click a curve to integrate along it.')); return null; }   // (v16.5 UX17: a phone's words)
    // (v16.5 V03: with several curves and none selected, ask; never integrate along a curve chosen for you)
    if (!s && list.length > 1) { toast(touchUI() ? $t('Pick a curve to integrate along: hold a finger on it, then choose Integrate.') : $t('Pick a curve to integrate along: select it, or right-click it.')); return null; }
    return integrateShape(list[0].id);
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
    const f = (x) => I18N.num(CX.fmtNum(x, 4).replace('-', '−'));   // display only: copies use cxCopy
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
      const rows = [];
      if (pts.length && !hasCalc('zerosPoles')) rows.push($t('<div class="cn">Root finding is not available in this build.</div>'));
      else if (pts.length && roots.sig !== rootsSig()) rows.push($t('<div class="ch">Solving {x} = <i>p</i> in view…</div>', { x: fxHtml() }));
      else if (pts.length) {
        let iz = 0, shown = 0;
        // with the left plane on the sphere the solve still runs over the flat view's window
        const where = !lFlat() ? $t('in the flat view') : $t('in view');
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
          if (sols.incomplete && !nz) rows.push($t('<div class="ch">No roots of {x} = {val} found {where}</div>', { x: fxHtml(), val, where }));
          else {
            const pr = { fxHtml: fxHtml(), val, where, choice: sols.truncated ? $tn(' (first {n})', ' (first {n})', sols.length) : '' };
            rows.push(partial ? $tn('<div class="ch">at least {n} root of {fxHtml} = {val} {where}{choice}</div>', '<div class="ch">at least {n} roots of {fxHtml} = {val} {where}{choice}</div>', nz, pr) : $tn('<div class="ch">{n} root of {fxHtml} = {val} {where}{choice}</div>', '<div class="ch">{n} roots of {fxHtml} = {val} {where}{choice}</div>', nz, pr));
          }
          const ink = rootInk(s);
          for (const r of zs) {
            iz++;
            if (shown++ >= 6) continue;
            rows.push(`<div class="cl"><span><span class="sw" style="background:${ink}"></span>${rootName(iz)}${r.mult > 1 ? ` <span class="cm">×${r.mult}</span>` : ''}</span><span class="cv">${cxShort(r.z, rootScale())}</span></div>`);
          }
          // poles like zeros: one row each, with the order and the place
          for (const r of ps) {
            if (shown++ >= 6) continue;
            rows.push($t('<div class="cl"><span><span class="sw pole" style="color:{poleColor}"></span>pole{choice}</span><span class="cv">{z}</span></div>', { poleColor: TH.pole, choice: r.mult > 1 ? ` <span class="cm">×${r.mult}</span>` : '', z: cxShort(r.z, rootScale()) }));
          }
          if (sols.incomplete) rows.push($t('<div class="cn">The search stopped early; there may be more.</div>'));
          // a rational F of degree d takes every value d times on the sphere (a polynomial, d times in ℂ)
          else if (!partial && deg && nz < deg.d) rows.push($t('<div class="cn">{choice}{d} more outside {choice2}.</div>', { choice: deg.poly ? '' : $t('Up to '), d: deg.d - nz, choice2: !lFlat() ? $t('the flat view') : $t('the view (zoom out to see them)') }));
        });
        if (shown > 6) rows.push($tn('<div class="cm">and {n} more</div>', '<div class="cm">and {n} more</div>', shown - 6));
        if (roots.err) rows.push(`<div class="cn err">${roots.err}</div>`);
      }
      // (v16.5 UX20, V01: what the area and curve targets show is a note in Y's pane head, or on a phone in Y's title
      // chip, never a row over the plane: targetNote)
      // over the w-globe the chip keeps to its headings, so the scene stays visible
      const compact = rGlobe();
      html = (compact ? rows.filter((r) => r.startsWith('<div class="ch">') || r.includes('cn err')) : rows).join('');
    }
    if (html !== calcChipState.html) { calcChipState.html = html; el.innerHTML = html; }
    const show = want && !!html;
    if (el.hidden === show) el.hidden = !show;
    targetNote(want);
  }
  // (v16.5 UX20, V01) the one-time note of the area and curve targets: in Y's pane head on a desktop ("Preimage shaded
  // in X"); on a phone in Y's title chip ("Shaded in X (the inset)", idleRight), and the inset pulses once when a
  // preimage first appears in it
  function targetText(o) {
    const vis = S.targets.filter((s) => s.visible !== false && s.kind !== 'point');
    if (!vis.length) return '';
    const na = vis.filter((s) => kindType(s) === 'area').length, nc = vis.length - na;
    const ph = document.documentElement.classList.contains('ph'), inset = ph && $('paneL') && $('paneL').classList.contains('ph-inset');
    if (o && o.phone) return na && nc ? (inset ? $t('Shaded and drawn in X (the inset)') : $t('Shaded and drawn in X')) : nc ? (inset ? $t('Drawn in X (the inset)') : $t('Drawn in X')) : inset ? $t('Shaded in X (the inset)') : $t('Shaded in X');
    // (a desktop's head note is short, so it keeps its place beside the title: what is shaded or drawn is its tooltip)
    return $t('Preimage in X');
  }
  // ([v16.5 fix regress-7] it runs at the end of every Y render, a deformation or a pan frame: keyed on what it says,
  // it returns at once while that is unchanged)
  let targetNoteKey = '';
  function targetNote(want) {
    const ph = document.documentElement.classList.contains('ph');
    let nv = 0, na = 0;
    if (want) for (const s of S.targets) if (s.visible !== false && s.kind !== 'point') { nv++; if (kindType(s) === 'area') na++; }
    const key = `${want ? 1 : 0}|${ph ? 1 : 0}|${nv}|${na}|${I18N.lang}|${S.focus}|${chainSig[nSteps()]}|${!!$('rightNote')}`;
    if (key === targetNoteKey) return;
    targetNoteKey = key;
    const head = document.querySelector('#paneR .pane-head');
    let el = $('rightNote');
    const txt = want && !ph ? targetText() : '';
    if (!el && txt && head) { el = h('span', { class: 'head-note', id: 'rightNote', role: 'status' }); const g = head.querySelector(':scope > .grow'); head.insertBefore(el, g ? g.nextSibling : null); }
    if (el) {
      // (areas are shaded, curves drawn: the tip says only what the targets are)
      const tip = !txt ? '' : !na ? $t('The curves that {x} maps onto the targets of Y are drawn in X.', { x: fnText() })
        : na === nv ? $t('Where {x} lands in the targets of Y is shaded in X.', { x: fnText() })
        : $t('Where {x} lands in the targets of Y is shaded in X; the curves it maps onto them are drawn there.', { x: fnText() });
      let fit = false;
      if (el.textContent !== txt || el.dataset.tip !== tip) { el.textContent = txt; el.dataset.tip = tip; fit = true; }
      if (el.hidden === !!txt) { el.hidden = !txt; fit = true; }
      if (fit) fitTitle('R');
    }
    // (a phone: the inset X pulses once when a preimage first appears in it)
    const n = want ? S.targets.filter((s) => s.visible !== false && s.kind !== 'point').length : 0;
    const was = calcChipState.nOthers || 0;
    calcChipState.nOthers = n;
    if (n > was && ph) {
      const pl = $('paneL');
      if (pl && pl.classList.contains('ph-inset')) { pl.classList.remove('ph-pulse'); void pl.offsetWidth; pl.classList.add('ph-pulse'); setTimeout(() => pl.classList.remove('ph-pulse'), 1000); }
    }
  }

