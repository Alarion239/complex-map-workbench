// The engine-independent spotlight probe of the v16.2 audit (test/tour_audit_cmd.js of v16.2, its PROBE: targets(),
// paths(), spot(), ringsOff()), for the r3 strip: the strip is a window of the shade like a hosting panel's, a step whose
// task waits for an earlier one (try.after) is read, and the controls table follows the r3 steps. Read by
// test/tour_audit_cmd.js (eval of this file's text).
const SPOT = String.raw`(() => {
  const vis = (e) => { if (!e || !e.isConnected) return false; if (e.checkVisibility && !e.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) return false; const r = e.getBoundingClientRect(); return r.width > 1 && r.height > 1; };
  const T = () => Tour._t;
  // a name of the Anchors table -> what the tour lights: an element, a list of elements (composite) or { el, rect }.
  // A candidate that a panel which cannot scroll cuts to (almost) nothing is passed over, as INTEGRATION.md says
  // (the next name of the list is lit, or the step is skipped)
  const away = (e) => {
    const r = e.getBoundingClientRect(); let l = r.left, t = r.top, rr = r.right, b = r.bottom;
    let fx = getComputedStyle(e).position === 'fixed';
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      if (fx) break;
      const cs = getComputedStyle(a);
      fx = cs.position === 'fixed';
      if (!/(hidden|clip)/.test(cs.overflowX + cs.overflowY) || cs.display === 'contents') continue;
      const q = a.getBoundingClientRect(); if (q.width === 0 && q.height === 0) continue;
      l = Math.max(l, q.left); t = Math.max(t, q.top); rr = Math.min(rr, q.right); b = Math.min(b, q.bottom);
    }
    return rr - l < 2 || b - t < 2;
  };
  function resolve(names) {
    for (const n of [].concat(names)) {
      let e;
      try { e = window.__tourApi && __tourApi.anchor ? __tourApi.anchor(n) : undefined; } catch (x) { e = undefined; }
      const A = T().ANCHORS;
      if (e === undefined && A[n]) { try { e = typeof A[n] === 'function' ? A[n]() : document.querySelector(A[n]); } catch (x) { e = null; } }
      if (Array.isArray(e)) { const v = e.filter(vis).filter((x) => !away(x)); if (v.length) return v; continue; }
      if (e && e.el && e.rect) { if (vis(e.el) && !away(e.el)) return e; continue; }
      if (vis(e) && !away(e)) return e;
    }
    return null;
  }
  // the visible part of a box: cut by every clipping ancestor and by the viewport
  function seen(e, box) {
    const r = box || e.getBoundingClientRect();
    let l = r.left, t = r.top, rr = r.right, b = r.bottom, tooBig = false;
    // (a fixed box, a phone's tool row or sheet, is not clipped by the ancestors above it)
    let fx = getComputedStyle(e).position === 'fixed';
    for (let a = e.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      if (fx) break;
      const cs = getComputedStyle(a);
      fx = cs.position === 'fixed';
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      if (cs.display === 'contents') continue;
      const q = a.getBoundingClientRect();
      if (q.width === 0 && q.height === 0) continue;
      // past the edge of a panel that cannot scroll that way (or wider than it): the app's layout, no scroll can show it whole
      const canX = /(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth, canY = /(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight;
      const outX = r.left < q.left - 0.5 || r.right > q.right + 0.5, outY = r.top < q.top - 0.5 || r.bottom > q.bottom + 0.5;
      if ((outX && (!canX || r.right - r.left > a.clientWidth + 1)) || (outY && (!canY || r.bottom - r.top > a.clientHeight + 1))) tooBig = true;
      l = Math.max(l, q.left); t = Math.max(t, q.top); rr = Math.min(rr, q.right); b = Math.min(b, q.bottom);
    }
    const full = { l: r.left, t: r.top, r: r.right, b: r.bottom };
    l = Math.max(l, 0); t = Math.max(t, 0); rr = Math.min(rr, innerWidth); b = Math.min(b, innerHeight);
    const s = { l, t, r: Math.max(l, rr), b: Math.max(t, b) };
    const cut = Math.abs(s.l - full.l) > 0.5 || Math.abs(s.t - full.t) > 0.5 || Math.abs(s.r - full.r) > 0.5 || Math.abs(s.b - full.b) > 0.5;
    return { s, full, cut, tooBig };
  }
  // under an open layer that does not hold it: the topmost element at its centre, the tour aside, is in that layer
  const underLay = (e) => {
    const L = [...document.querySelectorAll('#popHost > *, .modal-bg > *, .snd-pop:not([hidden]), dialog[open], .ph-sheet:not([hidden]), :popover-open')].filter((k) => !k.contains(e));
    if (!L.length) return false;
    const b = e.getBoundingClientRect(), hit = document.elementsFromPoint((b.left + b.right) / 2, (b.top + b.bottom) / 2).find((h) => !h.closest('[data-tour]'));
    return !!hit && L.some((k) => k.contains(hit));
  };
  // (r3 review fix pass) what shows of a lit part beside the anchor that an open layer of the app covers along one whole
  // side (X under the left drawer at 768-1023 px): the part up to the layer's edge, its corners there square. Not on a
  // phone (its sheets hold the spotlight). The layers as the app lists them (the left drawer included)
  const sideCut = (e, t) => {
    if (!(e instanceof Element) || document.documentElement.classList.contains('ph')) return;
    let L = []; try { L = [...((window.__tourApi && __tourApi.layers && __tourApi.layers()) || [])]; } catch (x) { L = []; }
    for (const k of L) {
      if (!k || k === e || k.contains(e) || e.contains(k) || !vis(k)) continue;
      const b = k.getBoundingClientRect(), q = t.s;
      if (b.right <= q.l + 0.5 || b.left >= q.r - 0.5 || b.bottom <= q.t + 0.5 || b.top >= q.b - 0.5) continue;
      const spanV = b.top <= q.t + 0.5 && b.bottom >= q.b - 0.5, spanH = b.left <= q.l + 0.5 && b.right >= q.r - 0.5;
      if (spanV && b.left <= q.l + 0.5 && b.right < q.r - 1) q.l = b.right;
      else if (spanV && b.right >= q.r - 0.5 && b.left > q.l + 1) q.r = b.left;
      else if (spanH && b.top <= q.t + 0.5 && b.bottom < q.b - 1) q.t = b.bottom;
      else if (spanH && b.bottom >= q.b - 0.5 && b.top > q.t + 1) q.b = b.top;
      else continue;
      t.layerCut = true;   // (the corners on the cut side are square; the others keep the part's radius)
    }
  };
  const radiusOf = (e) => { if (!(e instanceof HTMLElement)) return 0; const v = parseFloat(getComputedStyle(e).borderTopLeftRadius); return Number.isFinite(v) ? v : 0; };
  // the targets of the current step: [{ name, s, full, cut, rad }]
  function targets() {
    const c = Tour.current(); if (!c) return null;
    const ch = T().CHAPTERS.find((x) => x.id === c.chapter), st = ch.steps[c.step];
    if (st.anchor == null) return [];
    const out = [];
    const add = (name, v) => {
      if (!v) return;
      for (const x of [].concat(v)) {
        if (x && x.el && x.rect) { const q = typeof x.rect === 'function' ? x.rect() : x.rect; const b = x.el.getBoundingClientRect(); const box = q.left != null ? q : { left: b.left + q.x, top: b.top + q.y, right: b.left + q.x + q.w, bottom: b.top + q.y + q.h }; out.push(Object.assign({ name, rad: 0 }, seen(x.el, box))); }
        else out.push(Object.assign({ name, rad: radiusOf(x) }, seen(x)));
      }
    };
    const a = resolve(st.anchor);
    add('anchor', a);
    // (v16.1: a Try it's control in the anchor's own scrolling panel, both too tall for it together: the control shows
    // whole and the anchor from its top, so the anchor's cut is not a failure)
    const scr = (e) => { for (let p = e && e.parentElement; p && p !== document.body; p = p.parentElement) { const cs = getComputedStyle(p); if (/(auto|scroll)/.test(cs.overflowY) && p.scrollHeight > p.clientHeight + 1) return p; } return null; };
    const trc = st.try && !(st.tryWide && innerWidth < 640) && !st.try.after && st.try.ctl ? [].concat(st.try.ctl) : [];
    if (a instanceof Element && out[0]) for (const n of trc) {
      const e = resolve(n), sc = scr(a);
      if (!(e instanceof Element) || !sc || scr(e) !== sc) continue;
      const ra = a.getBoundingClientRect(), re = e.getBoundingClientRect();
      if (Math.max(ra.bottom, re.bottom) - Math.min(ra.top, re.top) > sc.clientHeight - 16) out[0].yield = true;
    }
    // (a second lit area that the app itself covers, the chain under the Inspector in a short desktop window, is not
    // expected: at its centre and four inner points the topmost element, the tour and the open layers aside, is another)
    const LAY = [...document.querySelectorAll('#popHost > *, .modal-bg > *, .snd-pop:not([hidden]), dialog[open], .ph-sheet:not([hidden]), :popover-open')];
    const covered = (e) => {
      if (!(e instanceof Element)) return false;
      const b = e.getBoundingClientRect(); let n = 0;
      for (const [fx, fy] of [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        const x = b.left + fx * b.width, y = b.top + fy * b.height;
        if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
        const hit = document.elementsFromPoint(x, y).find((h) => !h.closest('[data-tour]') && !LAY.some((k) => k !== e && !k.contains(e) && k.contains(h)));
        n++;
        if (!hit || hit === e || e.contains(hit) || hit.contains(e)) return false;
      }
      return n > 0;
    };
    // (v15.1, review-phone phone-2: on a touch screen the parts a Try it's touch task names, try.work, are lit too: the
    // lens in the Inspector once the card is tapped)
    const tr = st.try && !(st.tryWide && innerWidth < 640) && !st.try.after ? st.try : null;
    const tw = tr && tr.work && tr.touch && matchMedia('(pointer: coarse)').matches ? tr.work : [];
    // (v16.1, user 5: the controls a Try it names, try.ctl, are lit while it shows)
    // (one under an open layer it is not in, a phone's tool row under the Editor sheet, is not: it cannot be reached)
    const tc = tr && tr.ctl ? [].concat(tr.ctl) : [];
    for (const n of [].concat(st.also || [], tc, tw)) { const e = resolve(n); if (e && e !== a && !covered(e) && !(tc.includes(n) && e instanceof Element && underLay(e))) { const k0 = out.length; add(n, e); for (let i = k0; i < out.length; i++) sideCut(e, out[i]); } }
    return out;
  }
  // the drawn holes (the shade's sub-paths after the first) and the inner mark: bounding boxes and arc radii
  // (v15.1, a phone: a lit part inside a scrolling panel is drawn by an SVG inside that panel, svg.tour-host, and the
  // shade over the page has a window over the panel's visible box: every path counts, and a window is no lit area)
  function paths(sel, skipFirst) {
    const out = [];
    for (const p of document.querySelectorAll(sel)) pathsOf(p, skipFirst, out);
    if (!/tour-shade/.test(sel)) return out;
    const wins = [...document.querySelectorAll('svg.tour-host')].map((s) => { const H = s.parentElement, b = H.getBoundingClientRect(), l = b.left + H.clientLeft, t = b.top + H.clientTop; return { l: Math.max(0, l), t: Math.max(0, t), r: Math.min(innerWidth, l + H.clientWidth), b: Math.min(innerHeight, t + H.clientHeight) }; });
    // (r3: the strip is a window of the shade, with no ring)
    const sw = document.querySelector('.tour-strip');
    if (sw && sw.getClientRects().length) { const b = sw.getBoundingClientRect(); wins.push({ l: Math.max(0, b.left), t: Math.max(0, b.top), r: Math.min(innerWidth, b.right), b: Math.min(innerHeight, b.bottom) }); }
    return out.filter((h) => !wins.some((w) => h.l >= w.l - 1 && h.t >= w.t - 1 && h.r <= w.r + 1 && h.b <= w.b + 1 && (h.r - h.l) * (h.b - h.t) >= 0.9 * (w.r - w.l) * (w.b - w.t)));
  }
  function pathsOf(p, skipFirst, out) {
    const d = p.getAttribute('d') || '';
    // user units -> client px (a viewBox that differs from the SVG's box, a transform)
    const svg = p.ownerSVGElement, M = (svg && svg.getScreenCTM && svg.getScreenCTM()) || { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
    const X = (x, y) => M.a * x + M.c * y + M.e, Y = (x, y) => M.b * x + M.d * y + M.f;
    const subs = d.split(/(?=M)/).filter((s) => s.trim());
    for (const sub of subs.slice(skipFirst ? 1 : 0)) {
      const toks = sub.match(/[MHVAZLC]|-?[\d.]+(?:e-?\d+)?/gi) || [];
      let i = 0, x = 0, y = 0, l = Infinity, t = Infinity, r = -Infinity, b = -Infinity, rad = 0, cmd = '';
      const num = () => parseFloat(toks[i++]);
      const pt = () => { l = Math.min(l, x); r = Math.max(r, x); t = Math.min(t, y); b = Math.max(b, y); };
      while (i < toks.length) {
        if (/[A-Za-z]/.test(toks[i])) cmd = toks[i++];
        if (cmd === 'M' || cmd === 'L') { x = num(); y = num(); pt(); }
        else if (cmd === 'H') { x = num(); pt(); }
        else if (cmd === 'V') { y = num(); pt(); }
        else if (cmd === 'A') { const rx = num(); num(); num(); num(); num(); x = num(); y = num(); rad = Math.max(rad, rx); pt(); }
        else if (cmd === 'Z' || cmd === 'z') { /* */ }
        else i++;
      }
      // (a path drawn inside a panel, v15.1, is clipped by the panel: what shows is its part inside the panel's box)
      const host = !!(svg && svg.classList.contains('tour-host'));
      let q = { l: X(l, t), t: Y(l, t), r: X(r, b), b: Y(r, b) };
      if (host && !skipFirst) { /* rings and marks: as drawn */ }
      else if (host) { const H = svg.parentElement, hb = H.getBoundingClientRect(), hl = hb.left + H.clientLeft, ht = hb.top + H.clientTop; q = { l: Math.max(q.l, hl), t: Math.max(q.t, ht), r: Math.min(q.r, hl + H.clientWidth), b: Math.min(q.b, ht + H.clientHeight) }; }
      if (Number.isFinite(l)) out.push({ l: q.l, t: q.t, r: q.r, b: q.b, rad: rad * Math.abs(M.a), zero: q.r - q.l < 0.5 || q.b - q.t < 0.5, host });
    }
    return out;
  }
  const diff = (a, b) => Math.max(Math.abs(a.l - b.l), Math.abs(a.t - b.t), Math.abs(a.r - b.r), Math.abs(a.b - b.b));
  function spot() {
    const tg = targets(); if (tg == null) return null;
    const holes = paths('.tour-shade', true), marks = paths('.tour-mark', false);
    const res = [];
    const U = tg.reduce((u, t) => ({ l: Math.min(u.l, t.full.l), t: Math.min(u.t, t.full.t), r: Math.max(u.r, t.full.r), b: Math.max(u.b, t.full.b) }), { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
    const allFit = (U.r - U.l) <= innerWidth && (U.b - U.t) <= innerHeight * 0.55;
    for (const t of tg) {
      // the anchor shown with (almost) nothing of it on screen: the engine should have skipped the step
      if (t.name === 'anchor' && (t.s.r - t.s.l < 2 || t.s.b - t.s.t < 2)) { res.push({ name: t.name, d: 0, radD: 0, cut: false, box: [t.s.l, t.s.t, t.s.r, t.s.b].map(Math.round), hole: null, hiddenAnchor: true }); continue; }
      if (t.name !== 'anchor' && (t.s.r - t.s.l < 0.5 || t.s.b - t.s.t < 0.5)) { res.push({ name: t.name, d: 0, radD: 0, cut: t.name !== 'anchor' && allFit, box: [t.s.l, t.s.t, t.s.r, t.s.b].map(Math.round), hole: null, hidden: true }); continue; }
      let best = null;
      for (const h of holes.concat(marks)) { const d = diff(h, t.s); if (!best || d < best.d) best = { d, h }; }
      // (two lit areas that overlap a little are trimmed apart at the middle of their overlap, so an even-odd shade does
      // not dim it again: a hole that is this target less a strip that another lit target covers matches it)
      if (best && best.d > 1) for (const h of holes) {
        const e4 = [Math.abs(h.l - t.s.l), Math.abs(h.t - t.s.t), Math.abs(h.r - t.s.r), Math.abs(h.b - t.s.b)];
        if (e4.filter((x) => x <= 1).length < 3 || h.l < t.s.l - 1 || h.t < t.s.t - 1 || h.r > t.s.r + 1 || h.b > t.s.b + 1) continue;
        const strip = { l: e4[0] > 1 ? t.s.l : e4[2] > 1 ? h.r : t.s.l, t: e4[1] > 1 ? t.s.t : e4[3] > 1 ? h.b : t.s.t, r: e4[2] > 1 ? t.s.r : e4[0] > 1 ? h.l : t.s.r, b: e4[3] > 1 ? t.s.b : e4[1] > 1 ? h.t : t.s.b };
        // (another lit target spans the strip across the trimmed side and overlaps it along it)
        const vert = e4[1] > 1 || e4[3] > 1;
        const other = tg.some((o) => o !== t && (vert ? o.s.t <= strip.t + 1 && o.s.b >= strip.b - 1 && Math.min(o.s.r, strip.r) - Math.max(o.s.l, strip.l) > 0.5
          : o.s.l <= strip.l + 1 && o.s.r >= strip.r - 1 && Math.min(o.s.b, strip.b) - Math.max(o.s.t, strip.t) > 0.5));
        if (other) { best = { d: 0, h, trimmed: true }; break; }
      }
      const radD = best && !t.cut ? Math.abs(best.h.rad - Math.min(t.rad, (t.s.r - t.s.l) / 2, (t.s.b - t.s.t) / 2)) : 0;
      // a target that could be shown whole but is cut (off-screen, or by a scrolled panel)
      // (on a phone the callout takes the lower part of the screen: the band left for the lit areas is about 55 %)
      const fits = t.name === 'anchor' ? (t.full.r - t.full.l) <= innerWidth && (t.full.b - t.full.t) <= innerHeight * (innerWidth < 640 ? 0.5 : 0.92) : allFit;
      res.push({ name: t.name, d: best ? +best.d.toFixed(2) : 999, radD: +radD.toFixed(2), cut: t.cut && fits && !t.tooBig && !t.yield, yield: !!t.yield, appOverflow: t.cut && t.tooBig, box: [t.s.l, t.s.t, t.s.r, t.s.b].map(Math.round), hole: best && [best.h.l, best.h.t, best.h.r, best.h.b].map(Math.round) });
    }
    // every drawn hole is explained by the lit elements: it is one of them, or the union of those it overlaps (a panel
    // and the anchor in it), or a part of one (two areas that touch are trimmed apart); and none has zero area
    const vis2 = tg.filter((t) => t.s.r - t.s.l >= 0.5 && t.s.b - t.s.t >= 0.5);
    const extra = [], zero = [];
    for (const h of holes) {
      if (h.zero) { zero.push([h.l, h.t, h.r, h.b].map(Math.round)); continue; }
      const ov = vis2.filter((t) => Math.min(t.s.r, h.r) - Math.max(t.s.l, h.l) > 0.5 && Math.min(t.s.b, h.b) - Math.max(t.s.t, h.t) > 0.5);
      if (!ov.length) { extra.push([h.l, h.t, h.r, h.b].map(Math.round)); continue; }
      const U2 = ov.reduce((u, t) => ({ l: Math.min(u.l, t.s.l), t: Math.min(u.t, t.s.t), r: Math.max(u.r, t.s.r), b: Math.max(u.b, t.s.b) }), { l: Infinity, t: Infinity, r: -Infinity, b: -Infinity });
      const inOne = ov.some((t) => h.l >= t.s.l - 1 && h.t >= t.s.t - 1 && h.r <= t.s.r + 1 && h.b <= t.s.b + 1 && [Math.abs(h.l - t.s.l), Math.abs(h.t - t.s.t), Math.abs(h.r - t.s.r), Math.abs(h.b - t.s.b)].filter((x) => x <= 1).length >= 3);
      if (diff(h, U2) > 1 && !inOne && !ov.some((t) => diff(h, t.s) <= 1)) extra.push([h.l, h.t, h.r, h.b].map(Math.round));
    }
    if (extra.length || zero.length) res.push({ name: 'holes', d: 0, radD: 0, cut: false, extra, zero });
    return res;
  }
  const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
  // the rings are masked off a layer: the mask's cut-outs (client px) cover its box, or no ring comes near it
  function ringsOff(L) {
    const b = L.getBoundingClientRect();
    const cuts = paths('.tour-rings mask path', false);
    const covered = cuts.some((h) => h.l <= b.left + 1 && h.t <= b.top + 1 && h.r >= b.right - 1 && h.b >= b.bottom - 1);
    if (covered) return true;
    // (a ring drawn inside a panel of the app, v15.1, is painted under a layer that covers it: what shows there is the layer)
    const under = (h) => { if (!h.host) return false; const x = Math.max(b.left + 1, Math.min(b.right - 1, (h.l + h.r) / 2)), y = Math.max(b.top + 1, Math.min(b.bottom - 1, (h.t + h.b) / 2)); const e = document.elementFromPoint(x, y); return !!e && L.contains(e); };
    const rings = paths('.tour-glow', false).concat(paths('.tour-ring', false), paths('.tour-mark', false)).filter((h) => !under(h));
    return !rings.some((h) => h.l < b.right && h.r > b.left && h.t < b.bottom && h.b > b.top);
  }

  // the control that completes each step's task, by step, written from the app's markup (not from the tour's anchors):
  // it must be lit, its visible box a drawn hole or ring within 1 px. A task step missing here fails (ctlMissing).
  // 'none': no lit control by design (the act button is in the strip; a step read here)
  const q1 = (sel) => [...document.querySelectorAll(sel)].find(vis) || null;
  const ph = () => document.documentElement.classList.contains('ph');
  const coarseNow = () => matchMedia('(pointer: coarse)').matches;
  // (r3 review fix pass: a control is one the user can reach: on top at its centre, the tour's own layers aside. A
  // landscape phone's tool row sits under the chain bar, its tools in a sheet; there the Select tool the step has
  // already chosen is no task's control)
  const onTop = (e) => { const b = e.getBoundingClientRect(), x = (b.left + b.right) / 2, y = (b.top + b.bottom) / 2; if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false; const hit = document.elementsFromPoint(x, y).find((h) => !h.closest('[data-tour]')); return !!hit && (hit === e || e.contains(hit)); };
  const q1top = (sel) => [...document.querySelectorAll(sel)].find((e) => vis(e) && onTop(e)) || null;
  const tool = (id) => q1('.ph-sheet:not([hidden]) .ph-tile[data-tool="' + id + '"]') || q1top('#tools > .tool[data-tool="' + id + '"], #constructTools > .tool[data-tool="' + id + '"]') || q1('#railTools > .tool[data-tool="' + id + '"]') || (ph() && !['select', 'point', 'disc', 'polygon'].includes(id) ? q1('#toolMore > summary') : null);
  const selTool = () => { const e = tool('select'); return e ? (underLay(e) ? 'none' : e) : ph() ? 'none' : null; };
  const lab = (sel) => { const c = q1(sel); return c ? c.closest('label') || c : null; };
  const CTL = {
    'basics/x': () => selTool(), 'basics/preimages': () => 'none', 'basics/draw': () => tool('disc'),
    // (#34's task lines: Y is panned with Select on, Targets draws a Disc, the F tile and the card d/dz are in the chain sheet on a phone, Cauchy's circle is dragged with Select)
    'basics/y': () => selTool(), 'analysis/targets': () => tool('disc'), 'analysis/domain': () => q1('#pipeline .ftile') || q1('.ph-csteps'),
    'branches/deriv': () => q1('#pipeline .card[data-k="2"]') || q1('.ph-csteps'), 'analysis/cauchy': () => selTool(),
    'basics/shapes': () => (innerWidth < 640 ? 'none' : selTool()), 'basics/formula': () => 'none',
    // (#246: on a phone the card and the Add tile are rows of the chain sheet; while it is closed, the step lights the
    // chain bar's "N steps ▾" that opens it)
    'basics/chain': () => q1('#pipeline .card[data-k="1"]') || q1('.ph-csteps'), 'basics/add': () => q1('#addStepBtn') || q1('.ph-csteps'),
    'views/switch': () => q1('#viewSwitch > [data-mode="phase"]'), 'views/phase': () => q1('#panes'), 'views/land': () => 'none', 'views/sphere': () => q1('#panes'), 'views/key': () => lab('#wKeyChkR') || q1('#rightFoot .opts-btn:not(.pat-btn)') || q1('#rightFoot .pat-btn'),
    'views/patterns': () => q1('#patternSeg .pat[data-pat="stretch"]'),
    'edit/cards': () => q1('#viewSwitch > [data-mode="land"]'), 'edit/split': () => q1('#propsPanel .split-offer .so-btn'), 'edit/zp': () => selTool(),
    'edit/numbers': () => q1('#propsPanel .prm-row input[type="range"]'),
    // (D1, issue #23: Replace… is the first item of the step's ⋯)
    'edit/inspector': () => q1('#propsPanel .insp-step .ihead .more'),
    'construct/c3': () => 'none', 'construct/follow': () => selTool(), 'construct/meet': () => tool('line'),
    'deform/toggle': () => 'none', 'deform/transport': () => [q1('#morphPlay'), q1('#morphRange')], 'deform/paths': () => 'none', 'deform/order': () => q1('#homOrderSel'),
    'deform/range': () => 'none', 'analysis/integral': () => 'none',
    'branches/cut': () => selTool(), 'branches/inverse': () => q1('#propsPanel .insp-step .ihead .more'), 'branches/sheets': () => q1('#panes'),
    'sound/song': () => 'none', 'sound/strings': () => 'none', 'sound/loop': () => 'none',
    'export/formula-tex': () => q1('#propsPanel .insp-F .ihead button[aria-label]'), 'keys/palette': () => 'none',
  };
  function ctl() {
    const c = Tour.current(); if (!c) return null;
    const id = c.chapter + '/' + c.id, st = T().CHAPTERS.find((x) => x.id === c.chapter).steps[c.step];
    const tr = st.try && !(st.tryWide && innerWidth < 640) && !st.try.after ? st.try : null;
    const out = { id, kinds: [] };
    if (!tr) return out;
    if (!(id in CTL)) { out.kinds.push('ctlMissing'); return out; }
    const want = [].concat(CTL[id]());
    if (want[0] === 'none') return out;
    const holes = paths('.tour-shade', true).concat(paths('.tour-mark', false));
    out.ctl = want.map((e) => {
      if (!e) return { none: true };
      const b = seen(e).s;
      let d = 999;
      for (const x of holes) d = Math.min(d, diff(x, b));
      return { el: (e.id ? '#' + e.id : e.tagName.toLowerCase() + '.' + String(e.className).split(' ')[0]), box: [b.l, b.t, b.r, b.b].map(Math.round), d: +d.toFixed(2) };
    });
    if (out.ctl.some((x) => x.none)) out.kinds.push('ctlNone');
    if (out.ctl.some((x) => !x.none && x.d > 1)) out.kinds.push('ctlNotLit');
    return out;
  }
  return { resolve, targets, spot, paths, seen, frame, vis, ringsOff, ctl };
})()`;
