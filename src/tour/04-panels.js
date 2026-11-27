  // ---------------------------------------------------------------- the spotlight inside a scrolling panel
  // On a phone (notes/tour/PHONE.md) a panel that scrolls (a sheet, the chain bar) scrolls on the compositor: its
  // content moves in a frame the page's script has not seen yet, so a spotlight drawn in fixed position over the page
  // trails it by a frame or more during a touch scroll and its fling (the jiggle). There a lit part inside such a panel
  // is drawn inside the panel: an SVG at the panel's content origin, above its content, so its shade and ring scroll
  // with the content in the same frame, with no script. The fixed shade leaves a window over the panel's visible box,
  // which does not move while the panel scrolls.
  const phoneL = () => { try { return narrow() || document.documentElement.classList.contains('ph'); } catch (e) { return false; } };
  // the panel that scrolls e (null: none, or e does not move with it: fixed or sticky on the way)
  function scrollerOf(e) {
    if (/^(fixed|sticky)$/.test(getComputedStyle(e).position)) return null;
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if ((/(auto|scroll|overlay)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) || (/(auto|scroll|overlay)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1)) return a;
      if (/^(fixed|sticky)$/.test(cs.position)) return null;
    }
    return null;
  }
  // a static panel becomes the drawing's containing block (position: relative) only when no absolutely positioned
  // element inside it is placed from a box outside it (it would move); once per panel and step
  function canHost(ui, H) {
    if (ui.hostOk.has(H)) return ui.hostOk.get(H);
    const hs = getComputedStyle(H);
    // (a panel that fades its own content with an opacity would fade the shade drawn in it too, and its background
    // would show undimmed through the window: drawn over the page instead. A mask, the chain bar's scroll fades, is
    // taken off while the panel hosts (review-phone phone-3): its edges are the shade's then)
    let ok = !(parseFloat(hs.opacity) < 1);
    if (ok && hs.position === 'static') {
      for (const d of H.querySelectorAll('*')) {
        const op = d.offsetParent;
        if (!op || H.contains(op)) continue;
        const cs = getComputedStyle(d);
        // (an empty box that clips, the chain's listbox for screen readers, shows nothing wherever it moves)
        if (cs.position === 'absolute' && !(d.offsetWidth === 0 && d.offsetHeight === 0 && /(hidden|clip)/.test(cs.overflowX + cs.overflowY))) { ok = false; break; }
      }
    }
    ui.hostOk.set(H, ok);
    return ok;
  }
  function hostSvg(ui, H) {
    let h = ui.hosts.get(H);
    if (h && h.svg.parentNode === H) return h;
    if (h) dropHost(ui, H);
    const NS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'tour-dim tour-host'); svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('data-tour', 'host');
    svg.setAttribute('width', '1'); svg.setAttribute('height', '1');
    const mk = (cls) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); svg.append(p); return p; };
    const shade = mk('tour-shade');
    shade.setAttribute('fill-rule', 'evenodd');
    const glow = mk('tour-glow'), ring = mk('tour-ring'), mark = mk('tour-mark');
    // a touch on the dimmed part of the panel still scrolls it (nothing is prevented) but reaches none of its controls
    const stopIt = (e) => { e.stopPropagation(); if (e.type === 'click' || e.type === 'contextmenu') e.preventDefault(); };
    for (const t of ['pointerdown', 'pointerup', 'mousedown', 'click', 'dblclick', 'contextmenu']) shade.addEventListener(t, stopIt);
    shade.addEventListener('touchstart', stopIt, { passive: true });
    // (review-phone phone-6: the panel's own style is recorded on the panel by the first drawing in it, and put back by
    // the last one out, so a run that starts while the last one's drawing fades out keeps the panel set up)
    if (!H.querySelector(':scope > svg.tour-host') && !('tourHost' in H.dataset)) {
      H.dataset.tourHost = JSON.stringify([H.style.position, H.style.maskImage, H.style.webkitMaskImage, H.style.overscrollBehavior]);
      if (getComputedStyle(H).position === 'static') H.style.position = 'relative';
      // (no rubber band at the panel's ends while it hosts: the bounce moves the content past its own edge, where the
      // drawing's layer ends, and showed an undimmed strip at the panel's edge for a moment)
      H.style.overscrollBehavior = 'none';
      const hs = getComputedStyle(H), faded = (v) => v && v !== 'none';
      if (faded(hs.maskImage) || faded(hs.webkitMaskImage)) { H.style.maskImage = 'none'; H.style.webkitMaskImage = 'none'; }
    }
    H.append(svg);
    h = { H, svg, shade, glow, ring, mark, sig: '' };
    ui.hosts.set(H, h);
    return h;
  }
  function dropHost(ui, H) {
    const h = ui.hosts.get(H);
    if (!h) return;
    h.svg.remove();
    ui.hosts.delete(H);
    if (H.querySelector(':scope > svg.tour-host') || !('tourHost' in H.dataset)) return;
    try { const [pos, m, wm, ob] = JSON.parse(H.dataset.tourHost); H.style.position = pos; H.style.maskImage = m; H.style.webkitMaskImage = wm; H.style.overscrollBehavior = ob || ''; } catch (e) { /* */ }
    delete H.dataset.tourHost;
  }
  // a hosted part's lit rect in its panel's content px (origin ox, oy in client px): its box cut only by what clips it
  // inside the panel (the panel's own clip cuts the drawing natively)
  function hostRect(q, H, pad, ox, oy) {
    const full = partBox(q);
    let l = full.left, t = full.top, rr = full.right, b = full.bottom;
    for (let a = q.el.parentElement; a && a !== H; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if ((cs.overflowX === 'visible' && cs.overflowY === 'visible') || cs.display === 'contents') continue;
      const z = a.getBoundingClientRect();
      if (z.width === 0 && z.height === 0) continue;
      l = Math.max(l, z.left); t = Math.max(t, z.top); rr = Math.min(rr, z.right); b = Math.min(b, z.bottom);
    }
    if (rr - l < 0.5 || b - t < 0.5) return null;
    const cut = [t > full.top + 0.5, rr < full.right - 0.5, b < full.bottom - 0.5, l > full.left + 0.5];
    const k = q.rect ? [0, 0, 0, 0] : radii(q.el);
    const rad = [cut[0] || cut[3] ? 0 : k[0], cut[0] || cut[1] ? 0 : k[1], cut[2] || cut[1] ? 0 : k[2], cut[2] || cut[3] ? 0 : k[3]].map((x) => (x > 0 ? x + pad : 0));
    return { l: l - pad - ox, t: t - pad - oy, r: rr + pad - ox, b: b + pad - oy, rad };
  }
  // A phone's drawing plan: null when no lit part is inside a panel that scrolls. Else { outer: { holes, marks } (the
  // parts drawn over the page), wins (each panel's visible box: a window in the fixed shade, with no ring), inner: [{ h,
  // holes, marks, ext, sig }] (in each panel's content px) }. A panel whose window would overlap a part drawn over the
  // page is not used (the even-odd shade would dim their overlap twice).
  function hostPlan(r, step, tgt) {
    const ui = r.ui;
    if (!tgt || !phoneL()) return null;
    const parts = litParts(step, tgt);
    const hs = parts.map((q) => { const H = scrollerOf(q.el); return H && canHost(ui, H) ? H : null; });
    if (!hs.some(Boolean)) return null;
    // (a part in a panel nested inside another lit part's panel, the slider of a in its list inside the Editor
    // sheet, is drawn in the outer panel: two shades one inside the other would dim the lit part around it, and their
    // two windows over the page would cancel out)
    for (let i = 0; i < hs.length; i++) for (let k = 0; hs[i] && k < hs.length; k++) if (hs[k] && hs[k] !== hs[i] && hs[k].contains(hs[i])) { hs[i] = hs[k]; k = -1; }
    const pad = step.pad != null ? step.pad : 0, vp = vpSize();
    const outerOf = (q, i) => { const pr = partRect(q, pad); return pr.hidden || (i > 0 && !(pr.r - pr.l > 0.5 && pr.b - pr.t > 0.5)) ? null : pr; };
    const winOf = (H) => {
      const b = H.getBoundingClientRect(), l = b.left + H.clientLeft, t = b.top + H.clientTop;
      const s = seenBox(H, { left: l, top: t, right: l + H.clientWidth, bottom: t + H.clientHeight });
      const w = { l: Math.max(0, s.l), t: Math.max(0, s.t), r: Math.min(vp.w, s.r), b: Math.min(vp.h, s.b), rad: [0, 0, 0, 0] };
      return w.r - w.l >= 1 && w.b - w.t >= 1 ? w : null;
    };
    const outer = [], groups = new Map(), wins = new Map();
    parts.forEach((q, i) => { if (hs[i]) { if (!groups.has(hs[i])) groups.set(hs[i], []); groups.get(hs[i]).push({ q, i }); } });
    for (const H of groups.keys()) wins.set(H, winOf(H));
    const ov = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    parts.forEach((q, i) => { if (!hs[i]) { const pr = outerOf(q, i); if (pr) outer.push({ pr, i }); } });
    for (const [H, list] of [...groups]) {
      const w = wins.get(H);
      if (w && !outer.some((o) => ov(o.pr, w) > 1)) continue;
      // (no window, or it overlaps a part drawn over the page: this panel's parts are drawn over the page too)
      groups.delete(H); wins.delete(H);
      for (const { q, i } of list) { const pr = outerOf(q, i); if (pr) outer.push({ pr, i }); }
    }
    for (const H of [...ui.hosts.keys()]) if (!groups.has(H)) dropHost(ui, H);
    if (!groups.size) return null;
    outer.sort((a, b) => a.i - b.i);
    const inner = [];
    const qz = (h) => [h.l, h.t, h.r, h.b].map((v) => Math.round(v * 4) / 4).join(' ');
    for (const [H, list] of groups) {
      const h = hostSvg(ui, H), o = h.svg.getBoundingClientRect();
      const a = areasOf(list.map(({ q }) => hostRect(q, H, pad, o.left, o.top)).filter(Boolean), list[0].i === 0);
      const x = { h, H, holes: a.holes, marks: [a.mark, ...a.insets].filter(Boolean), ext: { w: H.scrollWidth, h: H.scrollHeight } };
      x.sig = x.holes.map(qz).join(',') + '|' + x.holes.map((q) => q.rad.join(' ')).join(',') + '|' + x.marks.map(qz).join(',') + '|' + x.ext.w + 'x' + x.ext.h;
      inner.push(x);
    }
    const out = areasOf(outer.map((o) => o.pr), !!outer.length && outer[0].i === 0);
    return { outer: { holes: out.holes, marks: [out.mark, ...out.insets].filter(Boolean) }, wins: [...wins.values()], inner };
  }
  function drawHost(x) {
    const { h, holes, marks, ext } = x;
    // (well past the content's edges, an iOS overscroll included: the panel's own clip cuts the shade to its box)
    const E = 4000;
    h.shade.setAttribute('d', `M${-E} ${-E}H${ext.w + E}V${ext.h + E}H${-E}Z` + holes.map(rrPath).join(''));
    h.ring.setAttribute('d', holes.map((q) => rrPath(grow(q, 0.75))).join(''));
    h.glow.setAttribute('d', holes.map((q) => rrPath(grow(q, 3.5))).join(''));
    h.mark.setAttribute('d', marks.map((m) => rrPath(grow(m, 0.75))).join(''));
    h.sig = x.sig;
  }
  // the rings over the page fade while something moves that they can only follow by script (a fling of the page or
  // of a panel not drawn in, a sliding sheet): a ring a frame behind its target is the jiggle
  function moving(ui, ms0) {
    ui.rsvg.classList.add('moving');
    clearTimeout(ui.moveT);
    ui.moveT = setTimeout(() => ui.rsvg.classList.remove('moving'), ms0 || 160);
  }
  // (review-phone phone-3) a panel the spotlight is drawn inside, scrolled until the step's anchor is wholly out of its
  // visible box (a swipe from the lit + of the chain bar): once the panel is still and no finger is down, it scrolls
  // back just far enough to show the anchor again
  // a step's title starts with a capital letter: a key shared with a phrase used mid-sentence ('Cauchy integral',
  // «интеграл Коши» in a pane's title) is capitalized here; review-phone-verify extra-ru-cauchy
  // (a title that is a task reads as one: 'tour step' is the context of a Russian title in the imperative where the same
  // words, a button or a menu entry elsewhere, stay in the infinitive; a title starting in lower case is capitalised)
  const stepTitle = (st) => {
    const raw = layoutIsPhone() && st.titleTouch ? st.titleTouch : st.title, x = $tx('tour step', raw), t = x !== raw ? x : $t(raw);
    return /^\p{Ll}/u.test(t) ? t[0].toUpperCase() + t.slice(1) : t;
  };
  const BACK_MS = 1800;   // (after the last scroll of the panel, or the finger's lift)
  function bringBack(r, H) {
    const ui = r.ui;
    ui.backH = null;
    if (!r.step || !r.tgt || !ui.hosts.has(H)) return;
    const q = r.tgt.parts[0];
    if (!q || !q.el || !H.contains(q.el)) return;
    if (ui.touching) { ui.backH = H; return; }
    const b = partBox(q), z = H.getBoundingClientRect();
    const l = z.left + H.clientLeft, t = z.top + H.clientTop, rr = l + H.clientWidth, bb = t + H.clientHeight, m = 8;
    const outX = b.right <= l + 1 || b.left >= rr - 1, outY = b.bottom <= t + 1 || b.top >= bb - 1;
    if (!outX && !outY) return;
    const dx = outX ? (b.left < l ? b.left - l - m : b.right - rr + m) : 0, dy = outY ? (b.top < t ? b.top - t - m : b.bottom - bb + m) : 0;
    try { H.scrollBy({ left: dx, top: dy, behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { H.scrollLeft += dx; H.scrollTop += dy; }
  }
  // A second lit area the app itself covers (a short desktop window: the chain under the Inspector) is not lit:
  // at its centre and four inner points the topmost element of the app, the tour and the open layers aside, is
  // another element. (The anchor is never dropped this way.)
  function covered(e) {
    if (!e || !e.isConnected || typeof document.elementsFromPoint !== 'function') return false;
    // (a part inside an open layer, the lens in a phone's sheet, is covered only by what is above it in that layer)
    const b = e.getBoundingClientRect(), vp = vpSize(), lay = layerEls().filter((k) => !k.contains(e));
    let n = 0;
    for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      const x = b.left + fx * b.width, y = b.top + fy * b.height;
      if (x < 0 || y < 0 || x >= vp.w || y >= vp.h) continue;
      const hit = document.elementsFromPoint(x, y).find((h) => !h.closest('[data-tour]') && !lay.some((k) => k.contains(h)));
      n++;
      if (!hit || hit === e || e.contains(hit) || hit.contains(e)) return false;
    }
    return n > 0;
  }
  // the elements whose size the spotlight depends on: the strip, the page, the lit parts (the open layers join in layout)
  function watch(ui, els) {
    if (!ui.ro) return;
    for (const e of els) if (e && !ui.roSet.has(e)) { ui.roSet.add(e); try { ui.ro.observe(e); } catch (x) { /* */ } }
  }
  function watchStep(r) {
    const ui = r.ui;
    if (!ui.ro) return;
    ui.ro.disconnect(); ui.roSet = new Set();
    const els = [ui.strip, document.documentElement];
    if (r.tgt) els.push(...r.tgt.parts.map((q) => q.el));
    const tr = r.step ? tryOf(r.step) : null;
    for (const a of [].concat((r.step && r.step.also) || [], r.step ? ctlOf(r.step) : [], (tr && tr.work) || [])) { const t = anchorOf(a); if (t) els.push(...t.parts.map((q) => q.el)); }
    watch(ui, els);
  }
  // Measure and draw: on a step change (the shade morphs from where it was to the new area, measured afresh in each
  // frame), and whenever something moves (scroll, resize, observers, the motion loop). Returns whether anything
  // changed. There is no placement: the strip is in the layout, a window of the shade with no ring, and a step
  // with no anchor (the welcome) draws no shade at all.
  function layout(stepChange) {
    const r = run;
    if (!r || !r.step) return false;
    const ui = r.ui, step = r.step;
    // the anchor went away while the step shows (a panel closed, the layout changed): another match
    if (r.el && !visible(r.el)) { const t = anchorOf(step.anchor); if (t) { r.tgt = t; r.el = t.el; } }
    // (live: the anchor that shows, a tool's tile in a phone's sheet rather than the More key under it)
    else if (step.live && step.anchor != null) { const t = anchorOf(step.anchor); if (t && t.el !== r.el) { r.tgt = t; r.el = t.el; watchStep(r); } }
    const tgtNow = r.el && visible(r.el) ? r.tgt : null;
    const { holes, mark, insets } = holesFor(step, tgtNow);
    const marks = [mark, ...(insets || [])].filter(Boolean);
    const layers = appLayers();
    watch(ui, layerEls());
    const vp = vpSize();
    // a phone: the parts inside a scrolling panel are drawn inside it (hostPlan)
    const plan = hostPlan(r, step, tgtNow);
    if (!plan) for (const H of [...ui.hosts.keys()]) dropHost(ui, H);
    const wins0 = plan ? plan.wins : [];
    if (plan) watch(ui, plan.inner.map((x) => x.H));
    ui.work = holes.concat(wins0).map((h) => ({ l: h.l, t: h.t, r: h.r, b: h.b }));
    // the strip: a window of the shade (cut by the viewport)
    const sb = ui.strip.getBoundingClientRect();
    const sw = sb.width > 0 && sb.height > 0 ? { l: Math.max(0, sb.left), t: Math.max(0, sb.top), r: Math.min(vp.w, sb.right), b: Math.min(vp.h, sb.bottom), rad: radii(ui.strip) } : null;
    const wins = sw && sw.r > sw.l && sw.b > sw.t ? wins0.concat([sw]) : wins0;
    placeWhy(r);
    const shadeOn = holes.length > 0 || !!plan;
    if (ui.svg.style.display !== (shadeOn ? '' : 'none')) { ui.svg.style.display = shadeOn ? '' : 'none'; ui.rsvg.style.display = shadeOn ? '' : 'none'; }
    // (once the task is done the shade and the rings fade out and let every press through)
    const quiet = !!(r.done && r.quiet);
    if (ui.quiet !== quiet) { ui.quiet = quiet; ui.svg.classList.toggle('tour-quiet', quiet); ui.rsvg.classList.toggle('tour-quiet', quiet); }
    if (plan) for (const x of plan.inner) if (x.h.svg.classList.contains('tour-quiet') !== quiet) x.h.svg.classList.toggle('tour-quiet', quiet);
    const q = (h) => [h.l, h.t, h.r, h.b].map((v) => Math.round(v * 4) / 4);
    // (with a plan, the fixed layer draws the parts outside the panels and a window over each panel; each panel
    // draws its own parts, in its content px, which a scroll of the panel does not change)
    const oHoles = plan ? plan.outer.holes : holes, oMarks = plan ? plan.outer.marks : marks;
    const dsig = JSON.stringify([oHoles.map(q), oMarks.map(q), wins.map(q), oHoles.map((h) => h.rad)]) + (plan ? plan.inner.map((x) => x.sig).join(';') : '');
    ui.drawSig = dsig;
    // (the app's toasts too, so a ring never draws
    // over an Undo)
    const toasts = [...document.querySelectorAll(TOAST_SEL)].filter(visible).map((e) => Object.assign(rectOf(e), { rad: radii(e) }));
    const masked = layers.concat(toasts, ui.whyOpen && ui.whyPanel ? [rectOf(ui.why)] : []);
    const sig = dsig + JSON.stringify(masked.map(q)) + [vp.w, vp.h].join(',');
    const changed = sig !== r.tracked;
    r.tracked = sig;
    if (stepChange) {
      const dur = reduced() ? 0 : ms(getComputedStyle(document.documentElement).getPropertyValue('--t-slow'), 240);
      // (no morph when the lit area stays where it is: the inner ring shows at once)
      const same = ui.holes && ui.holes.length === holes.length && ui.holes.every((h, i) => Math.max(Math.abs(h.l - holes[i].l), Math.abs(h.t - holes[i].t), Math.abs(h.r - holes[i].r), Math.abs(h.b - holes[i].b)) < 1);
      ui.anim = dur && !same && !plan && ui.holes && ui.holes.length && holes.length ? { from: ui.holes.slice(), t0: performance.now(), dur } : null;
    }
    let ended = false;
    if (ui.anim && !holes.length) ui.anim = null;
    if (ui.anim) {
      const u = ease(Math.min(1, (performance.now() - ui.anim.t0) / ui.anim.dur));
      // (the inner ring appears once the shade has settled)
      if (u < 1) { drawHoles(ui, between(ui.anim.from, holes, u), null, masked, wins); kick(2); return true; }
      ui.anim = null; ended = true;
    }
    if (changed || ended || stepChange) { drawHoles(ui, oHoles, oMarks, masked, wins); guardTip(r); }
    if (plan) for (const x of plan.inner) if (stepChange || x.h.sig !== x.sig) drawHost(x);
    ui.holes = holes;
    return changed;
  }
  const rectOf = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, rad: [0, 0, 0, 0] }; };
  // the motion loop: layout every frame for n frames, longer while things keep changing or the shade morphs
  function kick(n) {
    const r = run;
    if (!r) return;
    const ui = r.ui;
    ui.motion = Math.max(ui.motion || 0, n || 2);
    if (!ui.raf) ui.raf = requestAnimationFrame(tick);
  }
  function tick() {
    const r = run;
    if (!r) return;
    const ui = r.ui;
    ui.raf = 0;
    if (layout(false)) ui.motion = Math.max(ui.motion, 12); else ui.motion--;
    if (!ui.raf && (ui.anim || ui.motion > 0)) ui.raf = requestAnimationFrame(tick);
  }
  // a CSS time token in ms ('240ms', '0.24s'); the fallback when it is missing
  function ms(v, dflt) {
    const m = /^\s*([\d.]+)\s*(ms|s)?\s*$/.exec(String(v || ''));
    return m ? parseFloat(m[1]) * (m[2] === 's' ? 1000 : 1) : dflt;
  }
  function track() { kick(2); }

  function armTry(r, step) {
    const t = tryOf(step);
    if (!t || !t.on || typeof api.on !== 'function') return;
    // mem: what this showing of the step has seen so far (the preimages Try it wants a point inside and one outside);
    // count: how many times the event must come (Paths twice, so it ends switched on). The tour listens only after the
    // step's own actions have run, so a task is done only by the user's hand
    let fired = false, hits = 0;
    const mem = {};
    const hit = (e) => {
      if (fired || run !== r || r.step !== step) return;
      try { if (t.test && !t.test(e, mem)) return; } catch (x) { return; }
      if (++hits < (t.count || 1)) return;
      fired = true;
      r.done = true;
      r.doneTasks.add(CHAPTERS[r.ci].id + '/' + step.id);
      r.ui.next.classList.add('ready');
      paintLead(r);
      // (SPEC 2.1) a door moves on after 0.7 s; any other task CD_MS after it is done, unless the step was reached with
      // Back, Move on by itself is off, this showing's countdown was cancelled, or no step follows. (a
      // chapter's last task moves on too, into the next chapter, which Next names)
      const never = !t.advance && (r.dir < 0 || !seek(r.ci, r.si + 1, 1, isAbsent));
      cdFeed(r, { type: 'done', door: !!t.advance, reduced: reduced(), off: rec.auto === false, never });
      // (a field the task's own input came from, emptied by the app: no hold)
      if (r.ui.syncField) r.ui.syncField();
      // ("Next step in 1.5 s" only when it runs; a hold announces them when it ends. Said
      // a frame later, once a layer the task itself opens, the palette, is there and holds them)
      const res = t.then ? plainCopy($t(t.then), modKey()) : '';
      requestAnimationFrame(() => {
        if (run !== r || r.step !== step) return;
        syncLayers(r);
        const counting = !t.advance && r.cd && r.cd.phase === 'running';
        r.ui.live.textContent = $t('Done.') + (res ? ' ' + (/[.!?]$/.test(res) ? res : res + '.') : '') + (counting ? ' ' + nextIn() : '');
      });
      // (the spotlight steps aside, so the result can be seen and touched; a door moves on at once)
      r.quiet = !t.advance;
      layout(false); kick(4);
    };
    for (const ev of [].concat(t.on)) {
      try { const off = api.on(ev, hit); if (typeof off === 'function') r.tryOffs.push(off); } catch (e) { warn('on ' + ev, e); }
    }
    // try.hint: an event that says the attempt went wrong (a hold too short that panned Y) puts a line in place of the
    // task until the task is done
    const h = t.hint, ht = hintFor(t);
    if (ht && h.on) {
      const miss = (e) => {
        if (fired || run !== r || r.step !== step) return;
        try { if (h.test && !h.test(e)) return; } catch (x) { return; }
        if (r.hint === ht) return;
        r.hint = ht;
        paintLead(r);
        r.ui.live.textContent = plainCopy($t(ht), modKey());
      };
      for (const ev of [].concat(h.on)) {
        try { const off = api.on(ev, miss); if (typeof off === 'function') r.tryOffs.push(off); } catch (e) { warn('on ' + ev, e); }
      }
    }
  }

  // Ends the run at once (no waiting: a start right after it finds no run, or takes this one over). keepWork: another
  // chapter takes over (start keeps the borrowed work, the paused autosave and the stash, and tells the app nothing)
  function stop(opt = {}) {
    const r = run;
    if (!r) return;
    run = null;
    lastWhy = r.why;
    r.seq++;   // a show() of this run still waiting gives up
    for (const off of r.tryOffs.splice(0)) off();
    for (const off of r.offs.splice(0)) off();
    cancelAnimationFrame(r.ui.raf);
    if (opt.finished) {
      rec.done[CHAPTERS[r.ci].id] = CHAPTERS[r.ci].rev;
      // "Continue the tour" picks up at the next chapter, or nowhere after the last
      const nc = CHAPTERS.findIndex((c, j) => j > r.ci && chapterShown(c));
      rec.last = nc > 0 ? { ch: CHAPTERS[nc].id, i: 0 } : null;
    }
    rec.open = false;
    save();
    const ui = r.ui;
    // (the sound the Sound chapter held comes back; a Listen along stops)
    call('soundStop');
    call('soundHold', null);
    for (const g of [ui.svg, ui.rsvg, ...[...ui.hosts.values()].map((h) => h.svg)]) { g.style.transition = reduced() ? '' : 'opacity 120ms linear'; g.style.opacity = '0'; }
    ui.raf = 0;
    // the strip leaves the layout at once, and the room it had goes back to the panes
    const focusIn = ui.strip.contains(document.activeElement) || ui.why.contains(document.activeElement);
    ui.strip.remove(); ui.why.remove();
    if (ui.slot) ui.slot.hidden = true;
    if (r.ownSlot) r.ownSlot.remove();
    document.documentElement.style.removeProperty('--tour-h');
    document.documentElement.style.removeProperty('--ph-tour');
    call('slot', 'stage');
    const noStyle = () => { if (r.rootStyle == null && document.documentElement.getAttribute('style') === '') document.documentElement.removeAttribute('style'); };
    setTimeout(() => { ui.root.remove(); ui.top.remove(); for (const H of [...ui.hosts.keys()]) dropHost(ui, H); }, reduced() ? 0 : 140);
    if (opt.keepWork) return;
    // the user's work comes back exactly as it was; the message says so only when it did
    const back = giveBack(r.lend, false);
    call('onTour', false);
    // (no style attribute left on the root that it did not have)
    noStyle();
    if (!opt.silent) {
      const where = helpWhere();
      lastToast = call('toast', !back ? $t('Your work could not be put back here, but it is safe: reload the page to get it back.')
        : !r.lend ? $t('The tour stays under {where}.', { where })
          : opt.finished && r.ci === CHAPTERS.length - 1 ? $t('Tour finished. Your work is back, and the tour stays under {where}.', { where }) : $t('Your work is back. The tour stays under {where}.', { where }));
      const to = r.opener && r.opener.isConnected ? r.opener : anchorEl(['helpBtn', 'moreBtn']);
      // (the focus goes back to the opener when it was in the strip, or nowhere)
      if (focusIn || document.activeElement === document.body || document.activeElement == null) { try { if (to) to.focus({ preventScroll: true }); } catch (e) { /* */ } }
    }
  }

  // ---------------------------------------------------------------- the first-run suggestion
  // (notes/ux-audit REPORT 3.1: the invitation is one line in the tour's own docked slot, never a card over
  // the planes; the slot is the learning lane, which also takes an example's Try line: lane())
  function suggest(opt = {}) {
    if (!doc()) return false;
    load();
    // a tour cut short by a reload: the lane offers to continue it, in place of the first-run invitation
    const cont = cutShort && !!rec.last;
    cutShort = false;
    if (run || sugg || (!opt.force && !cont && !shouldSuggest(rec))) return false;
    const delay = opt.delay != null ? opt.delay : 1200;
    let tries = 0;
    const attempt = () => {
      if (run || !sugg || !sugg.pending) return;
      // (not while a menu or a dialog is open: wait for it to close, about 15 s at most, then until the next opening)
      if (appLayerOpen() && !opt.force) { if (++tries > 15) { sugg = null; return; } sugg.pending = setTimeout(attempt, 1000); return; }
      sugg = null;
      if (!cont || !showContinue()) showSuggest();
    };
    sugg = { pending: setTimeout(attempt, delay) };
    return true;
  }
  function showSuggest() {
    injectCSS();
    rec.shown += 1; save();
    // a returning user (saved work) is not "new here"
    const returning = call('hasWork') === true;
    const title = returning ? $t('Take the 2-minute tour') : $t('New here? Take a 2-minute tour');
    const go1 = () => { hideSuggest(false); start({ chapter: 'basics', opener: anchorEl(['helpBtn', 'moreBtn']) }); };
    const dismiss = () => { rec.outcome = 'dismissed'; rec.v = Math.max(rec.v, VERSION); save(); hideSuggest(true); call('toast', $t('The tour is under {helpWhere} whenever you want it.', { helpWhere: helpWhere() })); };
    const box = laneShow({ id: 'suggest', title, body: $t('Draw a region, send it through a chain of functions and watch its image.'),
      acts: [{ label: $t('Start the tour'), short: $t('Start'), primary: true, run: go1 }, { label: $t('Not now'), run: dismiss }],
      label: $t('Tour suggestion'), drop: 'body', onEsc: () => hideSuggest(true) });
    if (!box) return;
    sugg = { box, lane: true };
    say($t('Tour suggestion: {title}. Start the tour or Not now.', { title }) + ' ' + $t('The tour stays under {where}.', { where: helpWhere() }));
    call('onSuggest', true);
  }
  // "Continue the tour: Views", the step it stopped at, [Continue] [×]; × forgets where it stopped (the
  // help menu's Continue the tour goes with it). -> whether the line is shown
  function showContinue() {
    const ch = rec.last && CHAPTERS.find((c) => c.id === rec.last.ch);
    if (!ch || !chapterShown(ch)) return false;
    injectCSS();
    const i = Math.min(rec.last.i, ch.steps.length - 1), title = $t('Continue the tour: {chapter}', { chapter: $t(ch.title) });
    const go1 = () => { hideSuggest(false); start({ chapter: ch.id, step: i, opener: anchorEl(['helpBtn', 'moreBtn']) }); };
    const box = laneShow({ id: 'continue', title, body: stepTitle(ch.steps[i]),
      acts: [{ label: $t('Continue'), primary: true, run: go1 }],
      label: $t('Continue the tour'), drop: 'body', onEsc: () => hideSuggest(true), onClose: () => { sugg = null; rec.last = null; save(); } });
    if (!box) return false;
    sugg = { box, lane: true, id: 'continue' };
    say(title + '. ' + $t('Continue, or close the line.'));
    return true;
  }
  function hideSuggest(anim) {
    if (!sugg) return;
    if (sugg.pending) clearTimeout(sugg.pending);
    const box = sugg.box, id = sugg.id || 'suggest';
    sugg = null;
    if (!box) return;
    laneHide(id, anim);
    if (id === 'suggest') call('onSuggest', false);
  }

  // ---------------------------------------------------------------- the learning lane
  // One line at a time in the tour's own docked slot: the first-run invitation, an example's
  // Try line. It covers nothing: the layout makes room for it as it does for the strip (--tour-h, the stage's
  // first row on a desktop; --ph-tour, a phone's row under the header; a landscape phone's header when it has room).
  // The tour takes the slot while it runs; × or the line's own action ends a line.
  // o: { id, title, body, acts: [{ label, short, primary, run }], label, drop: 'body' | 'title' (what goes first when the
  // line has no room: laneFit), icon, onEsc, onClose }
  const LANE_H = 48;
  let lane = null;
  function laneShow(o) {
    if (!doc() || run) return null;
    injectCSS();
    if (lane) laneHide(lane.id, false);
    const box = el('section', { class: 'tour-lane', role: 'region', 'aria-label': o.label || $t('Guided tour'), 'data-tour': o.id === 'suggest' ? 'suggest' : 'lane', 'data-lane': o.id });
    const markWrap = el('span', { class: 'tl-mark', 'aria-hidden': 'true' });
    markWrap.innerHTML = o.icon || mark();
    const text = el('p', { class: 'tl-text' }, el('b', { class: 'tl-title tour-sg-title' }, o.title || ''));
    if (o.body) text.append(' ', el('span', { class: 'tl-body tour-sg-body' }, richText(o.body)));
    const acts = el('div', { class: 'tl-acts' });
    for (const a of o.acts || []) {
      const b = el('button', { class: 'btn ' + (a.primary ? 'primary' : 'ghost') + ' tl-act', type: 'button', 'data-short': a.short || a.label }, el('span', { class: 'tl-long' }, a.label), el('span', { class: 'tl-short' }, a.short || a.label));
      b.addEventListener('click', () => a.run());
      acts.append(b);
    }
    if (o.onClose) {
      const x = el('button', { class: 'icon-btn tl-x', type: 'button', 'aria-label': $t('Close') });
      x.innerHTML = ICON_X;
      x.addEventListener('click', () => { laneHide(o.id, true); o.onClose(); });
      acts.append(x);
    }
    box.append(markWrap, text, acts);
    box.addEventListener('keydown', (e) => { if (e.key === 'Escape' && o.onEsc) { e.stopPropagation(); o.onEsc(); } });
    lane = { id: o.id, box, o, slot: null, mode: null };
    laneMount();
    addEventListener('resize', laneMount);
    return box;
  }
  function laneMount() {
    if (!lane || run) return;
    let mode = stripMode();
    const where = mode === 'head' ? 'head' : 'stage';
    let slot = call('slot', where);
    if (!(slot && slot.nodeType === 1)) slot = document.getElementById(where === 'head' ? 'tourHeadSlot' : 'tourSlot');
    if (!slot && where === 'head') { mode = 'row'; slot = document.getElementById('tourSlot'); }
    if (!slot) return;
    if (lane.slot && lane.slot !== slot) lane.slot.hidden = true;
    if (lane.box.parentNode !== slot) slot.append(lane.box);
    slot.hidden = false;
    lane.slot = slot; lane.mode = mode; lane.box.dataset.mode = mode;
    const st = document.documentElement.style;
    if (mode === 'desk') { st.removeProperty('--ph-tour'); st.setProperty('--tour-h', (LANE_H + SLOT_GAP) + 'px'); }
    else { st.removeProperty('--tour-h'); st.setProperty('--ph-tour', (mode === 'port' ? 56 : mode === 'row' ? 48 : 0) + 'px'); lane.baseH = phTourGet(); }   // (baseH: the row's own height, which laneFit grows from)
    call('slot', where);
    laneFit();
  }
  // the line's words are never cut mid-sentence: on a desktop one line, else without its optional part (o.drop: the
  // invitation's description, an example's name), else two lines; on a phone two lines, else without the optional part
  function laneFit() {
    if (!lane) return;
    const box = lane.box, tx = box.querySelector('.tl-text');
    if (!tx) return;
    const opt = tx.querySelector(lane.o.drop === 'title' ? '.tl-title' : '.tl-body'), desk = box.dataset.mode === 'desk';
    box.classList.remove('two');
    if (opt) opt.hidden = false;
    const over = () => tx.scrollWidth > tx.clientWidth + 1 || tx.scrollHeight > tx.clientHeight + 1;
    // (a phone's lane: back to its own height first, then grown below if the line needs more)
    box.classList.remove('grow'); delete tx.dataset.lines;
    if (!desk && lane.baseH && phTourGet() !== lane.baseH) laneSetH(lane.baseH);
    if (!over()) return;
    if (opt) { opt.hidden = true; if (!over()) return; if (desk) opt.hidden = false; }
    if (desk) { box.classList.add('two'); return; }
    // (a phone's line that still needs a third line: the lane takes the lines it needs, as the tour's strip does; the lines are 17 px, the text has 7 px above and below)
    // (at most four lines, 82 px: a line that would need a fifth is cut there; example_lane_cut_cmd.js lists such lines)
    box.classList.add('grow');
    tx.style.webkitLineClamp = 'unset'; tx.style.lineClamp = 'unset';
    const full = Math.max(2, Math.ceil((tx.scrollHeight - 1) / PH_LINE));
    tx.style.webkitLineClamp = ''; tx.style.lineClamp = '';
    laneSetH(Math.max(lane.baseH || 56, Math.min(4, full) * PH_LINE + 14));
    tx.dataset.lines = String(full);
  }
  function laneSetH(px) {
    if (phTourSet(px)) call('slot', lane.mode === 'head' ? 'head' : 'stage');
  }
  function laneHide(id, anim) {
    if (!lane || (id && lane.id !== id)) return false;
    const l = lane;
    lane = null;
    removeEventListener('resize', laneMount);
    const focusWasIn = l.box.contains(document.activeElement);
    l.box.remove();
    if (l.slot && !run) l.slot.hidden = true;
    if (!run) {
      const st = document.documentElement.style;
      st.removeProperty('--tour-h'); st.removeProperty('--ph-tour');
      if (document.documentElement.getAttribute('style') === '') document.documentElement.removeAttribute('style');
      call('slot', 'stage');
    }
    if (focusWasIn) { const h = anchorEl(['helpBtn', 'moreBtn']); try { if (h) h.focus({ preventScroll: true }); } catch (e) { /* */ } }
    return true;
  }

  // ---------------------------------------------------------------- the help menu
  function openHelpMenu(anchor, only) {
    if (!doc()) return;
    if (menu) { closeMenu(true); return; }
    injectCSS();
    load();
    hideSuggest(false);
    anchor = anchor || anchorEl(['helpBtn', 'moreBtn']);
    const items = [];
    const mi = (cls, html, onClick, extra = {}) => {
      const b = el('button', Object.assign({ class: 'mi ' + (cls || ''), role: 'menuitem', type: 'button', tabindex: '-1' }, extra));
      b.innerHTML = html;
      b.addEventListener('click', () => { closeMenu(false); onClick(); });
      items.push(b);
      return b;
    };
    // (only === 'chapters': the strip's chapter menu, the chapters alone, the running one marked)
    const chaptersOnly = only === 'chapters';
    const head = el('div', { class: 'menu-head', role: 'presentation' }, chaptersOnly ? $t('Chapters') : $t('Guided tour'));
    const kids = [head];
    const resume = rec.last && CHAPTERS.find((c) => c.id === rec.last.ch);
    if (chaptersOnly) { /* the chapters follow */ } else if (resume && !(rec.last.i === 0 && rec.last.ch === 'basics')) {
      const st = resume.steps[Math.min(rec.last.i, resume.steps.length - 1)];
      kids.push(mi('tour-continue', `<span class="mi-ic">${ICON_PLAY}</span><span class="mi-label">${esc($t('Continue the tour'))}<span class="tour-sub">${esc($t(resume.title))}: ${esc(stepTitle(st))}</span></span>`,
        () => start({ chapter: resume.id, step: rec.last.i, opener: anchor })));
    } else {
      kids.push(mi('', `<span class="mi-ic">${ICON_PLAY}</span><span class="mi-label">${esc($t('Take the tour'))}</span><span class="mi-key">${esc($t('2 min'))}</span>`, () => start({ chapter: 'basics', opener: anchor })));
    }
    if (!chaptersOnly) kids.push(el('div', { class: 'msep', role: 'separator' }));
    const here = run && run.ci != null ? CHAPTERS[run.ci] : null;
    CHAPTERS.forEach((c, i) => {
      if (!chapterShown(c)) return;
      const done = chapterDone(rec, c), fresh = chapterNew(rec, c);
      const title = $t(c.title), time = $t(c.time);
      kids.push(mi('', `<span class="tour-num">${i + 1}</span><span class="mi-label">${esc(title)}${fresh ? ` <span class="tour-new">${esc($t('New'))}</span>` : ''}</span>${done ? `<span class="tour-done" aria-label="${esc($t('done'))}">${ICON_CHECK}</span>` : ''}<span class="tour-time">${esc(time)}</span>`,
        () => start({ chapter: c.id, opener: anchor }), Object.assign({ 'aria-label': `${title}, ${time}${done ? $t(', done') : ''}` }, here === c ? { 'aria-current': 'step' } : {})));
    });
    // the strip's chapter menu also holds Move on by itself, a checkbox
    if (chaptersOnly) {
      kids.push(el('div', { class: 'msep', role: 'separator' }));
      const on = rec.auto !== false;
      kids.push(mi('', `<span class="mi-ic">${on ? ICON_CHECK : ''}</span><span class="mi-label">${esc($t('Move on by itself'))}</span>`, () => setAuto(!on), { role: 'menuitemcheckbox', 'aria-checked': String(on) }));
    }
    if (!chaptersOnly) kids.push(el('div', { class: 'msep', role: 'separator' }));
    // on a touch screen there are no keys to show
    const keys = !coarse();
    if (!chaptersOnly) kids.push(mi('', `<span class="mi-ic">${ICON_BOOK}</span><span class="mi-label">${esc($t('Guide'))}</span>${keys ? '<span class="mi-key">?</span>' : ''}`, () => call('openGuide')));
    if (keys && !chaptersOnly) kids.push(mi('', `<span class="mi-ic">${ICON_KEYS}</span><span class="mi-label">${esc($t('Keyboard shortcuts'))}</span>`, () => call('openGuide', 'keys')));
    const pop = el('div', { class: 'pop menu tour-menu', role: 'menu', 'aria-label': $t('Help'), 'data-tour': 'menu' }, ...kids);
    const host = document.getElementById('popHost') || document.body;
    host.append(pop);
    // below the anchor, right-aligned to it, kept on screen. On a phone the help button sits in the ⋯ menu, which
    // closes on the click: after a frame the menu re-measures and hangs under whatever is visible (⋯)
    const position = () => {
      const a = anchor && visible(anchor) ? anchor : anchorEl(['helpBtn', 'moreBtn']);
      const b = a ? a.getBoundingClientRect() : { left: innerWidth - 12, right: innerWidth - 12, bottom: 48, top: 48 };
      const w = pop.offsetWidth, hgt = pop.offsetHeight;
      const left = Math.max(12, Math.min(innerWidth - w - 12, b.right - w));
      let top = b.bottom + 6;
      if (top + hgt > innerHeight - 12) top = Math.max(12, b.top - 6 - hgt);
      pop.style.left = left + 'px'; pop.style.top = top + 'px';
    };
    position();
    requestAnimationFrame(() => { if (menu && menu.pop === pop) position(); });
    if (anchor) anchor.setAttribute('aria-expanded', 'true');
    const onKey = (e) => {
      const i = items.indexOf(document.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); }
      else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); const j = (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; items[i < 0 ? 0 : j].focus(); }
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1].focus(); }
      else if (e.key === 'Tab') { e.preventDefault(); closeMenu(true); }
    };
    const onDown = (e) => { if (!pop.contains(e.target) && !(anchor && anchor.contains(e.target))) closeMenu(false); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('pointerdown', onDown, true);
    menu = { pop, anchor, off: () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('pointerdown', onDown, true); } };
    items[0].focus({ preventScroll: true });
    return pop;
  }
  function closeMenu(refocus) {
    if (!menu) return;
    const m = menu; menu = null;
    m.off(); m.pop.remove();
    if (m.anchor) { m.anchor.setAttribute('aria-expanded', 'false'); if (refocus) try { m.anchor.focus({ preventScroll: true }); } catch (e) { /* */ } }
  }
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ---------------------------------------------------------------- public
  function init(a) {
    api = a || {};
    inited = true;
    load();
    // a tour that was running and is not running in another page (its heartbeat is stale or gone): cut short
    cutShort = !run && rec.open && !liveElsewhere();
    if (cutShort) { rec.open = false; save(); }
    // a tour running in this page holds the stash: a second init only swaps in its adapter
    if (!run) recoverStash();
    return Tour;
  }
  // A tour cut short by a reload or a crash: put the user's work back before anything else. Another page's live tour
  // (its heartbeat is fresh) keeps its stash; the stash goes only once restore() has taken it.
  // A fresh heartbeat of another page: that page may still be touring (another tab), or it just went away without
  // saying so (a crash); look again once its heartbeat would be stale, never give up for the session.
  // A backup written while the app's autosave was paused (paused, with the saved copy's fingerprint, mark) holds
  // nothing the saved copy lacks: the saved copy is that work, or newer work saved since (after a reload, or in
  // another tab). Such a backup is dropped, never restored over the saved copy.
  function recoverStash() {
    clearTimeout(recheckT); recheckT = 0;
    if (run) return;
    let raw = null;
    try { raw = localStorage.getItem(sk(STASH)); } catch (e) { warn('storage', e); return; }
    if (!raw) return;
    try {
      const live = JSON.parse(localStorage.getItem(sk(LIVE)) || 'null');
      if (live && live.page !== PAGE && Date.now() - live.t < BEAT_STALE) {
        recheckT = setTimeout(recoverStash, Math.max(500, BEAT_STALE - (Date.now() - live.t) + 250));
        return;
      }
    } catch (e) { /* malformed heartbeat: recover */ }
    let st;
    try { st = JSON.parse(raw); } catch (e) { warn('stash', e); dropStash(); return; }
    if (st && typeof st === 'object' && st.page === PAGE) return;   // this page's own (a restore that failed): kept
    const snap = st && typeof st === 'object' && 'page' in st && 'snap' in st ? st.snap : st;
    if (snap == null) { dropStash(); return; }
    if (st && st.paused === true && st.mark != null && fn('savedMark')) {
      let now = null;
      try { now = api.savedMark(); } catch (e) { now = null; }
      if (now != null) { dropStash(); return; }
    }
    if (!fn('restore')) return;
    let ok = false;
    try { ok = api.restore(snap, { fromStash: true }) !== false; } catch (e) { warn('restore', e); ok = false; }
    if (ok) dropStash();
  }
  function skippedList() { const w = run ? run.why : lastWhy; return w ? [...w].map(([id, why]) => ({ id, why })) : []; }
  // forget the record (a "Show the tour suggestion again" command); a backup of the user's work is never dropped here
  function reset() { rec = normRec(null); save(); }

  const Tour = {
    VERSION, init, start, stop: (o) => Promise.resolve(stop(o || {})), next: () => go(1), back: () => go(-1),
    suggest, dismissSuggestion: () => hideSuggest(false), openHelpMenu,
    // (the control a start that the user asks for names as its opener, where the focus goes back to when the tour ends: the one that has the focus, the control a
    // palette or a guide has handed it back to as it closed, else Help, or the phone's More)
    asker: () => { const a = document.activeElement; return a && a !== document.body && a.isConnected && !a.closest('[role=menu]') ? a : anchorEl(['helpBtn', 'moreBtn']); },
    // (for tests) the line that continues a tour cut short, at once: -> whether it is shown
    offerContinue: () => { load(); if (run || sugg) return false; return showContinue(); },
    // the learning lane: one closable line in the tour's docked slot (an example's Try line)
    lane: (o) => !!laneShow(o || {}), laneHide: (id) => laneHide(id || null, false), laneId: () => (lane ? lane.id : null), closeHelpMenu: () => closeMenu(false),
    isSeen: () => seenRec(load()), isActive: () => !!run, reset,
    chapters: () => CHAPTERS.map((c) => ({ id: c.id, title: c.title, time: c.time, steps: c.steps.length, done: chapterDone(rec, c) })),
    current: () => (run ? { chapter: CHAPTERS[run.ci].id, step: run.si, id: CHAPTERS[run.ci].steps[run.si].id } : null),
    // the spotlight's geometry, for the browser checks: the lit areas (padded, in px), the anchor's own box, and
    // the strip's box, the phone's sheet, the countdown { left (ms), held: [kinds], state }, and the step's explanation as
    // plain text (body: the copy the strip does not show; the tests read what the steps say from it)
    lit: () => {
      if (!(run && run.ui && run.ui.holes)) return null;
      const ui = run.ui, a = run.el && run.el.isConnected ? run.el.getBoundingClientRect() : null, sb = ui.strip.getBoundingClientRect();
      const c = run.cd || cdInit();
      return { holes: ui.holes.map((h) => ({ l: h.l, t: h.t, r: h.r, b: h.b })), anchor: a ? { l: a.left, t: a.top, r: a.right, b: a.bottom } : null, scenes: run.scenes, scene: run.scene == null ? null : run.scene,
        strip: { l: sb.left, t: sb.top, r: sb.right, b: sb.bottom }, mode: ui.mode, why: !!ui.whyOpen, whyPanel: !!ui.whyPanel, done: !!run.done, quiet: !!ui.quiet, lines: ui.lines || 2, hint: run.hint || null,
        countdown: { left: cdLeft(c, performance.now()), held: c.holds.slice(), state: c.phase === 'fired' ? 'running' : c.phase },
        body: run.step ? plainCopy(copyFor(run.step, run.scene, { menu: run.inMenu }), modKey()) : '',
        work: (ui.work || []).map((h) => ({ l: h.l, t: h.t, r: h.r, b: h.b })), hosted: ui.hosts.size, layers: appLayers().length, moving: !!ui.anim || ui.strip.getAttribute('aria-busy') === 'true', skipped: skippedList() };
    },
    // Move on by itself: read, or set (true or false)
    auto: (on) => { if (on === true || on === false) return setAuto(on); load(); return rec.auto !== false; },
    // the steps the running (else the last) tour skipped: [{ id: 'chapter/step', why: 'missing' | 'clipped' | 'scene' }]
    skipped: skippedList,
    // internals for the tests and the design tables
    _t: { cutShort: () => cutShort, CHAPTERS, PLANES, PLAYING, SCENES, ANCHORS, LOOK, parseCopy, texPlain, plainCopy, rrPath, litAreas, ms, normRec, seenRec, shouldSuggest, chapterDone, chapterNew, seek, absent, sceneAt, pickScene, copyFor, tryFor, leadFor, chapterShown, harpUpDown, countdown, cdLeft, cdInit, CD_MS, SUGGEST_MAX, KEY, STASH, LIVE, clippedAway,
      // (the lines the running chapter's strip line needs here, for the browser checks)
      needLines: (dbg) => (run ? needLines(run, dbg) : null) },
  };
  return Tour;
