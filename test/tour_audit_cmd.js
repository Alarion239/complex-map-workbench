// Audit of the guided tour's geometry (notes/tour/POLISH.md): every chapter and step at every width, theme, language
// and input. For each step it records the spotlight against its targets (each lit element's visible border box must
// match a drawn hole or the inner mark within 1 px, with the element's corner radius), whether the callout is inside
// the viewport, each button's size, spacing and whether it lies in the callout, text overflow in the callout, and the
// topmost element at the callout's centre and corners. A "layers" pass opens the palette, the Examples menu, the More
// menu, the export dialog and a tooltip during a step: the callout must stay on top and must not cover the layer. A
// "follow" pass scrolls, resizes and changes the layout during a step: the spotlight must follow in the next frame.
// Run with a copy of test/cdp_kit (dist/test.html served on its port): test/<you>_cdp/q.sh test/tour_audit_cmd.js.
// A subset: prepend `const AUDIT_CFG = { widths: [390], themes: ['light'], langs: ['ru'], inputs: ['touch'],
// tag: 'x', shotsPerKind: 3, layers: true, follow: true, steps: true };` to a copy of this file.
// Rows go to <kit>/audit/<tag>.json, screenshots of failing cases to <kit>/shots/audit-<tag>/.
// Since the polish review (notes/tour/review-polish.json): the drawn paths are mapped to the screen (getScreenCTM); a
// hole that matches no lit element, a zero-area hole and an anchor clipped away fail; text that overflows vertically
// fails; settle() no longer trusts the engine's own flags; every step that should show here must be visited (a step the
// engine skipped fails, with its reason from Tour.skipped()); landscape and zoomed sizes run too (844 x 390, 720 x 450
// = 200 % of 1440 x 900, 1152 x 720); the layer pass also opens a toast, the sound settings, the reference guide and
// the Language menu, checks that the rings are masked off each layer, and (layerAll) runs the palette and a toast on
// every step at one phone, one tablet and one desktop size.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const CFG = Object.assign({ widths: [360, 390, 430, 720, 768, 844, 1024, 1152, 1280, 1440], themes: ['light', 'dark'], langs: ['en', 'ru'], inputs: ['mouse', 'touch'],
  tag: 'audit', shotsPerKind: Infinity, layers: true, follow: true, steps: true, focus: true, safe: true, page: 'test.html', layerAll: [390, 768, 1440] }, typeof AUDIT_CFG !== 'undefined' ? AUDIT_CFG : {});
const U = `http://localhost:${PORT}/${CFG.page}`;
// a phone's notch and home bar (touch at 430 px and below): the callout must stay inside them
const SAFE = { top: 47, bottom: 34, left: 0, right: 0 };
// a phone in landscape (touch at 844 x 390): the notch on the left or right, the home bar below
const SAFE_LAND = { top: 0, bottom: 21, left: 47, right: 47 };
let safeOk = null;
const HEIGHT = { 360: 780, 390: 844, 430: 932, 720: 450, 768: 1024, 844: 390, 1024: 768, 1152: 720, 1280: 800, 1440: 900 };
const ROWS = [], LAYERS = [], FOLLOW = [], FOCUS = [], MISSED = [];
const shotCount = {};
let shots = 0;
logs();

// the in-page probe: independent of the engine (it resolves the anchors the way INTEGRATION.md specifies and reads the
// drawn SVG paths), so the same audit measures the old and the new engine
const PROBE = String.raw`(() => {
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
    const tr = st.try && !(st.tryWide && innerWidth < 640) ? st.try : null;
    const tw = tr && tr.work && tr.touch && matchMedia('(pointer: coarse)').matches ? tr.work : [];
    for (const n of [].concat(st.also || [], tw)) { const e = resolve(n); if (e && e !== a && !covered(e)) add(n, e); }
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
      res.push({ name: t.name, d: best ? +best.d.toFixed(2) : 999, radD: +radD.toFixed(2), cut: t.cut && fits && !t.tooBig, appOverflow: t.cut && t.tooBig, box: [t.s.l, t.s.t, t.s.r, t.s.b].map(Math.round), hole: best && [best.h.l, best.h.t, best.h.r, best.h.b].map(Math.round) });
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
  const R = (b) => ({ l: b.left, t: b.top, r: b.right, b: b.bottom });
  function cardInfo(touch) {
    const card = document.querySelector('.tour-card');
    if (!card) return null;
    const c = R(card.getBoundingClientRect());
    const pr = document.createElement('div');
    pr.style.cssText = 'position:fixed;left:0;top:0;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
    document.body.append(pr); const pcs = getComputedStyle(pr); const safe = { t: parseFloat(pcs.paddingTop), r: parseFloat(pcs.paddingRight), b: parseFloat(pcs.paddingBottom), l: parseFloat(pcs.paddingLeft) }; pr.remove();
    const out = Math.max(0, safe.l - c.l, safe.t - c.t, c.r - (innerWidth - safe.r), c.b - (innerHeight - safe.b));
    const btns = [...card.querySelectorAll('button')].filter(vis).map((b) => { const r = R(b.getBoundingClientRect()); return { label: (b.textContent.trim() || b.getAttribute('aria-label') || '').slice(0, 40), w: +(r.r - r.l).toFixed(1), h: +(r.b - r.t).toFixed(1), r, inside: r.l >= c.l + 0.5 && r.r <= c.r - 0.5 && r.t >= c.t + 0.5 && r.b <= c.b - 0.5, clip: b.scrollWidth > b.clientWidth + 1 }; });
    const minW = touch ? 44 : 36, minH = touch ? 44 : 36;
    const small = btns.filter((b) => b.w < minW - 0.01 || b.h < minH - 0.01).map((b) => b.label + ' ' + b.w + '×' + b.h);
    let gap = Infinity;
    for (let i = 0; i < btns.length; i++) for (let j = i + 1; j < btns.length; j++) {
      const a = btns[i].r, b = btns[j].r;
      const dx = Math.max(0, Math.max(a.l, b.l) - Math.min(a.r, b.r)), dy = Math.max(0, Math.max(a.t, b.t) - Math.min(a.b, b.b));
      gap = Math.min(gap, dx > 0 && dy > 0 ? Math.hypot(dx, dy) : Math.max(dx, dy));
    }
    // text that overflows its box or the callout (clipped labels, a formula wider than the body, an ellipsis)
    const over = [];
    const inner = { l: c.l + 1, r: c.r - 1 };
    for (const e of card.querySelectorAll('.tour-head, .tour-chap, .tour-title, .tour-body, .tour-try, .tour-foot, .tour-count, button, .tour-body mjx-container, .tour-try mjx-container, .tour-math, .tour-nb, .kbd')) {
      if (!vis(e)) continue;
      const r = e.getBoundingClientRect();
      const cls = (e.className && e.className.baseVal == null ? e.className : e.tagName).toString().split(' ')[0] || e.tagName;
      if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0 && getComputedStyle(e).display !== 'inline') over.push(cls + ' scroll ' + e.scrollWidth + '>' + e.clientWidth);
      // vertical: a box that is not meant to scroll and is taller inside than out
      if (e.scrollHeight > e.clientHeight + 0.5 && e.clientHeight > 0 && getComputedStyle(e).display !== 'inline' && getComputedStyle(e).overflowY !== 'visible') over.push(cls + ' scrollY ' + e.scrollHeight + '>' + e.clientHeight);
      if (r.left < inner.l - 0.5 || r.right > inner.r + 0.5) over.push(cls + ' out ' + Math.round(r.left - c.l) + '..' + Math.round(r.right - c.l) + '/' + Math.round(c.r - c.l));
      const cs = getComputedStyle(e);
      if (cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) over.push(cls + ' ellipsis');
    }
    // the text area scrolls only when the text is taller than the room: never by a sliver (a formula's hidden copy)
    const sc = card.querySelector('.tour-scroll');
    if (sc && vis(sc)) { const ex = sc.scrollHeight - sc.clientHeight; if (ex > 0.5 && ex < 8) over.push('tour-scroll sliver ' + sc.scrollHeight + '>' + sc.clientHeight); }
    // the topmost element at the callout's centre and corners (4 px in, inside the rounded corners)
    const pts = [[(c.l + c.r) / 2, (c.t + c.b) / 2], [c.l + 4, c.t + 4], [c.r - 4, c.t + 4], [c.l + 4, c.b - 4], [c.r - 4, c.b - 4]];
    const top = pts.map(([x, y]) => { const e = document.elementFromPoint(x, y); return e && card.contains(e) ? 'ok' : e ? (e.id ? '#' + e.id : (e.className && e.className.baseVal == null ? '.' + String(e.className).split(' ')[0] : e.tagName)) : 'none'; });
    return { card: [c.l, c.t, c.r, c.b].map(Math.round), out: +out.toFixed(1), safe, btns: btns.map((b) => [b.label, b.w, b.h, b.inside, b.clip]), small, gap: gap === Infinity ? null : +gap.toFixed(1), notInside: btns.filter((b) => !b.inside).map((b) => b.label), clipped: btns.filter((b) => b.clip).map((b) => b.label), over: [...new Set(over)], top, docked: card.classList.contains('docked') };
  }
  // wait until the step has settled: not busy, the drawn spotlight and the callout unchanged for 6 frames
  async function settle(maxMs = 5000) {
    const t0 = performance.now(); let last = '', same = 0;
    while (performance.now() - t0 < maxMs) {
      await new Promise((r) => requestAnimationFrame(r));
      const card = document.querySelector('.tour-card');
      if (!Tour.isActive() || !card) return 'inactive';
      // (the engine's own flags are not trusted: only what is drawn, and the callout, holding still)
      const busy = card.getAttribute('aria-busy') === 'true';
      const dd = [...document.querySelectorAll('.tour-shade, .tour-mark')].map((e) => e.getAttribute('d'));
      const sig = busy ? 'busy' + Math.random() : JSON.stringify([dd, R(card.getBoundingClientRect()), Tour.current(), document.fonts && document.fonts.status]);
      if (sig === last) { if (++same >= 6) return 'ok'; } else same = 0;
      last = sig;
    }
    return 'timeout';
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
  return { resolve, targets, spot, cardInfo, settle, paths, seen, frame, vis, ringsOff };
})()`;
const inject = () => ev(`window.__aud = ${PROBE}; 1`);

const failKinds = (row) => {
  const k = [];
  if (row.spot && row.spot.some((s) => s.d > 1)) k.push('spot');
  if (row.spot && row.spot.some((s) => s.radD > 1)) k.push('radius');
  if (row.spot && row.spot.some((s) => s.cut)) k.push('cut');
  if (row.spot && row.spot.some((s) => s.hiddenAnchor)) k.push('hiddenAnchor');
  if (row.spot && row.spot.some((s) => s.extra && s.extra.length)) k.push('extraHole');
  if (row.spot && row.spot.some((s) => s.zero && s.zero.length)) k.push('zeroHole');
  if (row.card && row.card.out > 0.5) k.push('outside');
  if (row.card && row.card.small.length) k.push('btnSize');
  if (row.card && row.card.gap != null && row.card.gap < 8) k.push('btnGap');
  if (row.card && (row.card.notInside.length || row.card.clipped.length)) k.push('btnFit');
  if (row.card && row.card.over.length) k.push('overflow');
  if (row.card && row.card.top.some((x) => x !== 'ok')) k.push('covered');
  if (row.settle !== 'ok') k.push('settle');
  return k;
};
// app layout findings, not the tour's: a lit element wider than the panel that clips it (no scroll can show it whole)
const appKinds = (row) => (row.spot && row.spot.some((s) => s.appOverflow) ? ['appOverflow'] : []);
const maybeShot = async (cfgName, id, kinds) => {
  if (!kinds.length) return null;
  let take = false;
  for (const k of kinds) { const key = cfgName + '|' + k; shotCount[key] = (shotCount[key] || 0) + 1; if (shotCount[key] <= CFG.shotsPerKind) take = true; }
  if (!take) return null;
  shots++;
  const name = `audit-${CFG.tag}/${cfgName}__${id.replace('/', '-')}__${kinds.join('-')}`;
  await shot(name);
  return name;
};

for (const w of CFG.widths) for (const theme of CFG.themes) for (const lang of CFG.langs) for (const input of CFG.inputs) {
  const h = HEIGHT[w] || 900, touch = input === 'touch', dark = theme === 'dark';
  const cfgName = `${w}-${theme}-${lang}-${input}`;
  await view(w, h, dark, touch);
  const phoneSafe = CFG.safe && touch && (w <= 430 || (w > h && h <= 430));
  try { await send('Emulation.setSafeAreaInsetsOverride', { insets: phoneSafe ? (w > h ? SAFE_LAND : SAFE) : {} }); if (phoneSafe) safeOk = true; } catch (e) { if (phoneSafe) safeOk = false; }
  const ns = `aud${CFG.tag}${w}${theme[0]}${lang}${input[0]}`;
  await nav(`${U}?ns=${ns}&lang=${lang}`); await sleep(1200);
  await inject();
  await ev('Tour.dismissSuggestion()');
  // ---- every step
  if (CFG.steps) {
    await ev(`await Tour.start({ chapter: 'basics' })`);
    let prev = null;
    for (let k = 0; k < 80; k++) {
      const st = await ev('await __aud.settle()');
      if (st === 'inactive') break;
      const cur = await ev('Tour.current()');
      const id = cur.chapter + '/' + cur.id;
      if (prev === id) { ROWS.push({ cfg: cfgName, id, stuck: true, kinds: ['stuck'] }); break; }
      prev = id;
      const row = await ev(`({ spot: __aud.spot(), card: __aud.cardInfo(${touch}) })`);
      row.cfg = cfgName; row.id = id; row.settle = st;
      row.kinds = failKinds(row);
      row.app = appKinds(row);
      row.shot = await maybeShot(cfgName, id, row.kinds);
      ROWS.push(row);
      await ev('Tour.next()');
      await sleep(60);
    }
    await ev('Tour.isActive() && Tour.stop()'); await sleep(200);
    // every step that should show here (all but those absent by design: wide steps below 640 px, missing features) was
    // visited; a step the engine skipped fails, with its reason
    const exp = await ev(`(() => { const T = Tour._t, out = []; T.CHAPTERS.forEach((c, i) => c.steps.forEach((s, j) => { if (!T.absent(i, j, true)) out.push(c.id + '/' + s.id); })); return { exp: out, skipped: Tour.skipped() }; })()`);
    const seenIds = new Set(ROWS.filter((r) => r.cfg === cfgName).map((r) => r.id));
    for (const id of exp.exp) if (!seenIds.has(id)) {
      const why = (exp.skipped.find((x) => x.id === id) || {}).why || 'not visited';
      MISSED.push({ cfg: cfgName, id, why });
      ROWS.push({ cfg: cfgName, id, missed: why, kinds: ['skipped'], app: why === 'clipped' ? ['appClipped'] : [] });
    }
  }
  // ---- layers: during a step, open each layer of the app
  if (CFG.layers) {
    const runLayer = async (stepAt, name, open, close, sel) => {
      await ev(`await Tour.start(${JSON.stringify(stepAt)})`); await ev('await __aud.settle()');
      const id = stepAt.chapter + '/' + stepAt.step;
      const opened = await open();
      await sleep(450); await ev('await __aud.settle(1500)');
      const g = await ev(`(() => {
        const L = [...document.querySelectorAll(${JSON.stringify(sel)})].filter(__aud.vis)[0];
        const card = document.querySelector('.tour-card');
        if (!card) return { tour: false };
        const ci = __aud.cardInfo(${touch});
        if (!L) return { layer: false, ci };
        const b = L.getBoundingClientRect(), c = card.getBoundingClientRect();
        const ov = Math.max(0, Math.min(b.right, c.right) - Math.max(b.left, c.left)) * Math.max(0, Math.min(b.bottom, c.bottom) - Math.max(b.top, c.top));
        // the layer is not covered by the tour: its centre and inner corners hit the layer
        const pts = [[(b.left + b.right) / 2, (b.top + b.bottom) / 2], [b.left + 6, b.top + 6], [b.right - 6, b.top + 6], [b.left + 6, b.bottom - 6], [b.right - 6, b.bottom - 6]];
        const lay = pts.map(([x, y]) => { if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return 'offscreen'; const e = document.elementFromPoint(x, y); return e && L.contains(e) ? 'ok' : e ? (e.closest('[data-tour]') ? 'tour' : 'other:' + (e.id || e.className || e.tagName)) : 'none'; });
        // a layer that fills the viewport (a dialog on a phone) leaves no room beside it: the callout may dock over it,
        // but never over one of its controls
        // (also a layer that leaves no strip around it for the docked callout's × alone, 8 px clear: 44 px on touch)
        const need = ${touch ? 46 : 38} + 16;
        const room = Math.max(b.left - ci.safe.l, innerWidth - ci.safe.r - b.right, b.top - ci.safe.t, innerHeight - ci.safe.b - b.bottom) >= need;
        const full = !room || (b.right - b.left) * (b.bottom - b.top) >= 0.85 * (innerWidth - ci.safe.l - ci.safe.r) * (innerHeight - ci.safe.t - ci.safe.b);
        const ctl = [...L.querySelectorAll('button, input, select, textarea, a[href], summary, [role="button"], [role="option"], [role="menuitem"]')].filter(__aud.vis).filter((x) => { const q = x.getBoundingClientRect(); return q.left < c.right && q.right > c.left && q.top < c.bottom && q.bottom > c.top; }).map((x) => (x.textContent || x.getAttribute('aria-label') || x.tagName).trim().slice(0, 30));
        return { layer: true, lbox: [b.left, b.top, b.right, b.bottom].map(Math.round), overlap: Math.round(ov), lay, ci, full, ctl, ringsOff: __aud.ringsOff(L) };
      })()`);
      const kinds = [];
      if (opened === false || !g.layer) kinds.push('noLayer');
      else {
        if (g.ci.top.some((x) => x !== 'ok')) kinds.push('cardCovered');
        if (g.full) { if (g.ctl.length) kinds.push('coversLayerControls'); }
        else {
          if (g.overlap > 0) kinds.push('coversLayer');
          if (g.lay.some((x) => x === 'tour')) kinds.push('layerUnderTour');
        }
        if (g.ci.out > 0.5) kinds.push('outside');
        if (!g.ringsOff) kinds.push('ringOverLayer');
      }
      // (the tooltip: the only rule is that it never covers the callout; hidden by the tour or under the callout is fine)
      if (name === 'tooltip') for (const k of ['noLayer', 'coversLayer', 'layerUnderTour', 'coversLayerControls']) { const i = kinds.indexOf(k); if (i >= 0) kinds.splice(i, 1); }
      const shotName = kinds.length && opened !== 'na' ? await maybeShot(cfgName, id + '-' + name, kinds) : null;
      const closed = await close();
      await sleep(350);
      const after = await ev(`({ active: Tour.isActive(), layer: [...document.querySelectorAll(${JSON.stringify(sel)})].some(__aud.vis) })`);
      if (!after.active) kinds.push('tourEnded');
      if (after.layer) kinds.push('layerStays');
      const row = { cfg: cfgName, id, layer: name, g, after, kinds, shot: shotName };
      if (opened === 'na') row.na = true;
      LAYERS.push(row);
      await ev('Tour.isActive() && Tour.stop()'); await sleep(250);
    };
    const esc = async () => { await key('Escape'); return true; };
    const X = { chapter: 'basics', step: 1 };
    await runLayer({ chapter: 'keys', step: 0 }, 'palette', async () => { await key('k', 4); return true; }, esc, '#popHost > .pop.palette');
    await runLayer(X, 'palette', async () => { await key('k', 4); return true; }, esc, '#popHost > .pop.palette');
    await runLayer(X, 'examples', async () => ev(`(() => { const m = document.querySelector('#hdrMoreBtn'); const narrow = m && m.checkVisibility(); if (narrow) m.click(); document.querySelector('#examplesBtn').click(); return true; })()`), esc, '#popHost > .pop');
    // (v15: on a phone ⋯ opens the More sheet, not the header's menu)
    await runLayer(X, 'more', async () => ev(`(() => { const m = document.querySelector('#hdrMoreBtn'); if (!m || !m.checkVisibility()) return 'na'; m.click(); return true; })()`), esc, '#hdrMenu:popover-open, .ph-sheet[data-k="more"]:not([hidden])');
    await runLayer(X, 'export', async () => { await key('e', 4); return true; }, esc, '.modal-bg > .modal');
    // a toast (an Undo after a delete): never covered by the callout or the rings; it goes when it is removed
    const toastOpen = async () => ev(`(() => { __tourApi.toast('Deleted: circle 3. A long message so the toast is wide'); return true; })()`);
    const toastClose = async () => ev(`(() => { document.querySelector('#toastHost').innerHTML = ''; return true; })()`);
    await runLayer(X, 'toast', toastOpen, toastClose, '#toastHost > .toast');
    // the sound settings (in the More menu on narrow layouts): Esc with the focus in the callout closes them first
    await runLayer(X, 'sound', async () => ev(`await (async () => { const m = document.querySelector('#hdrMoreBtn'), s = document.querySelector('#soundMore'); if (!s) return 'na'; if (!s.checkVisibility() && m && m.checkVisibility()) { m.click(); await new Promise((r) => setTimeout(r, 200)); } if (!s.checkVisibility()) return 'na'; s.click(); return true; })()`),
      async () => { await ev(`document.querySelector('.tour-card .btn.primary') && document.querySelector('.tour-card .btn.primary').checkVisibility() ? document.querySelector('.tour-card .btn.primary').focus() : document.querySelector('.tour-card .tour-x').focus()`); await key('Escape'); return true; }, '.snd-pop:not([hidden])');
    // the reference guide (?)
    await runLayer(X, 'guide', async () => ev(`(() => { __tourApi.openGuide(); return true; })()`), esc, '.modal-bg > .modal');
    // the Language menu (in the More menu on narrow layouts)
    await runLayer(X, 'language', async () => ev(`await (async () => { const m = document.querySelector('#hdrMoreBtn'), lb = document.querySelector('#langBtn'); if (!lb) return 'na'; if (!lb.checkVisibility() && m && m.checkVisibility()) { m.click(); await new Promise((r) => setTimeout(r, 200)); } if (!lb.checkVisibility()) return 'na'; lb.click(); return true; })()`), esc, '#popHost > .pop');
    // the palette and a toast on every step, at one phone, one tablet and one desktop size (Russian: the longest copy)
    if ((CFG.layerAll || []).includes(w) && theme === 'light' && lang === 'ru' && input === (w < 640 ? 'touch' : 'mouse')) {
      // (the steps visited by the steps pass; without it, every step not absent by design)
      const visited = new Set(ROWS.filter((r) => r.cfg === cfgName && !r.missed).map((r) => r.id));
      const all = await ev(`Tour._t.CHAPTERS.flatMap((c, i) => c.steps.map((s, j) => ({ chapter: c.id, step: j, id: c.id + '/' + s.id, absent: Tour._t.absent(i, j, true) })))`);
      for (const at of all.filter((x) => (visited.size ? visited.has(x.id) : !x.absent))) {
        const st = { chapter: at.chapter, step: at.step };
        await runLayer(st, 'palette*', async () => { await key('k', 4); return true; }, esc, '#popHost > .pop.palette');
        await runLayer(st, 'toast*', toastOpen, toastClose, '#toastHost > .toast');
      }
    }
    // the app's tooltip, shown over the callout's centre
    await runLayer(X, 'tooltip', async () => ev(`(() => { const t = document.querySelector('#tip'), c = document.querySelector('.tour-card').getBoundingClientRect(); t.textContent = 'A tooltip over the callout'; t.hidden = false; t.style.left = (c.left + c.width / 2 - 40) + 'px'; t.style.top = (c.top + c.height / 2 - 10) + 'px'; return true; })()`),
      async () => ev(`(() => { const t = document.querySelector('#tip'); t.hidden = true; return true; })()`), '#tip:not([hidden])');
  }
  // ---- focus: Tab and Shift+Tab stay in the callout (and, during a Try it, the lit controls), each with a visible ring
  if (CFG.focus) {
    await ev(`await Tour.start({ chapter: 'basics', step: 1 })`); await ev('await __aud.settle()');
    await ev(`document.querySelector('.tour-card .btn.primary').focus()`);
    const seenF = [];
    for (let i = 0; i < 5; i++) {
      await key('Tab', i === 4 ? 8 : 0);
      seenF.push(await ev(`(() => { const a = document.activeElement; if (!a) return null; const cs = getComputedStyle(a); const ring = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2) || /(\\d+(\\.\\d+)?px\\s*){3}[1-9]/.test(cs.boxShadow); return { label: (a.textContent || a.getAttribute('aria-label') || a.tagName).trim().slice(0, 30), inCard: !!a.closest('.tour-card'), ring }; })()`));
    }
    const kinds = [];
    if (seenF.some((x) => !x || !x.inCard)) kinds.push('focusLeft');
    if (seenF.some((x) => x && x.inCard && !x.ring)) kinds.push('focusRing');
    // the palette from the callout, a search typed, Esc: the focus comes back to the callout (polish-9)
    await ev(`document.querySelector('.tour-card .btn.primary').focus()`);
    await key('k', 4); await sleep(250);
    for (const c of 'sin') await key(c);
    await sleep(150); await key('Escape'); await sleep(300);
    const back = await ev(`({ inCard: !!(document.activeElement && document.activeElement.closest('.tour-card')), tour: Tour.isActive() })`);
    seenF.push(Object.assign({ label: 'after the palette' }, back));
    if (!back.tour || !back.inCard) kinds.push('focusLost');
    const row = { cfg: cfgName, seen: seenF, kinds };
    if (kinds.length) row.shot = await maybeShot(cfgName, 'basics-x-focus', kinds);
    FOCUS.push(row);
    await ev('Tour.isActive() && Tour.stop()'); await sleep(200);
  }
  // ---- follow: the spotlight keeps up with a scroll, a resize and a layout change, in the next frame
  if (CFG.follow) {
    const one = async (stepAt, name, act) => {
      await ev(`await Tour.start(${JSON.stringify(stepAt)})`);
      if ((await ev('await __aud.settle()')) !== 'ok') { FOLLOW.push({ cfg: cfgName, name, skipped: 'settle' }); return; }
      const cur = await ev('Tour.current()');
      if (!cur || cur.chapter !== stepAt.chapter) { FOLLOW.push({ cfg: cfgName, name, skipped: 'step' }); return; }
      const r = await act();
      const kinds = [];
      if (r && r.skip) { FOLLOW.push({ cfg: cfgName, name, skipped: r.skip }); await ev('Tour.stop()'); await sleep(200); return; }
      if (!r || r.d1 == null || r.d1 > 1) kinds.push('lag');
      if (!r || r.d6 == null || r.d6 > 1) kinds.push('stale');
      const row = { cfg: cfgName, id: cur.chapter + '/' + cur.id, name, r, kinds };
      if (kinds.length) row.shot = await maybeShot(cfgName, row.id + '-follow-' + name, kinds);
      FOLLOW.push(row);
      await ev('Tour.isActive() && Tour.stop()'); await sleep(200);
    };
    const worst = `(() => { const s = __aud.spot() || []; return s.length ? Math.max(...s.map((x) => x.d)) : null; })()`;
    // a target in a scrolled panel: scroll its nearest scrolling ancestor (or the page) by 40 px
    // (v15: analysis/4, Guarantees in the Inspector; v14's analysis/5 before the Zeros and poles step moved to Editing)
    await one({ chapter: 'analysis', step: 4 }, 'scroll', async () => ev(`await (async () => {
      const tg = Tour.lit() && Tour.lit().anchor; if (!tg) return { skip: 'no anchor' };
      let el = document.elementFromPoint((tg.l + tg.r) / 2, (tg.t + tg.b) / 2);
      let sc = null;
      for (let a = el; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 40) { sc = a; break; } }
      const sy = sc ? sc.scrollTop : scrollY;
      const max = sc ? sc.scrollHeight - sc.clientHeight : document.documentElement.scrollHeight - innerHeight;
      if (max < 20) return { skip: 'nothing scrolls' };
      const dy = sy + 40 <= max ? 40 : -40;
      if (sc) sc.scrollTop = sy + dy; else scrollTo(0, scrollY + dy);
      await __aud.frame(); const d1 = ${worst};
      for (let i = 0; i < 5; i++) await __aud.frame(); const d6 = ${worst};
      return { d1, d6, by: dy, where: sc ? (sc.id || sc.className) : 'page' };
    })()`));
    // a resize of the window by 40 px
    await one({ chapter: 'basics', step: 1 }, 'resize', async () => {
      await view(w - 40, h, dark, touch);
      const d1 = await ev(`await (async () => { await __aud.frame(); return ${worst}; })()`);
      const d6 = await ev(`await (async () => { for (let i = 0; i < 6; i++) await __aud.frame(); return ${worst}; })()`);
      await view(w, h, dark, touch);
      return { d1, d6 };
    });
    // a layout change: the lit element grows by 24 px (the chain card list, a section opening)
    await one({ chapter: 'basics', step: 6 }, 'layout', async () => ev(`await (async () => {
      const a = Tour.lit() && Tour.lit().anchor; if (!a) return { skip: 'no anchor' };
      const e = __aud.resolve(Tour._t.CHAPTERS.find((c) => c.id === Tour.current().chapter).steps[Tour.current().step].anchor);
      if (!e || !e.style) return { skip: 'no element' };
      const old = e.style.paddingBottom; e.style.paddingBottom = (parseFloat(getComputedStyle(e).paddingBottom) + 24) + 'px';
      await __aud.frame(); await __aud.frame(); const d1 = ${worst};
      for (let i = 0; i < 5; i++) await __aud.frame(); const d6 = ${worst};
      e.style.paddingBottom = old;
      return { d1, d6 };
    })()`));
  }
}
await view(1440, 900, false, false);
try { await send('Emulation.setSafeAreaInsetsOverride', { insets: {} }); } catch (e) { /* */ }

// ---- summary
const fails = ROWS.filter((r) => r.kinds.length);
const byKind = {};
for (const r of ROWS) for (const k of r.kinds) byKind[k] = (byKind[k] || 0) + 1;
const lfails = LAYERS.filter((r) => r.kinds.length && !r.na);
const lByKind = {};
for (const r of LAYERS) if (!r.na) for (const k of r.kinds) lByKind[k + ':' + r.layer] = (lByKind[k + ':' + r.layer] || 0) + 1;
const ffails = FOLLOW.filter((r) => r.kinds && r.kinds.length);
const fByKind = {};
for (const r of FOLLOW) for (const k of (r.kinds || [])) fByKind[k + ':' + r.name] = (fByKind[k + ':' + r.name] || 0) + 1;
const spotD = ROWS.flatMap((r) => (r.spot || []).map((s) => s.d)).filter((d) => d < 999);
spotD.sort((a, b) => a - b);
const btnH = ROWS.flatMap((r) => (r.card ? r.card.btns.map((b) => b[2]) : []));
const LOGS = logs();
// exceptions and the tour's warnings, apart from its reports of skipped steps (those are rows of their own)
const exc = LOGS.filter((l) => /EXC|\[tour\]/.test(l.t + ' ' + l.m) && !/\[tour\] step skipped/.test(l.m)).slice(0, 10);
const summary = {
  tag: CFG.tag, configs: CFG.widths.length * CFG.themes.length * CFG.langs.length * CFG.inputs.length,
  stepViews: ROWS.filter((r) => !r.missed).length, failingStepViews: fails.length, byKind,
  spotDiffPx: spotD.length ? { median: spotD[spotD.length >> 1], p95: spotD[Math.floor(spotD.length * 0.95)], max: spotD[spotD.length - 1], over1: spotD.filter((d) => d > 1).length, of: spotD.length } : null,
  buttonHeightPx: btnH.length ? { min: Math.min(...btnH), max: Math.max(...btnH) } : null,
  layerChecks: LAYERS.filter((r) => !r.na).length, failingLayerChecks: lfails.length, layersByKind: lByKind,
  followChecks: FOLLOW.filter((r) => !r.skipped).length, failingFollow: ffails.length, followByKind: fByKind, followSkipped: FOLLOW.filter((r) => r.skipped).length,
  appFindings: ROWS.filter((r) => r.app && r.app.length).map((r) => r.cfg + ' ' + r.id),
  focusChecks: FOCUS.length, failingFocus: FOCUS.filter((r) => r.kinds.length).length, safeAreaEmulated: safeOk,
  skippedSteps: MISSED.map((m) => m.cfg + ' ' + m.id + ' (' + m.why + ')'),
  shots, exceptions: exc,
};
fs.mkdirSync(DIR + '/audit', { recursive: true });
fs.writeFileSync(`${DIR}/audit/${CFG.tag}.json`, JSON.stringify({ summary, rows: ROWS, layers: LAYERS, follow: FOLLOW, focus: FOCUS }, null, 1));
return { summary, firstFails: fails.slice(0, 6).map((r) => ({ cfg: r.cfg, id: r.id, kinds: r.kinds, spot: r.spot, small: r.card && r.card.small, over: r.card && r.card.over, top: r.card && r.card.top, out: r.card && r.card.out })), layerFails: lfails.slice(0, 6).map((r) => ({ cfg: r.cfg, layer: r.layer, kinds: r.kinds, overlap: r.g.overlap, lay: r.g.lay, top: r.g.ci && r.g.ci.top })), followFails: ffails.slice(0, 4) };
