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
    return pullTargets((S.targets || []).filter((s) => s.visible !== false && kindType(s) !== 'point' && (!areasOnly || kindType(s) === 'area')));
  }
  function pullTargets(list) {
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
  // ([#253] full propagation) the shapes of a later plane s seen in plane j < s: their preimages under the steps
  // j + 1 … s, pulled back per pixel as the targets are (the map forward, then the shape's membership test), one pass
  // per plane s. A point's preimages are not drawn (they are roots, not a picture)
  function stagePullbacks(pane, j) {
    const by = new Map();
    for (const s of S.shapes) {
      const st = shapeStage(s);
      if (s.visible === false || st <= j || kindType(s) === 'point') continue;
      if (!by.has(st)) by.set(st, []);
      by.get(st).push(s);
    }
    if (!by.size || !GLR.ok || typeof GLR.drawPreimage !== 'function') return false;
    // (one frame for every plane's pass, one blit: a pass per plane s, never a blit per plane; its pending is the
    // caller's, since a card is cached as final only when nothing it drew is still linking)
    let pending = false;
    try {
      GLR.begin(pane.pw, pane.ph);
      cmFormAnchor('Y');
      for (const [st, list] of by) GLR.drawPreimage({ map: { mode: 0, a: j, b: st }, view: pane.view, dpr: pane.dpr, targets: pullTargets(list), ink: TH.inkRGB, halo: GLR.hexRGB(TH.halo) });
      pending = !!(GLR.frameStatus && GLR.frameStatus().pending);
      GLR.blit(pane.ctx);
    } catch (e) { console.error('drawPreimage', e); }
    pane.ctx.setTransform(pane.dpr, 0, 0, pane.dpr, 0, 0);
    return pending;
  }
  // the same for a globe of plane j: drawSphere's pre passes, one per later plane s
  function stagePreList(j) {
    const by = new Map();
    for (const s of S.shapes) {
      const st = shapeStage(s);
      if (s.visible === false || st <= j || kindType(s) === 'point') continue;
      if (!by.has(st)) by.set(st, []);
      by.get(st).push(s);
    }
    return [...by].map(([st, list]) => ({ map: { mode: 0, a: j, b: st }, targets: pullTargets(list), halo: GLR.hexRGB(TH.halo) }));
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
  const hasCalc = (fn) => Calc && typeof Calc[fn] === 'function';
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

  // ---------------- [#252] the preimages of a point of a later plane ----------------
  // A point of plane s seen in plane j < s: the solutions z of rangeF(j, s)(z) = p over the visible window (as the
  // targets' roots are found). The PRE_SHOW nearest to the view's centre are drawn, hollow and named a₍₁₎, a₍₂₎ …;
  // the others are counted ("+k more"). The search runs once the view and the chain settle; while the point moves
  // (its drag, a slider, Play) each solution follows by Newton from where it was, within PRE_TRACK_MS a frame, so the
  // dots move with it and no search runs mid-motion. A press on a dot in X drags it: the point goes where the dot's
  // image lands (a point bound to a free number moves the number), unless a step between uses that number
  const PRE_SHOW = 4, PRE_TRACK_MS = 4;
  const preOf = { L: { key: '', want: '', timer: 0, sig: '', list: [], hits: [] }, R: { key: '', want: '', timer: 0, sig: '', list: [], hits: [] } };
  const prePoints = (j) => S.shapes.filter((s) => s.visible !== false && s.kind === 'point' && !s._atInf && shapeStage(s) > j);
  const preSig = (j) => JSON.stringify([j, chainSig[nSteps()], prePoints(j).map((s) => [s.id, shapeStage(s)])]);
  // the solutions follow their points' moves (an entry keeps the p it was solved for)
  function trackPre(P, j, box) {
    const size = Math.max(box.x1 - box.x0, box.y1 - box.y0), end = performance.now() + PRE_TRACK_MS;
    for (const e of P.list) {
      const s = S.shapes.find((x) => x.id === e.id);
      if (!s || (s.p[0] === e.p[0] && s.p[1] === e.p[1])) continue;
      const F = rangeF(j, e.s), w0 = C(e.p[0], e.p[1]), w1 = C(s.p[0], s.p[1]);
      e.sols = e.sols.map((r) => { const z = trackRoot(F, r.z, 1, w0, w1, size, end); return z ? { z, mult: r.mult } : null; }).filter(Boolean);
      e.p = s.p.slice();
    }
  }
  function updatePre(side, pane, j) {
    const P = preOf[side], pts = prePoints(j);
    if (!pts.length) { P.list = []; P.key = P.want = P.sig = ''; return; }
    if (!hasCalc('zerosPoles') || !(pane.w > 0)) return;
    const box = pane.box(), sig = preSig(j);
    const key = sig + JSON.stringify([box.x0, box.x1, box.y0, box.y1, pts.map((s) => s.p)]);
    if (key === P.key || key === P.want) return;
    if (P.sig === sig) trackPre(P, j, box);
    P.want = key;
    clearTimeout(P.timer);
    P.timer = setTimeout(function run() {
      if (interacting()) { P.timer = setTimeout(run, 150); return; }
      if (P.want !== key) return;
      const out = [], ms = Math.max(40, Math.min(200, 600 / pts.length));
      for (const s of pts) {
        const st = shapeStage(s), F = rangeF(j, st);
        let sols = null;
        try { sols = zerosPolesTimed(F, box, { target: { re: s.p[0], im: s.p[1] }, max: 40 }, ms); } catch (e) { sols = null; }
        out.push({ id: s.id, s: st, p: s.p.slice(), sols: (sols || []).filter((r) => r && r.z && CX.isFin(r.z) && r.kind !== 'pole').map((r) => ({ z: r.z, mult: r.mult || 1 })), more: !sols || !!(sols.truncated || sols.incomplete) });
      }
      P.list = out; P.key = key; P.want = ''; P.sig = sig;
      requestRender(side);
    }, 100);
  }
  // the dots: the PRE_SHOW nearest to the centre of the view; their places on screen for the press (P.hits)
  function drawPre(pane, side, j) {
    const P = preOf[side];
    P.hits = [];
    if (artMode || P.sig !== preSig(j)) return;
    const ctx = pane.ctx, labels = [], b = pane.box(), cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    for (const e of P.list) {
      const s = S.shapes.find((x) => x.id === e.id);
      if (!s) continue;
      const ink = shapeInk(s), name = pointLabel(s, 0, 0);
      const vis = e.sols.filter((r) => inBoxZ(r.z, b, 0)).sort((p, q) => Math.hypot(p.z.re - cx, p.z.im - cy) - Math.hypot(q.z.re - cx, q.z.im - cy));
      vis.slice(0, PRE_SHOW).forEach((r, i) => {
        const [x, y] = pane.w2s(r.z);
        ctx.save();
        ctx.strokeStyle = TH.halo; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.stroke();
        ctx.strokeStyle = ink.edge; ctx.lineWidth = 1.75; ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.stroke();
        ctx.restore();
        labels.push({ x, y, text: `${name}₍${sub(i + 1)}₎` });
        P.hits.push({ id: s.id, s: e.s, j, x, y });
      });
      const rest = vis.length - PRE_SHOW;
      if (rest > 0 || (e.more && vis.length)) {
        const [x, y] = pane.w2s(vis[Math.min(PRE_SHOW, vis.length) - 1].z);
        labels.push({ x: x + 14, y: y + 14, text: rest > 0 ? $t('+{n} more', { n: rest }) : $t('more'), word: true });
      }
    }
    if (labels.length) placeLabels(ctx, pane, labels);
  }
  // the dot under (x, y) in a pane, or null
  function preHit(side, x, y, r) {
    let best = null, bd = r;
    for (const h of preOf[side].hits) { const d = Math.hypot(h.x - x, h.y - y); if (d <= bd) { bd = d; best = h; } }
    return best;
  }
  // a dot dragged: the point goes to the image of z (its number, when it is a free number's), and the dot stays under
  // the pointer
  function preDrag(d, z) {
    const s = S.shapes.find((x) => x.id === d.id);
    if (!s) return;
    const w = rangeF(d.j, d.s)(z);
    if (!CX.isFin(w)) return;
    const e = preOf.L.list.find((q) => q.id === d.id);
    if (e) {
      const zs = d.z || z;
      let best = -1, bd = Infinity;
      e.sols.forEach((r, i) => { const dd = CX.abs(CX.sub(r.z, zs)); if (dd < bd) { bd = dd; best = i; } });
      if (best >= 0) e.sols[best] = { z, mult: 1 };
      e.p = [w.re, w.im];
    }
    d.z = z; d.moved = true;
    if (d.bn) Params.set(d.bn, { re: w.re, im: w.im }, { live: true });
    else { s.p = [w.re, w.im]; shapesChanged(false); }
  }
  // whether a step from plane j to plane s uses the number nm (Q4: such a dot is not dragged)
  const preUses = (j, s, nm) => S.steps.slice(j, s).some((st) => stepUses(st, new Set([nm])));
  // TEMP-DEBUG-HOOK (removed before publishing)
  /** @type {any} */ (window).__cmwPre = (side = 'L') => ({ sig: preOf[side].sig, list: preOf[side].list.map((e) => ({ id: e.id, s: e.s, p: e.p, sols: e.sols.map((r) => [r.z.re, r.z.im]), more: e.more })), hits: preOf[side].hits.map((h) => ({ id: h.id, x: h.x, y: h.y })) });
  // TEMP-DEBUG-HOOK

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
  const fixedNm = (s) => (Construct.fixedName ? Construct.fixedName(s) : null);
  const capFirst = (t) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);
  function rowName(s, counts, pv, row = true) {
    if (s.name && s.kind !== 'point') return s.name;   // (a point's own name is its label, in the plane too)
    const fx = fixedNm(s);
    if (fx) return row ? capFirst(fx) : fx;
    if (s.kind !== 'point') return shapeName(s, counts);
    const helper = Construct.pointMark && Construct.pointMark(s) === 'helper';
    // (a labelled point takes a plane index too, as in drawPoints: the next free point is z₁ after it, not z₀)
    if (s.label) { if (!helper && s.visible !== false) pv.n++; return shapeName(s, counts); }
    // (a helper's meet name reads the curves' names, so only a row asks for it: shapeNames never recurses)
    if (helper) return (row && Construct.shapeLabel && Construct.shapeLabel(s)) || shapeName(s, counts);
    if (s.visible === false) return shapeName(s, counts);
    return pointLabel(s, pv.n++, 0);
  }
  // ---- the right-click menu and the integral popover ----
  let intPop = null;   // {id (shape), el, cx, cy (where it opened), it (the integral), x (winding, zeros and poles), timer}
  let lastPan = { t: 0, moved: false };   // a right-button pan just ended: its contextmenu opens nothing
  let holdMenuT = 0;   // a long press opened the menu: the touch's own contextmenu event opens nothing more
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
        num: (k, kind, i) => Constr.zpNum(zpStepK(k), kind, i),
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
        if (target ? !(rImage() && targetsEditable()) : !lFlat()) return null;
        const pane = paneOf(side);
        pane.setView(viewOf(side));
        // ([#252] X's shapes of the plane it shows)
        const z = pane.s2w(x, y), tol = 7 / pane.view.s, list = target ? S.targets : planeShapes(), win = target ? targetWin() : leftStage() > 0 ? stageWin(leftStage()) : clipWin;
        // ([v16.5 UX56] a point first, as a press picks it: a point on a curve is the menu's subject, not the curve; the
        // other shapes there are named as where it lies)
        const rank = (s) => (kindType(s) === 'point' ? 0 : kindType(s) === 'area' ? 2 : 1);
        const cands = list.filter((s) => s.visible !== false).reverse().sort((a, b) => rank(a) - rank(b));
        const names = shapeNames();
        const nm = (s) => (s.kind === 'point' && Construct.shapeLabel ? Construct.shapeLabel(s) : '') || names.get(s.id) || (target ? targetLabel(s, S.targets.indexOf(s)) : Region.KINDS[s.kind].label);
        const hits = [];
        for (const s of cands) {
          let hit = false;
          try { hit = Region.hitTest(s, z, tol, win); } catch (e) { hit = false; }
          if (hit) hits.push(s);
        }
        if (!hits.length) return null;
        const s = hits[0], i = list.indexOf(s);
        // (every shape under the pointer, to pick one that another covers; and whether the subject can go forward or back)
        return { id: s.id, name: nm(s), kind: s.kind, selected: selected === s.id, on: s.kind === 'point' ? hits.slice(1).filter((x) => kindType(x) === 'curve').map(nm) : [],
          all: hits.map((x) => ({ id: x.id, name: nm(x), selected: selected === x.id })), canFront: i < list.length - 1, canBack: i > 0 };
      },
      // the vertex of a polygon under the pointer (for Remove vertex), X's shapes at stage 0, Y's targets where edited
      vertexAt(side, x, y, touch) {
        const target = side === 'R';
        if (target ? !(rImage() && targetsEditable()) : !(lFlat() && leftStage() === 0)) return null;
        const pane = paneOf(side);
        pane.setView(viewOf(side));
        for (const s of (target ? S.targets : S.shapes).filter((q) => q.visible !== false && polyEditable(q)).reverse()) {
          const i = polyVertexAt(pane, s, x, y, touch ? 22 : 9);
          if (i >= 0) return { id: s.id, i, n: s.pts.length };
        }
        return null;
      },
      removeVertex(id, i) { if (polyRemoveVertex(id, i)) undoToast($t('Vertex removed.')); },
      select(id) { selected = id; zpSel = null; buildShapeList(); requestRender('L', 'R', 'OL'); },
      newNumber: (z) => newNumberHere(z),
      front(id) { const t = S.targets.some((x) => x.id === id); moveShapeTo(id, (t ? S.targets : S.shapes).length - 1); },
      back(id) { moveShapeTo(id, 0); },
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
    return PlaneMenu.open(side, null, { x, y, clientX: r.left + x, clientY: r.top + y, touch: !!touch });
  }
  // a drawing in progress: a polygon's vertices, a shape being dragged out (on a plane or a globe), a construction's
  // picks (or its picked curve)
  const drawing = () => !!draft || !!(drag && (drag.mode === 'draw' || drag.mode === 'gdraw')) || Construct.drafting();
  // a right-click (or a long press) while drawing cancels the drawing, as Esc does, and opens no menu (issue #13).
  // True when there was one
  function cancelDrawing() {
    if (!drawing()) return false;
    if (drag && (drag.mode === 'draw' || drag.mode === 'gdraw')) {
      if (drag.mode === 'draw') Construct.drawEnd(null, !!drag.target);   // (its snapped start binds nothing)
      if (drag.mode === 'gdraw') gSnapMark = null;
      drag = null;
    }
    if (draft && draft.kind === 'lasso' && !draft.target) snd.loop = null;
    if (draft && draft.pending) dropPending();   // ([UX47] a two-click shape's snapped start binds nothing)
    draft = null;
    Construct.cancel();
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
  // GPU Cauchy style of the Phase view: N nodes on the subject's boundary, shared by its components by length
  const cauchyCache = { key: '', val: null };

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
  // what the integrals (src/integrals.js) need from the app: its functions and constants, and the state they
  // reassign as getters (and setters for the state they write)
  function integralsApi() {
    return {
      C, ICONS, SND, V, armOutside, cauchyCache, closePalette, copyText, cxShort, fnHtml, focusF, hasCalc, intLabel,
      integrateShape, kindType, lColor, lFlat, leftStage, leftView, liftC, morphOn, nSteps, openMenu, project,
      rImage, requestRender, rightStage, shapeGPU, shapeInk, shapeKey, shapeNames, snd, sndListenAsk, sndListenOf,
      sndStopPlay, stageF, sub, toast, touchUI, tourEmit, trans, zerosPolesTimed,
      get S() { return S; },
      get TH() { return TH; },
      get chainSig() { return chainSig; },
      get clipWin() { return clipWin; },
      get drag() { return drag; },
      get intPop() { return intPop; }, set intPop(v) { intPop = v; },
      get popEl() { return popEl; }, set popEl(v) { popEl = v; },
      get selected() { return selected; },
      get sndP() { return sndP; },
    };
  }
  // the app calls the module by the old names (as untyped calls: their types stay the module's own)
  const INT = /** @type {any} */ (Integrals);
  function curvePieces(...args) { return INT.curvePieces(...args); }
  function sphereProj(...args) { return INT.sphereProj(...args); }
  function drawIntHighlight(...args) { return INT.drawIntHighlight(...args); }
  function openIntegralMenu(...args) { return INT.openIntegralMenu(...args); }
  function integralItems(...args) { return INT.integralItems(...args); }
  function openIntegralPop(...args) { return INT.openIntegralPop(...args); }
  function refreshIntPop(...args) { return INT.refreshIntPop(...args); }
  function integrateSelected(...args) { return INT.integrateSelected(...args); }
  function cauchyPlot(...args) { return INT.cauchyPlot(...args); }
  function plotF(...args) { return INT.plotF(...args); }

