// The guided tour on a phone (notes/tour/PHONE.md, v15.1): does the spotlight move with its target, and does the
// callout keep clear of the step's work area? Run with a copy of test/cdp_kit (dist/ served on its port):
//     test/<you>_cdp/q.sh test/tour_phone_cmd.js
// A subset or another page: prepend `const PHONE_CFG = { page: 'test_before.html', tag: 'before', sizes: [[390, 844]] };`.
// Mobile emulation: 390 x 844 and 360 x 780, deviceScaleFactor 3, touch, a 47 px notch and a 34 px home bar.
//  1. scroll: real touch scrolls (Input.synthesizeScrollGesture, with the fling) of a sheet and of the chain bar during
//     a step. Two measures, every frame: (a) on screen: strips of the composited frame (Page.captureScreenshot), the
//     target outlined in pure green (drawn by the page, so it moves with the content) and the ring in pure magenta;
//     the offset is the change of their distance from the still frame, in CSS px. This is what the eye sees: the
//     content moves on the compositor before the page's script runs. (b) in the page: in each animation frame, the
//     target's visible box against the drawn ring (mapped with getScreenCTM), in CSS px.
//  2. urlbar: the viewport's height changes by 56 px and back (the URL bar collapsing and expanding) during a step;
//     the same two measures in the frames after each change.
//  3. pinch: the page pinch-zoomed to 1.5 (Input.synthesizePinchGesture) during a step; on screen, at rest after it.
//  4. work: every phone step, English and Russian: the callout against the step's work area (Tour.lit().work, else
//     its lit holes), overlap in px² and in px; the bar's buttons (44 px, inside); a touch at the work area's points
//     reaches the app, not the tour; and a whole step unfolded from the bar folds back when the work area is touched.
//  5. (review-phone) tries: Try it steps performed by touch with the tour open (the chain's lens in the sheet, ...):
//     the try box must turn done. race: a run restarted on a hosted step within 50 ms of the last keeps its panel set
//     up (the ring moves in the frame of a programmatic scroll). rotate: a step rotated to landscape with nothing lit
//     shows the whole card, not the bar. Landscape sizes (844 x 390, 780 x 360, the notch left and right) in the work
//     check; the fold button hidden unless the card is .over.
// Rows go to <kit>/phone/<tag>.json; the return value is the summary. Sections can run alone: PHONE_CFG { scroll,
// urlbar, pinch, work, tries, race, rotate, cases: 'all' (every hosted or chain step) }.
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
const CFG = Object.assign({ page: 'test.html', tag: 'after', sizes: [[390, 844], [360, 780]], land: [[844, 390], [780, 360]], langs: ['en', 'ru'], scroll: true, urlbar: true, pinch: true, work: true, tries: true, race: true, rotate: true, cases: 'all' }, typeof PHONE_CFG !== 'undefined' ? PHONE_CFG : {});
const U = `http://localhost:${PORT}/${CFG.page}`;
const SAFE = { top: 47, bottom: 34, left: 0, right: 0 };
// (a phone in landscape: the notch on the left and the right, the home bar below)
const SAFE_L = { top: 0, bottom: 21, left: 47, right: 47 };
const DPR = 3;
const OUT = { cfg: CFG, scroll: [], urlbar: [], pinch: [], work: [], fold: [], tries: [], race: [], rotate: [] };
logs();

const setView = async (w, h) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: DPR, mobile: true, screenOrientation: w > h ? { type: 'landscapePrimary', angle: 90 } : { type: 'portraitPrimary', angle: 0 } });
  await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  try { await send('Emulation.setSafeAreaInsetsOverride', { insets: w > h ? SAFE_L : SAFE }); } catch (e) { /* older Chrome */ }
};
const open = async (w, h, lang, ns) => {
  await setView(w, h);
  await nav(`${U}?ns=${ns}&lang=${lang}`); await sleep(1200);
  await ev('Tour.dismissSuggestion()');
};
const startAt = async (chapter, step) => { await ev(`await Tour.start({ chapter: ${JSON.stringify(chapter)}, step: ${step} })`); await sleep(1300); };

// in the page: the target, the rings, a per-frame sampler
const PROBE = String.raw`(() => {
  const T = () => Tour._t;
  const vis = (e) => !!e && e.isConnected && e.getBoundingClientRect().width > 1;
  function anchor() {
    const c = Tour.current(); if (!c) return null;
    const st = T().CHAPTERS.find((x) => x.id === c.chapter).steps[c.step];
    for (const n of [].concat(st.anchor)) {
      let e = window.__tourApi && __tourApi.anchor ? __tourApi.anchor(n) : undefined;
      const A = T().ANCHORS[n];
      if (e === undefined && A) e = typeof A === 'function' ? A() : document.querySelector(A);
      if (e && e.nodeType === 1 && vis(e)) return e;
    }
    return null;
  }
  function scroller(e) {
    for (let a = e.parentElement; a && a !== document.body; a = a.parentElement) { const cs = getComputedStyle(a); if ((/(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) || (/(auto|scroll)/.test(cs.overflowX) && a.scrollWidth > a.clientWidth + 1)) return a; }
    return null;
  }
  const box = (b) => ({ l: b.left, t: b.top, r: b.right, b: b.bottom });
  const cut = (a, w) => (w ? { l: Math.max(a.l, w.l), t: Math.max(a.t, w.t), r: Math.min(a.r, w.r), b: Math.min(a.b, w.b) } : a);
  function winOf(H) { if (!H) return { l: 0, t: 0, r: innerWidth, b: innerHeight }; const b = H.getBoundingClientRect(); return { l: b.left + H.clientLeft, t: b.top + H.clientTop, r: b.left + H.clientLeft + H.clientWidth, b: b.top + H.clientTop + H.clientHeight }; }
  // every ring subpath on screen, in client px (each path's bbox through its CTM)
  function rings() {
    const out = [];
    for (const p of document.querySelectorAll('path.tour-ring')) {
      const m = p.getScreenCTM(); if (!m) continue;
      for (const sub of (p.getAttribute('d') || '').split('M').filter(Boolean)) {
        const nums = sub.match(/-?[\d.]+(e-?\d+)?/g); if (!nums) continue;
        // M x y H x A r r 0 0 1 x y V y ...: the endpoints only (an arc's radii and flags are skipped)
        const toks = ('M' + sub).match(/[MHVAZ][^MHVAZ]*/g); let x = 0, y = 0; const xs = [], ys = [];
        for (const tk of toks) { const v = (tk.slice(1).match(/-?[\d.]+(e-?\d+)?/g) || []).map(Number); const c = tk[0];
          if (c === 'M') { x = v[0]; y = v[1]; } else if (c === 'H') x = v[0]; else if (c === 'V') y = v[0]; else if (c === 'A') { x = v[5]; y = v[6]; } else continue; xs.push(x); ys.push(y); }
        const l = Math.min(...xs), r = Math.max(...xs), t = Math.min(...ys), b = Math.max(...ys);
        out.push({ l: m.a * l + m.e, r: m.a * r + m.e, t: m.d * t + m.f, b: m.d * b + m.f });
      }
    }
    return out;
  }
  // the offset of the ring that best matches the target (both cut by the target's panel), in CSS px
  function offset(e, H) {
    // (the panel's window, itself cut by the viewport: a target slid off screen with its closing sheet shows nothing to
    // follow; before, it read as the distance to another part's ring, 41 px at analysis/domain)
    const w = cut(winOf(H), { l: 0, t: 0, r: innerWidth, b: innerHeight }), tb = cut(box(e.getBoundingClientRect()), w);
    if (tb.r - tb.l < 2 || tb.b - tb.t < 2) return null;
    let best = null;
    for (const q0 of rings()) {
      const q = cut({ l: q0.l + 0.75, t: q0.t + 0.75, r: q0.r - 0.75, b: q0.b - 0.75 }, w);
      const d = Math.max(Math.abs(q.l - tb.l), Math.abs(q.t - tb.t), Math.abs(q.r - tb.r), Math.abs(q.b - tb.b));
      if (best == null || d < best) best = d;
    }
    return best;
  }
  const S = { e: null, H: null, on: false, rows: [] };
  function frame() { if (!S.on) return; const d = S.e && S.e.isConnected ? offset(S.e, S.H) : null; S.rows.push(d); requestAnimationFrame(frame); }
  window.__ph = {
    anchor, scroller, winOf, offset, rings,
    mark() {
      const e = anchor(); if (!e) return null;
      S.e = e; S.H = scroller(e);
      e.classList.add('ph-tgt');
      if (!document.getElementById('phCSS')) { const s = document.createElement('style'); s.id = 'phCSS'; s.textContent = '.ph-tgt{outline:2px solid #00ff00 !important;outline-offset:-2px !important}.tour-ring{stroke:#ff00ff !important;stroke-width:2px !important;stroke-opacity:1 !important}.tour-glow,.tour-mark{display:none !important}'; document.head.append(s); }
      const b = e.getBoundingClientRect(), w = winOf(S.H);
      return { tgt: box(b), win: w, hor: !!S.H && S.H.scrollWidth > S.H.clientWidth + 1 && !(S.H.scrollHeight > S.H.clientHeight + 1), max: S.H ? [S.H.scrollWidth - S.H.clientWidth, S.H.scrollHeight - S.H.clientHeight] : [0, 0], at: S.H ? [S.H.scrollLeft, S.H.scrollTop] : [0, 0] };
    },
    scrollTo(x, y) { if (S.H) { S.H.scrollLeft = x; S.H.scrollTop = y; } },
    start() { S.rows = []; S.on = true; requestAnimationFrame(frame); },
    stop() { S.on = false; return S.rows.filter((v) => v != null); },
  };
  return true;
})()`;
const stats = (a) => { const v = a.filter((x) => x != null).map((x) => Math.abs(x)).sort((p, q) => p - q); if (!v.length) return { n: 0, max: null, p95: null }; return { n: v.length, max: +v[v.length - 1].toFixed(2), p95: +v[Math.min(v.length - 1, Math.floor(0.95 * v.length))].toFixed(2) }; };

// one composited strip across the target's edge: the green and magenta edges, in device px
async function strip(m, hor, edge) {
  const w = m.win;
  const clip = hor ? { x: Math.max(0, w.l), y: Math.round((m.tgt.t + m.tgt.b) / 2), width: Math.max(4, w.r - w.l), height: 1 } : { x: m.sx, y: Math.max(0, w.t), width: 1, height: Math.max(4, w.b - w.t) };
  const im = await img(clip);
  const n = hor ? im.w : im.h;
  const px = (i) => { const o = (hor ? i : i * im.w + Math.floor(im.w / 2)) * im.ch; return [im.data[o], im.data[o + 1], im.data[o + 2]]; };
  const green = (c) => c[1] > 100 && c[0] < 90 && c[2] < 90 && c[1] > 1.6 * c[0];
  const mag = (c) => c[0] > 160 && c[2] > 160 && c[1] < 110;
  const order = edge === 'start' ? [...Array(n).keys()] : [...Array(n).keys()].reverse();
  let g = null, mm = null;
  for (const i of order) if (green(px(i))) { g = i; break; }
  // (this edge's ring: the magenta nearest the green edge, within 40 CSS px either way. Before, the first magenta along
  // the strip: another ring entering the strip ahead of the target in a long fling read as a constant 89 to 141 px)
  if (g != null) for (let d = 0; d <= 40 * DPR && mm == null; d++) for (const i of [g - d, g + d]) if (i >= 0 && i < n && mag(px(i))) { mm = i; break; }
  // (the target's edge at the panel's edge, or within 6 px of it, is cut there, not followed: no reading (review-phone
  // phone-9: branches/inverse read 13.7 px where the panel clipped both); a ring faded out while it moves: 'hidden')
  const E = 6 * DPR;
  if (g == null || g < E || g > n - 1 - E) return null;
  return mm == null ? 'hidden' : g - mm;
}

// ---- 1. scroll
const CASES0 = [
  { id: 'views/patterns', chapter: 'views', step: 5, kind: 'sheet' },
  { id: 'edit/numbers', chapter: 'edit', step: 4, kind: 'sheet' },
  { id: 'basics/add', chapter: 'basics', step: 8, kind: 'chain' },
];
// (review-phone phone-9: every step whose anchor sits in a panel that scrolls, a sheet or the chain bar)
async function allCases() {
  await ev(`await Tour.start({ chapter: 'basics' })`);
  const out = [], seen = new Set();
  for (let k = 0; k < 80; k++) {
    await sleep(900);
    if (!(await ev('Tour.isActive()'))) break;
    await ev(PROBE);
    const c = await ev(`(() => { const c = Tour.current(); const e = __ph.anchor(); const H = e && __ph.scroller(e); return { chapter: c.chapter, id: c.id, step: c.step, H: H ? (H.id || H.className || H.tagName) : null, hor: !!H && H.scrollWidth > H.clientWidth + 1 && !(H.scrollHeight > H.clientHeight + 1) }; })()`);
    const key = c.chapter + '/' + c.id;
    if (seen.has(key)) break;
    seen.add(key);
    if (c.H) out.push({ id: key, chapter: c.chapter, step: c.step, kind: /pipeline/.test(c.H) ? 'chain' : 'sheet' });
    await ev('Tour.next()');
  }
  await ev('Tour.isActive() && Tour.stop()'); await sleep(300);
  return out;
}
if (CFG.scroll) for (const [W, H] of CFG.sizes) {
  await open(W, H, 'en', `ph${CFG.tag}s${W}`);
  const CASES = CFG.cases === 'all' ? await allCases() : CASES0;
  for (const c of CASES) {
    await startAt(c.chapter, c.step);
    await ev(PROBE);
    let m = await ev('__ph.mark()');
    if (!m || m.__exc) { OUT.scroll.push({ size: W + 'x' + H, id: c.id, skip: 'no anchor' }); continue; }
    if (!(m.max[0] > 20 || m.max[1] > 20)) { OUT.scroll.push({ size: W + 'x' + H, id: c.id, skip: 'nothing scrolls' }); continue; }
    const screen = [], page = [], outside = [];
    let hidden = 0, lost = 0;
    const gs = [], hosted0 = await ev('Tour.lit() && Tour.lit().hosted');
    // (lost: a gesture with no anchor in its panel to measure, e.g. the step's anchor scrolled or closed away)
    // gestures: a slow drag (no fling) and a fling, each way. Before each, the panel is scrolled so the edge that the
    // move carries into the panel starts just inside it (content moving down or right: the target's start edge)
    // (and a fling that starts on the dimmed part of the panel, outside the lit hole: review-phone phone-9)
    const G = [[1, 500, true], [-1, 500, true], [1, 1400, false], [-1, 1400, false], [1, 1400, false, 'outside']];
    for (const [dir, speed, noFling, from] of G) {
      const edge = dir > 0 ? 'start' : 'end';
      m = await ev('__ph.mark()'); if (!m || m.__exc) { lost++; continue; }
      const span = m.hor ? m.win.r - m.win.l : m.win.b - m.win.t, len = m.hor ? m.tgt.r - m.tgt.l : m.tgt.b - m.tgt.t;
      // (the move: at most what keeps the tracked edge inside the panel)
      const room = Math.max(40, span - 16 - (edge === 'start' ? 0 : 0) - Math.min(len, span * 0.3));
      const want = edge === 'start' ? (m.hor ? m.tgt.l - (m.win.l + 6) : m.tgt.t - (m.win.t + 6)) : (m.hor ? m.tgt.r - (m.win.r - 6) : m.tgt.b - (m.win.b - 6));
      await ev(`__ph.scrollTo(${Math.round(m.at[0] + (m.hor ? want : 0))}, ${Math.round(m.at[1] + (m.hor ? 0 : want))})`); await sleep(400);
      m = await ev('__ph.mark()'); if (!m || m.__exc) { lost++; continue; }
      m.sx = Math.round(Math.max(m.tgt.l + 12, Math.min(m.tgt.r - 12, m.tgt.l + 40)));
      const rest = await strip(m, m.hor, edge);
      if (rest == null || rest === 'hidden') continue;
      await ev('__ph.start()');
      // (the touch starts on the lit target itself: before v15.1 the shade took a touch anywhere else in the panel)
      const cl = (v, a, b) => Math.max(a + 4, Math.min(b - 4, v));
      const at = { x: Math.round(cl((m.tgt.l + m.tgt.r) / 2, m.win.l, m.win.r)), y: Math.round(cl((m.tgt.t + m.tgt.b) / 2, m.win.t, m.win.b)) };
      if (from === 'outside') {
        // the widest stretch of the panel's window beside the target, across the scroll
        if (m.hor) { const a = m.tgt.l - m.win.l, b = m.win.r - m.tgt.r; at.x = Math.round(a > b ? m.win.l + a / 2 : m.tgt.r + b / 2); }
        else { const a = m.tgt.t - m.win.t, b = m.win.b - m.tgt.b; at.y = Math.round(a > b ? m.win.t + a / 2 : m.tgt.b + b / 2); }
        outside.push(await ev(`(() => { const e = document.elementFromPoint(${at.x}, ${at.y}); return e ? (e.closest('[data-tour]') ? 'tour:' + e.closest('[data-tour]').dataset.tour : 'app') : null; })()`), 'at ' + m.at.join(','));
      }
      const dist = Math.round(dir * Math.min(room, noFling ? 160 : 90));
      const g = send('Input.synthesizeScrollGesture', Object.assign({ x: at.x, y: at.y, speed, gestureSourceType: 'touch', preventFling: noFling }, m.hor ? { xDistance: dist, yDistance: 0 } : { yDistance: dist, xDistance: 0 }));
      await sleep(60);
      const t0 = Date.now(), fr = [];
      while (Date.now() - t0 < 1100) { const d = await strip(m, m.hor, edge); if (d === 'hidden') hidden++; else if (d != null) fr.push((d - rest) / DPR); }
      await g;
      if (from === 'outside') outside.push(await ev('(() => { const m = __ph.mark(); return m ? m.at.join(",") : null; })()'));
      const pg = await ev('__ph.stop()');
      page.push(...pg);
      screen.push(...fr);
      gs.push({ dir, fling: !noFling, from: from || 'target', screen: stats(fr), page: stats(pg) });
    }
    OUT.scroll.push({ size: W + 'x' + H, id: c.id, kind: c.kind, hosted: hosted0, hostedEnd: await ev('Tour.lit() && Tour.lit().hosted'), gestures: gs, ringHiddenFrames: hidden, lostGestures: lost, screen: stats(screen), page: stats(page), screenRaw: screen.map((v) => +v.toFixed(2)), outside });
  }
  await ev('Tour.isActive() && Tour.stop()'); await sleep(200);
}

// ---- 2. urlbar: the viewport's height changes by 56 px and back during a step
if (CFG.urlbar) for (const [W, H] of CFG.sizes) {
  await open(W, H, 'en', `ph${CFG.tag}u${W}`);
  for (const c of [{ id: 'basics/x', chapter: 'basics', step: 1 }, { id: 'views/patterns', chapter: 'views', step: 5 }]) {
    await startAt(c.chapter, c.step);
    await ev(PROBE);
    const page = [], screen = [], first = [];
    for (const h of [H - 56, H]) {
      await ev('__ph.start()');
      await send('Emulation.setDeviceMetricsOverride', { width: W, height: h, deviceScaleFactor: DPR, mobile: true });
      // the first frames after the change, on screen (the target's bottom edge moves with the plane, or the sheet)
      const m = await ev('__ph.mark()');
      if (m && !m.__exc) { m.sx = Math.round(Math.max(m.tgt.l + 12, Math.min(m.tgt.r - 12, m.tgt.l + 40))); m.win = { l: 0, t: 0, r: W, b: h }; for (let k = 0; k < 4; k++) { const d = await strip(m, false, 'end'); if (typeof d === 'number') screen.push(d); } }
      await sleep(500);
      const rows = await ev('__ph.stop()');
      first.push(rows[0]);
      page.push(...rows);
    }
    // (on screen: the distance of the ring's bottom edge from the target's, against the ring drawn 0.75 px outside)
    const scr = screen.map((d) => Math.abs(d / DPR) - 0);
    OUT.urlbar.push({ size: W + 'x' + H, id: c.id, page: stats(page), firstFrame: first, screenEdgeGap: { min: Math.min(...scr), max: Math.max(...scr) } });
  }
  await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: DPR, mobile: true });
  await ev('Tour.isActive() && Tour.stop()'); await sleep(200);
}

// ---- 3. pinch: page zoom 1.5 on the header during the view-switch step
if (CFG.pinch) {
  const [W, H] = CFG.sizes[0];
  await open(W, H, 'en', `ph${CFG.tag}p${W}`);
  await startAt('views', 0);
  await ev(PROBE);
  const m = await ev('__ph.mark()');
  await ev('__ph.start()');
  const before = await ev('({ s: visualViewport.scale })');
  try { await send('Input.synthesizePinchGesture', { x: Math.round((m.tgt.l + m.tgt.r) / 2), y: Math.round((m.tgt.t + m.tgt.b) / 2), scaleFactor: 1.5, relativeSpeed: 600, gestureSourceType: 'touch' }); } catch (e) { OUT.pinch.push({ error: String(e) }); }
  await sleep(500);
  const page = await ev('__ph.stop()');
  const vv = await ev('({ s: visualViewport.scale, x: visualViewport.offsetLeft, y: visualViewport.offsetTop })');
  // on screen: a strip through the target's centre, in the zoomed frame
  const cx = (m.tgt.l + m.tgt.r) / 2, sx = Math.round((cx - vv.x) * vv.s);
  const rest = await strip({ win: { l: 0, t: 0, r: W, b: H }, sx, tgt: m.tgt }, false, 'start');
  OUT.pinch.push({ id: 'views/switch', scaleBefore: before.s, scaleAfter: vv.s, page: stats(page), screenTopGapCss: typeof rest !== 'number' ? rest : +(rest / DPR / vv.s).toFixed(2) });
  try { await send('Emulation.resetPageScaleFactor', {}); } catch (e) { /* */ }
  await ev('Tour.isActive() && Tour.stop()'); await sleep(200);
}

// ---- 4. work: every phone step
const WORK = String.raw`(() => {
  const L = Tour.lit(); if (!L) return null;
  const c = Tour.current(); const card = document.querySelector('[data-tour=card]'); const cb = card.getBoundingClientRect();
  const pr = document.createElement('div'); pr.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.append(pr); const pcs = getComputedStyle(pr); const sf = { t: parseFloat(pcs.paddingTop), r: parseFloat(pcs.paddingRight), b: parseFloat(pcs.paddingBottom), l: parseFloat(pcs.paddingLeft) }; pr.remove();
  const work = (L.work || L.holes).filter((h) => h.r - h.l > 1 && h.b - h.t > 1);
  const ov = (h) => Math.max(0, Math.min(cb.right, h.r) - Math.max(cb.left, h.l)) * Math.max(0, Math.min(cb.bottom, h.b) - Math.max(cb.top, h.t));
  const depth = (h) => { const w = Math.min(cb.right, h.r) - Math.max(cb.left, h.l), d = Math.min(cb.bottom, h.b) - Math.max(cb.top, h.t); return w > 0 && d > 0 ? Math.min(w, d) : 0; };
  // a touch at the work area's centre and four inner points (not under the callout) reaches the app; in a panel the
  // spotlight is drawn inside (v15.1), a touch on its dimmed part scrolls the panel but presses nothing: scrollOnly
  let blocked = 0, tried = 0, scrollOnly = 0;
  for (const h of work) for (const [fx, fy] of [[0.5, 0.5], [0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
    const x = h.l + fx * (h.r - h.l), y = h.t + fy * (h.b - h.t);
    if (x >= cb.left && x <= cb.right && y >= cb.top && y <= cb.bottom) continue;
    tried++; const e = document.elementFromPoint(x, y); if (e && e.closest('svg.tour-host')) scrollOnly++; else if (!e || e.closest('[data-tour]')) blocked++;
  }
  const btns = [...card.querySelectorAll('button')].filter((b) => b.offsetParent !== null && b.getBoundingClientRect().width > 0).map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, inside: r.left >= cb.left - 0.5 && r.right <= cb.right + 0.5 && r.top >= cb.top - 0.5 && r.bottom <= cb.bottom + 0.5, clip: b.scrollWidth > b.clientWidth + 1 }; });
  return { id: c.chapter + '/' + c.id, mini: !!L.mini, hosted: L.hosted || 0, card: [cb.left, cb.top, cb.right, cb.bottom].map(Math.round), over: Math.round(work.reduce((s, h) => s + ov(h), 0)), depth: Math.round(Math.max(0, ...work.map(depth))), blocked, tried, scrollOnly,
    small: btns.filter((b) => b.w < 43.5 || b.h < 43.5).length, out: btns.filter((b) => !b.inside || b.clip).length,
    inView: cb.top >= sf.t - 0.5 && cb.bottom <= innerHeight - sf.b + 0.5 && cb.left >= sf.l - 0.5 && cb.right <= innerWidth - sf.r + 0.5,
    // (review-phone phone-1: the fold button shows only on a whole step over the work area)
    foldBad: !!card.querySelector('.tour-fold') && card.querySelector('.tour-fold').offsetParent !== null && !card.classList.contains('over'),
    bar: L.mini ? [...card.querySelectorAll('.tour-grow, .tour-count, .tour-mback, .tour-foot .primary')].filter((b) => b.offsetParent !== null).map((b) => b.textContent.trim() || b.getAttribute('aria-label')).join(' | ') : null,
    trunc: L.mini && !!card.querySelector('.tour-gt') && card.querySelector('.tour-gt').scrollHeight > card.querySelector('.tour-gt').clientHeight + 1 };
})()`;
if (CFG.work) for (const [W, H] of CFG.sizes.concat(CFG.land || [])) for (const lang of CFG.langs) {
  await open(W, H, lang, `ph${CFG.tag}w${W}${lang}`);
  await ev(`await Tour.start({ chapter: 'basics' })`);
  let prev = null;
  for (let k = 0; k < 80; k++) {
    await sleep(1100);
    if (!(await ev('Tour.isActive()'))) break;
    const row = await ev(WORK);
    if (!row || row.__exc) break;
    if (row.id === prev) break;
    prev = row.id;
    row.size = W + 'x' + H; row.lang = lang;
    OUT.work.push(row);
    await ev('Tour.next()');
  }
  await ev('Tour.isActive() && Tour.stop()'); await sleep(200);
}
// the bar unfolded, then a touch in the work area: it folds back and the touch reaches the app
if (CFG.work) {
  const [W, H] = CFG.sizes[0];
  await open(W, H, 'en', `ph${CFG.tag}f${W}`);
  for (const [chapter, step] of [['basics', 1], ['views', 5]]) {
    await startAt(chapter, step);
    const s0 = await ev(`({ mini: !!(Tour.lit() && Tour.lit().mini) })`);
    if (!s0.mini) { OUT.fold.push({ id: chapter + '/' + step, skip: 'not collapsed' }); continue; }
    await clickSel('[data-tour=card] .tour-grow'); await sleep(400);
    const s1 = await ev(`(() => { const L = Tour.lit(); const cb = document.querySelector('[data-tour=card]').getBoundingClientRect(); const w = L.work.find((h) => h.b - h.t > 40) || L.work[0]; const pts = []; for (let y = w.t + 8; y < w.b - 8; y += 12) if (!(y >= cb.top - 2 && y <= cb.bottom + 2)) pts.push(y); return { mini: L.mini, expanded: L.expanded, x: Math.round((w.l + w.r) / 2), y: Math.round(pts.length ? pts[Math.floor(pts.length / 2)] : -1) }; })()`);
    let got = null;
    if (s1.y > 0) {
      await ev(`window.__phHit = null; document.addEventListener('pointerdown', (e) => { if (!e.target.closest('[data-tour]')) window.__phHit = e.target.tagName; }, { once: true })`);
      await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: s1.x, y: s1.y, id: 1 }] });
      await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await sleep(400);
      got = await ev('({ mini: !!Tour.lit().mini, expanded: !!Tour.lit().expanded, hit: window.__phHit })');
    }
    OUT.fold.push({ id: chapter + '/' + step, unfolded: !s1.mini && s1.expanded, after: got, ok: !!got && got.mini && !got.expanded && !!got.hit });
  }
  await ev('Tour.isActive() && Tour.stop()'); await sleep(200);
}

// ---- 5. tries by touch, the restart race, rotation (review-phone phone-2, phone-6, phone-7)
const TAP = async (x, y, hold) => { await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] }); await sleep(hold || 60); await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(350); };
const HIT = (x, y) => ev(`(() => { const e = document.elementFromPoint(${x}, ${y}); return e ? (e.closest('[data-tour]') ? 'tour:' + e.closest('[data-tour]').dataset.tour : 'app') : null; })()`);
const FIND = (re) => `(() => { const e = [...document.querySelectorAll('button, [role=menuitem], [role=option], [role=radio], li, a, label, .pat')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && r.bottom > 0 && r.top < innerHeight && !e.closest('[data-tour]') && ${re}.test(((e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '') + ' ' + e.textContent).trim()); }).sort((a, b) => a.textContent.length - b.textContent.length)[0]; if (!e) return null; const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })()`;
const ANC = `(() => { const h = Tour.lit() && Tour.lit().holes[0]; return h ? { x: Math.round((h.l + h.r) / 2), y: Math.round((h.t + h.b) / 2) } : null; })()`;
const SEL = (css) => `(() => { const e = document.querySelector(${JSON.stringify(css)}); if (!e) return null; const b = e.getBoundingClientRect(); return b.width > 1 ? { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) } : null; })()`;
if (CFG.tries) {
  const [W, H] = CFG.sizes[0];
  const TRIES = [
    { id: 'basics/chain', ch: 'basics', st: 7, steps: [SEL('#pipeline .card[data-k="1"]'), SEL('#propsPanel .insp-step .ihead .alone-btn')] },
    { id: 'views/switch', ch: 'views', st: 0, steps: [ANC, FIND('/^\\s*Phase/')] },
    { id: 'views/patterns', ch: 'views', st: 5, steps: [FIND('/Stretch/')] },
    // (Choose Disc, then drag in X: the drag starts in the lit plane)
    { id: 'basics/draw', ch: 'basics', st: 4, steps: [FIND('/^\\s*Disc/'), 'drag'] },
    { id: 'keys/palette', ch: 'keys', st: 0, steps: [ANC, FIND('/Search functions/')] },
  ];
  for (const c of TRIES) {
    await open(W, H, 'en', `ph${CFG.tag}t${c.st}${c.ch}`);
    await startAt(c.ch, c.st);
    const row = { id: c.id, taps: [] };
    // (done: the try box ticks; a Try it that advances by itself has left its step)
    await ev(`window.__phDone = false; { const t = document.querySelector('.tour-try'); if (t) new MutationObserver(() => { if (t.classList.contains('done')) window.__phDone = true; }).observe(t, { attributes: true }); }`);
    for (const q of c.steps) {
      if (q === 'drag') {
        const w = await ev(`(() => { const h = Tour.lit().work.find((h) => h.r - h.l > 150 && h.b - h.t > 150); return h ? { x: Math.round((h.l + h.r) / 2), y: Math.round((h.t + h.b) / 2) } : null; })()`);
        if (!w) { row.taps.push('no plane'); break; }
        row.taps.push(await HIT(w.x, w.y));
        await send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w.x, y: w.y, id: 1 }] });
        for (let k = 1; k <= 8; k++) { await send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: w.x + 6 * k, y: w.y + 4 * k, id: 1 }] }); await sleep(16); }
        await send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(700);
        continue;
      }
      const p = await ev(q);
      if (!p || p.__exc) { row.taps.push('not found'); break; }
      row.taps.push(await HIT(p.x, p.y));
      await TAP(p.x, p.y); await sleep(700);
      if (await ev('window.__phDone')) break;
    }
    row.done = await ev('window.__phDone');
    row.id2 = await ev(`(() => { const c = Tour.current(); return c && c.chapter + '/' + c.id; })()`);
    OUT.tries.push(row);
    await ev('Tour.isActive() && Tour.stop()'); await sleep(300);
  }
}
if (CFG.race) {
  const [W, H] = CFG.sizes[0];
  await open(W, H, 'en', `ph${CFG.tag}r${W}`);
  for (const [a, b] of [[['basics', 5], ['basics', 6]], [['views', 5], ['views', 5]]]) {
    // (the second start stops the first run, whose drawing is taken out 140 ms later, and draws in the same panel)
    await ev(`await Tour.start({ chapter: '${a[0]}', step: ${a[1]} })`); await sleep(1300);
    await ev(`await Tour.start({ chapter: '${b[0]}', step: ${b[1]} })`); await sleep(1500);
    await ev(PROBE);
    const r = await ev(`await (async () => { if (!Tour.lit()) return { skip: 'no tour' }; const e = __ph.anchor(); const H = e && __ph.scroller(e); if (!H) return { skip: 'no panel' }; const pos = getComputedStyle(H).position; const d0 = __ph.offset(e, H); const dy = H.scrollTop + 80 <= H.scrollHeight - H.clientHeight ? 80 : -80; H.scrollTop += dy; await new Promise((res) => requestAnimationFrame(res)); const d1 = __ph.offset(e, H); return { pos, hosted: Tour.lit().hosted, d0, d1, dy }; })()`);
    OUT.race.push(Object.assign({ id: `${a.join('/')} then ${b.join('/')}` }, r, { ok: !r.skip && r.pos !== 'static' && r.d1 != null && r.d1 < 1.5 }));
    await ev('Tour.isActive() && Tour.stop()'); await sleep(400);
  }
}
if (CFG.rotate) {
  const [W, H] = CFG.sizes[0];
  for (const [ch, st] of [['views', 5], ['edit', 4], ['analysis', 3], ['basics', 1]]) {
    await open(W, H, 'en', `ph${CFG.tag}o${ch}`);
    await startAt(ch, st);
    await setView(H, W); await sleep(1500);
    const r = await ev(`(() => { const L = Tour.lit(); const cb = document.querySelector('[data-tour=card]').getBoundingClientRect(); const ov = L.work.reduce((s, h) => s + Math.max(0, Math.min(cb.right, h.r) - Math.max(cb.left, h.l)) * Math.max(0, Math.min(cb.bottom, h.b) - Math.max(cb.top, h.t)), 0); return { work: L.work.length, mini: !!L.mini, card: [cb.left, cb.top, cb.right, cb.bottom].map(Math.round), over: Math.round(ov) }; })()`);
    OUT.rotate.push(Object.assign({ id: `${ch}/${st}` }, r, { ok: (r.work ? r.over === 0 : !r.mini) }));
    await ev('Tour.isActive() && Tour.stop()'); await sleep(300);
  }
  await setView(W, H);
}

// (the emulation stays on the daemon's page: the next command, tour_cmd or the audit, must not inherit the notch)
try { await send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 0, left: 0, right: 0 } }); } catch (e) { /* */ }
await send('Emulation.setTouchEmulationEnabled', { enabled: false, maxTouchPoints: 1 });
await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

const EXC = logs().filter((l) => l.t === 'EXC');
const sum = {
  tag: CFG.tag, page: CFG.page,
  scroll: OUT.scroll.map((r) => ({ size: r.size, id: r.id, hosted: r.hosted, skip: r.skip, ringHidden: r.ringHiddenFrames, lost: r.lostGestures, screenMax: r.screen && r.screen.max, screenP95: r.screen && r.screen.p95, screenN: r.screen && r.screen.n, pageMax: r.page && r.page.max, pageP95: r.page && r.page.p95 })),
  urlbar: OUT.urlbar.map((r) => ({ size: r.size, id: r.id, pageMax: r.page.max, pageP95: r.page.p95, firstFrame: r.firstFrame, screenEdgeGap: r.screenEdgeGap })),
  pinch: OUT.pinch,
  work: { steps: OUT.work.length, over: OUT.work.filter((r) => r.over > 0).length, maxOver: Math.max(0, ...OUT.work.map((r) => r.over)), maxDepth: Math.max(0, ...OUT.work.map((r) => r.depth)), mini: OUT.work.filter((r) => r.mini).length,
    touchBlocked: OUT.work.reduce((s, r) => s + r.blocked, 0), touchTried: OUT.work.reduce((s, r) => s + r.tried, 0), touchScrollOnly: OUT.work.reduce((s, r) => s + (r.scrollOnly || 0), 0), smallButtons: OUT.work.reduce((s, r) => s + r.small, 0), buttonsOut: OUT.work.reduce((s, r) => s + r.out, 0), outOfView: OUT.work.filter((r) => !r.inView).length,
    overSteps: OUT.work.filter((r) => r.over > 0).map((r) => `${r.size} ${r.lang} ${r.id} ${r.over}px² ${r.depth}px`),
    foldBad: OUT.work.filter((r) => r.foldBad).length, truncTitles: OUT.work.filter((r) => r.trunc).map((r) => `${r.size} ${r.lang} ${r.id}`),
    bySize: Object.fromEntries([...new Set(OUT.work.map((r) => r.size))].map((z) => [z, { steps: OUT.work.filter((r) => r.size === z).length, mini: OUT.work.filter((r) => r.size === z && r.mini).length, over: OUT.work.filter((r) => r.size === z && r.over > 0).length }])) },
  tries: OUT.tries, race: OUT.race, rotate: OUT.rotate,
  fold: OUT.fold,
  exceptions: EXC.length, exc: EXC.slice(0, 3),
};
fs.mkdirSync(DIR + '/phone', { recursive: true });
fs.writeFileSync(`${DIR}/phone/${CFG.tag}.json`, JSON.stringify({ sum, rows: OUT }, null, 1));
return sum;
