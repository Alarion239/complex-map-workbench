'use strict';
// Constructions demo (proof of concept): a 2D plane and the proposed Objects panel. Uses Constr (constr.js).
(() => {
  const K = Constr;
  const $ = (id) => document.getElementById(id);
  const G = K.graph();
  // ---------------- the scene
  const meta = new Map();          // name -> {ci (palette index), area (fill the left side)}
  function addObj(name, def, m = {}) { G.add(name, def); meta.set(name, Object.assign({ ci: 0 }, m)); }
  function reset() {
    for (const n of G.names().slice().reverse()) if (G.has(n)) G.remove(n);
    meta.clear();
    addObj('a', { kind: 'param', value: 0.5, min: -3, max: 3, step: 0.01 });
    addObj('P', { kind: 'point', at: [-2, -0.5] });
    addObj('Q', { kind: 'point', at: [1, -1] });
    addObj('R', { kind: 'point', at: [-0.5, 1.5] });
    addObj('c', { kind: 'circle3', args: ['P', 'Q', 'R'] }, { ci: 0, area: true });
    addObj('l', { kind: 'line', args: ['P', 'Q'] }, { ci: 1 });
    addObj('g', { kind: 'equation', src: 'Re z = a' }, { ci: 2 });
    addObj('m', { kind: 'equation', src: 'Im z = a' }, { ci: 5 });
    addObj('X1', { kind: 'meet', args: ['c', 'g'], index: 0 });
    addObj('X2', { kind: 'meet', args: ['c', 'g'], index: 1 });
    addObj('S', { kind: 'meet', args: ['g', 'm'], index: 0 });
  }

  // ---------------- theme tokens
  let TH = {};
  function readTheme() {
    const cs = getComputedStyle(document.documentElement), v = (k) => cs.getPropertyValue(k).trim();
    TH = {
      plane: v('--plane'), minor: v('--grid-minor'), medium: v('--grid-medium'), major: v('--grid-major'), axis: v('--axis'), label: v('--axis-label'),
      ink: v('--ink'), muted: v('--muted'), halo: v('--halo'), accent: v('--accent'), warn: v('--warn'),
      c: [1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({ c0: v(`--c${i}`), edge: v(`--c${i}-edge`), alt: v(`--c${i}-alt`) })),
      math: v('--f-math') || 'serif', mono: v('--f-mono') || 'monospace',
    };
  }

  // ---------------- view
  const cv = $('plane'), ctx = cv.getContext('2d');
  const view = { cx: -0.2, cy: 0.2, s: 92 };
  let W = 0, H = 0, dpr = 1;
  const toPx = (z) => [W / 2 + (z[0] - view.cx) * view.s, H / 2 - (z[1] - view.cy) * view.s];
  const toZ = (x, y) => [view.cx + (x - W / 2) / view.s, view.cy - (y - H / 2) / view.s];
  function resize() {
    const r = cv.getBoundingClientRect();
    dpr = window.devicePixelRatio || 1; W = r.width; H = r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    dirty = true;
  }

  // ---------------- drawing
  function niceStep(px) { const raw = px / view.s, p = 10 ** Math.floor(Math.log10(raw)); for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p; return 10 * p; }
  function grid() {
    ctx.fillStyle = TH.plane; ctx.fillRect(0, 0, W, H);
    const major = niceStep(72), minor = major / 5;
    const [x0, y1] = toZ(0, 0), [x1, y0] = toZ(W, H);
    const lines = (step, col) => {
      ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = Math.ceil(x0 / step) * step; x <= x1; x += step) { const X = Math.round(toPx([x, 0])[0]) + 0.5; ctx.moveTo(X, 0); ctx.lineTo(X, H); }
      for (let y = Math.ceil(y0 / step) * step; y <= y1; y += step) { const Y = Math.round(toPx([0, y])[1]) + 0.5; ctx.moveTo(0, Y); ctx.lineTo(W, Y); }
      ctx.stroke();
    };
    lines(minor, TH.minor); lines(major / 2, TH.medium); lines(major, TH.major);
    const [ax, ay] = toPx([0, 0]);
    ctx.strokeStyle = TH.axis; ctx.beginPath(); ctx.moveTo(0, Math.round(ay) + 0.5); ctx.lineTo(W, Math.round(ay) + 0.5); ctx.moveTo(Math.round(ax) + 0.5, 0); ctx.lineTo(Math.round(ax) + 0.5, H); ctx.stroke();
    ctx.font = `400 10px ${TH.mono}`; ctx.fillStyle = TH.label; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let x = Math.ceil(x0 / major) * major; x <= x1; x += major) { if (Math.abs(x) < 1e-9) continue; const [X] = toPx([x, 0]); ctx.fillText(fmtN(x), X, Math.min(H - 14, Math.max(2, ay + 4))); }
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (let y = Math.ceil(y0 / major) * major; y <= y1; y += major) { if (Math.abs(y) < 1e-9) continue; const [, Y] = toPx([0, y]); ctx.fillText(fmtN(y) + 'i', Math.max(28, Math.min(W - 4, ax - 5)), Y); }
  }
  const fmtN = (x) => { const r = Math.round(x * 1000) / 1000; return (r < 0 ? '−' : '') + Math.abs(r); };
  // a curve's path in the view: a line clipped to the (expanded) view, a circle (an arc polyline when huge)
  function curvePath(g) {
    const Gm = K.geomOf(g), diag = Math.hypot(W, H) / view.s, mid = toZ(W / 2, H / 2);
    ctx.beginPath();
    if (Gm.line) {
      const t0 = K.paramNear(g, mid);
      const a = K.onCurve(g, t0 - 2 * diag), b = K.onCurve(g, t0 + 2 * diag);
      ctx.moveTo(...toPx(a)); ctx.lineTo(...toPx(b));
      return { line: true, a, b, Gm };
    }
    if (Gm.r * view.s < 2e5) { const [x, y] = toPx(Gm.c); ctx.arc(x, y, Gm.r * view.s, 0, 2 * Math.PI); return { Gm }; }
    // huge circle: the arc across the view, as a polyline of exact points
    const th = Math.atan2(mid[1] - Gm.c[1], mid[0] - Gm.c[0]), span = 2 * diag / Gm.r, pts = [];
    for (let i = 0; i <= 256; i++) { const t = th - span + 2 * span * i / 256; pts.push([Gm.c[0] + Gm.r * Math.cos(t), Gm.c[1] + Gm.r * Math.sin(t)]); }
    pts.forEach((p, i) => (i ? ctx.lineTo(...toPx(p)) : ctx.moveTo(...toPx(p))));
    return { Gm, pts };
  }
  // fill a generalized circle's left side: disc, complement (evenodd), half-plane (a big polygon on the left)
  function fillArea(g, col) {
    const Gm = K.geomOf(g), diag = Math.hypot(W, H) / view.s, mid = toZ(W / 2, H / 2);
    ctx.fillStyle = col;
    if (Gm.line || Gm.r * view.s >= 2e5) {
      // the left side, locally: the curve across the view closed through points far on its left
      const r = curvePath(g);
      const pts = r.pts || [r.a, r.b], n = [-0, 0];
      const left = (p, q) => { const d = [q[0] - p[0], q[1] - p[1]], L = Math.hypot(...d); return [-d[1] / L, d[0] / L]; };
      const dir = Gm.line ? left(pts[0], pts[pts.length - 1]) : (Gm.inside ? [Gm.c[0] - mid[0], Gm.c[1] - mid[1]] : [mid[0] - Gm.c[0], mid[1] - Gm.c[1]]);
      const L = Math.hypot(...dir), far = 4 * diag;
      n[0] = dir[0] / L * far; n[1] = dir[1] / L * far;
      const last = pts[pts.length - 1], first = pts[0];
      ctx.lineTo(...toPx([last[0] + n[0], last[1] + n[1]])); ctx.lineTo(...toPx([first[0] + n[0], first[1] + n[1]])); ctx.closePath();
      ctx.fill();
      return;
    }
    const [x, y] = toPx(Gm.c);
    ctx.beginPath();
    if (!Gm.inside) ctx.rect(0, 0, W, H);
    ctx.arc(x, y, Gm.r * view.s, 0, 2 * Math.PI);
    ctx.fill('evenodd');
  }
  const alpha = (hex, a) => hex + Math.round(a * 255).toString(16).padStart(2, '0');
  // the label placer (rev 2, review-design 25): 8 candidate offsets around the anchor, nearest first along the given
  // outward direction; a candidate is free when it touches no placed label, no point mark and no stroke sample
  let taken = [], strokes = [];
  const hits = (r) => taken.some((q) => r[0] < q[0] + q[2] && q[0] < r[0] + r[2] && r[1] < q[1] + q[3] && q[1] < r[1] + r[3])
    || strokes.some(([x, y]) => x > r[0] && x < r[0] + r[2] && y > r[1] && y < r[1] + r[3])
    || r[0] < 2 || r[1] < 2 || r[0] + r[2] > W - 2 || r[1] + r[3] > H - 2;
  function place(text, z, out = [0.7, -0.7], gap = 8) {
    const [x, y] = toPx(z), m = /^([A-Za-z])(\d*)$/.exec(text);
    ctx.font = `italic 500 15px ${TH.math}`;
    const w = ctx.measureText(m[1]).width + (m[2] ? 7 * m[2].length + 1 : 0) + 2, h = 15;
    const a0 = Math.atan2(out[1], out[0]), cands = [];
    for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) { const a = a0 + k * Math.PI / 4; cands.push([Math.cos(a), Math.sin(a)]); }
    for (const g of [gap, gap + 8]) for (const [ux, uy] of cands) {
      const cx = x + ux * (g + w / 2), cy = y + uy * (g + h / 2), r = [cx - w / 2, cy - h / 2, w, h];
      if (!hits(r)) { taken.push(r); return [r[0] + 1 - x, r[1] + h - 3 - y]; }
    }
    return null;                         // no free place: the label is left out (the name is in the list)
  }
  function label(text, z, col, dx = 9, dy = -9, out) {
    const off = place(text, z, out);
    if (!off) return;
    [dx, dy] = off;
    const [x, y] = toPx(z), m = /^([A-Za-z])(\d*)$/.exec(text);
    ctx.font = `italic 500 15px ${TH.math}`; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.lineWidth = 3; ctx.strokeStyle = alpha(TH.halo, 0.85); ctx.lineJoin = 'round';
    ctx.strokeText(m[1], x + dx, y + dy); ctx.fillStyle = col; ctx.fillText(m[1], x + dx, y + dy);
    if (m[2]) { const w = ctx.measureText(m[1]).width; ctx.font = `500 10px ${TH.math}`; ctx.strokeText(m[2], x + dx + w + 1, y + dy + 4); ctx.fillText(m[2], x + dx + w + 1, y + dy + 4); }
  }
  let hover = null, sel = null, picks = [], tool = 'move', drag = null, pointer = null, dirty = true;
  function emphasis() {
    const focus = hover;              // hovering an object shows what it is built from; a selection only rings it
    if (!focus || !G.has(focus)) return null;
    // the object, what it is built from and what is built on it: everything a drag of it would touch
    const s = G.ancestors(focus); for (const d of G.dependentsOf(focus)) s.add(d); s.add(focus);
    return s;
  }
  function sampleCurve(g) {
    const Gm = K.geomOf(g), out = [], diag = Math.hypot(W, H) / view.s, mid = toZ(W / 2, H / 2);
    // one sample every 3 px, so a 15 px label cannot sit between two of them
    if (Gm.line) { const n = Math.ceil(2 * diag * view.s / 3), t0 = K.paramNear(g, mid); for (let i = 0; i <= n; i++) out.push(toPx(K.onCurve(g, t0 - diag + 2 * diag * i / n))); }
    else { const n = Math.min(4096, Math.max(96, Math.ceil(2 * Math.PI * Gm.r * view.s / 3))); for (let i = 0; i < n; i++) { const t = 2 * Math.PI * i / n; out.push(toPx([Gm.c[0] + Gm.r * Math.cos(t), Gm.c[1] + Gm.r * Math.sin(t)])); } }
    return out.filter(([x, y]) => x > -20 && y > -20 && x < W + 20 && y < H + 20);
  }
  function draw() {
    grid();
    const emph = emphasis(), dim = (n) => (emph && !emph.has(n) ? 0.3 : 1);
    const names = G.names();
    taken = []; strokes = [];
    for (const n of names) {
      const d = G.get(n).def, v = G.val(n);
      if (K.POINT_KINDS.has(d.kind) && v && !K.isInf(v)) { const [x, y] = toPx(v); taken.push([x - 7, y - 7, 14, 14]); }
      if (v && K.CURVE_KINDS.has(d.kind)) for (const g of (Array.isArray(v) ? v : [v])) strokes.push(...sampleCurve(g));
    }
    // areas first, then curves, then points
    for (const n of names) {
      const v = G.val(n), M = meta.get(n);
      if (!v || !M || !M.area || !K.CURVE_KINDS.has(G.get(n).def.kind)) continue;
      ctx.globalAlpha = dim(n); fillArea(v, alpha(TH.c[M.ci].c0, 0.16)); ctx.globalAlpha = 1;
    }
    for (const n of names) {
      const v = G.val(n), M = meta.get(n);
      if (!v || !K.CURVE_KINDS.has(G.get(n).def.kind)) continue;
      const list = Array.isArray(v) ? v : [v];
      ctx.globalAlpha = dim(n);
      for (const g of list) {
        const col = TH.c[M.ci].edge;
        if (emph && emph.has(n) && (hover === n || sel === n)) { ctx.strokeStyle = alpha(TH.accent, 0.35); ctx.lineWidth = 7; curvePath(g); ctx.stroke(); }
        ctx.strokeStyle = col; ctx.lineWidth = 1.75; curvePath(g); ctx.stroke();
      }
      // the curve's name near the view's centre point of it
      // the curve's name at 85 % of its visible arc (then 70, 55 %), on the outer side
      const g0 = list[list.length - 1], vis = sampleCurve(g0).filter(([x, y]) => x > 8 && y > 16 && x < W - 24 && y < H - 8);
      const own = new Set(vis.map(([x, y]) => x + ',' + y)), keep = strokes;
      strokes = strokes.filter(([x, y]) => !own.has(x + ',' + y));          // its own stroke may touch its label's side
      for (const f of [0.85, 0.7, 0.55, 0.4]) {
        if (!vis.length) break;
        const [px, py] = vis[Math.floor(f * (vis.length - 1))], at = toZ(px, py), G0 = K.geomOf(g0);
        const out = G0.line ? [-G0.d[1], -G0.d[0]] : [px - toPx(G0.c)[0], py - toPx(G0.c)[1]];
        const before = taken.length;
        label(n, at, TH.c[M.ci].edge, 6, -6, out);
        if (taken.length > before) break;
      }
      strokes = keep;
      ctx.globalAlpha = 1;
    }
    for (const n of names) {
      const d = G.get(n).def, v = G.val(n);
      if (!K.POINT_KINDS.has(d.kind) || !v || K.isInf(v)) continue;
      const [x, y] = toPx(v);
      if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      ctx.globalAlpha = dim(n);
      const free = G.draggable(n);
      if (hover === n || sel === n || picks.includes(n)) { ctx.fillStyle = alpha(TH.accent, 0.22); ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.fill(); ctx.strokeStyle = TH.accent; ctx.lineWidth = 1.5; ctx.stroke(); }
      ctx.beginPath(); ctx.arc(x, y, free ? 5.5 : 4.5, 0, 7);
      if (free) { ctx.fillStyle = TH.ink; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = TH.plane; ctx.stroke(); }
      else { ctx.fillStyle = TH.plane; ctx.fill(); ctx.lineWidth = 1.75; ctx.strokeStyle = TH.ink; ctx.stroke(); }
      label(n, v, TH.ink);
      ctx.globalAlpha = 1;
    }
    // the pending picks of a construction tool: a preview through the pointer
    if (pointer && picks.length && TOOLS[tool]) {
      const zs = picks.map((p) => G.val(p)).concat([pointer]);
      let g = null;
      if (tool === 'line' && zs.length === 2) g = K.line2(zs[0], zs[1]);
      if (tool === 'circle3' && zs.length === 3) g = K.circle3(...zs);
      if (tool === 'circle3' && zs.length === 2) g = K.line2(zs[0], zs[1]);
      if (tool === 'circleCP' && zs.length === 2) g = K.circleCP(zs[0], zs[1]);
      if (tool === 'bisector' && zs.length === 2) g = K.bisector(zs[0], zs[1]);
      if (g) { ctx.setLineDash([5, 4]); ctx.strokeStyle = TH.accent; ctx.lineWidth = 1.25; curvePath(g); ctx.stroke(); ctx.setLineDash([]); }
    }
  }

  // ---------------- the Objects panel
  const KIND_TEXT = {
    point: (d) => (d.expr != null ? null : 'free point'),
    line: (d) => `line through ${d.args.join(', ')}`,
    circle3: (d) => `circle through ${d.args.join(', ')}`,
    circleCP: (d) => `circle, centre ${d.args[0]}, through ${d.args[1]}`,
    bisector: (d) => `perpendicular bisector of ${d.args.join(', ')}`,
    midpoint: (d) => `midpoint of ${d.args.join(', ')}`,
    meet: (d) => `${d.args.join(' ∩ ')}, ${d.index ? 'second' : 'first'} point`,
    glider: (d) => `point on ${d.args[0]}`,
  };
  // object names in a sentence set in math italic (only names that exist: 'drag a point' keeps its article)
  const mathify = (s) => s.replace(/\b([A-Za-z])(\d*)\b/g, (m, a, n) => (G.has(m) ? `<i>${a}</i>${n ? `<sub>${n}</sub>` : ''}` : m));
  const fz = (z) => (K.isInf(z) ? '∞' : `${fmt4(z[0])} ${z[1] < 0 ? '−' : '+'} ${fmt4(Math.abs(z[1]))}<i>i</i>`);
  const fmt4 = (x) => { const r = Math.abs(x) < 5e-5 ? 0 : x; return (r < 0 ? '−' : '') + Math.abs(r).toFixed(2); };
  const nameHtml = (n) => { const m = /^([A-Za-z])(\d*)$/.exec(n); return `<i>${m[1]}</i>${m[2] ? `<sub>${m[2]}</sub>` : ''}`; };
  function defText(n) {
    const d = G.get(n).def;
    if (d.kind === 'equation') return eqHtml(d.src);
    if (d.kind === 'circle3') { const v = G.val(n); if (v && K.isLine(v)) return mathify(`line through ${d.args.join(', ')}`) + ' <span class="o-tag">collinear</span>'; }
    const f = KIND_TEXT[d.kind];
    return f ? mathify(f(d) || '') : '';
  }
  const eqHtml = (src) => src.replace(/\bRe\b/g, 'Re').replace(/\bIm\b/g, 'Im').replace(/-/g, '−').replace(/\b([a-zA-Z])\b(?![a-z])/g, (m, a) => (m === 'Re' || m === 'Im' ? m : `<i>${a}</i>`));
  function rowHtml(n) {
    const d = G.get(n).def, v = G.val(n), err = G.err(n), M = meta.get(n) || {};
    const isCurve = K.CURVE_KINDS.has(d.kind), isPt = K.POINT_KINDS.has(d.kind);
    let sw = '';
    if (isCurve) sw = `<span class="o-sw" style="--sw:var(--c${(M.ci || 0) + 1}-edge);--swf:var(--c${(M.ci || 0) + 1})" data-area="${M.area ? 1 : 0}"></span>`;
    else if (isPt) sw = `<span class="o-pt${G.draggable(n) ? ' free' : ''}"></span>`;
    let body = '';
    if (d.kind === 'param') {
      body = `<div class="o-def"><span class="mono">${fmt4(v)}</span></div>
        <div class="o-slider"><span class="mono o-lim">${fmtN(d.min)}</span><input type="range" min="${d.min}" max="${d.max}" step="${d.step}" value="${v}" data-param="${n}" aria-label="${n}"><span class="mono o-lim">${fmtN(d.max)}</span>
        <button class="icon-btn small o-play" data-play="${n}" aria-label="Play ${n}" title="Play"><svg viewBox="0 0 16 16" width="16" height="16"><path d="M5 3.5v9l7.5-4.5z" fill="currentColor"/></svg></button></div>`;
    } else {
      const def = defText(n);
      const valTxt = isPt && v ? `<span class="mono o-val">${fz(v)}</span>` : '';
      body = `<div class="o-def">${def}${def && valTxt ? ' ' : ''}${valTxt}</div>`;
      if (err) body += `<div class="o-err">${mathify(err)}</div>`;
    }
    const used = [...G.directDependents(n)];
    const uses = G.get(n).deps;
    const rel = d.kind === 'param' ? `<div class="o-rel">${used.length ? `used by ${used.map(nameHtml).join(', ')}` : 'not used yet: type its name in any field'}</div>` : (sel === n) ? `<div class="o-rel">${uses.length ? `uses ${uses.map(nameHtml).join(', ')}` : 'free'}${used.length ? ` · used by ${used.map(nameHtml).join(', ')}` : ''}</div>` : '';
    return `<div class="o-row${sel === n ? ' sel' : ''}${err ? ' undef' : ''}" data-name="${n}">${sw || '<span></span>'}<span class="o-name">${nameHtml(n)}${d.kind === 'param' ? ' =' : ''}</span><div class="o-body">${body}${rel}</div></div>`;
  }
  function renderPanel() {
    const names = [...meta.keys()].filter((n) => G.has(n));   // the order they were made in
    const nums = names.filter((n) => ['param', 'list', 'value'].includes(G.get(n).def.kind));
    const pts = names.filter((n) => K.POINT_KINDS.has(G.get(n).def.kind));
    const cur = names.filter((n) => K.CURVE_KINDS.has(G.get(n).def.kind));
    $('numList').innerHTML = nums.map(rowHtml).join('');
    $('curveList').innerHTML = cur.map(rowHtml).join('');
    $('pointList').innerHTML = pts.map(rowHtml).join('');
    $('numCount').textContent = nums.length; $('curveCount').textContent = cur.length; $('pointCount').textContent = pts.length;
  }
  // light updates during a drag: values and errors only (no rebuild of the rows)
  function refreshValues(changed) {
    for (const n of changed) {
      const row = document.querySelector(`.o-row[data-name="${n}"]`);
      if (!row) continue;
      const d = G.get(n).def;
      if (d.kind === 'param') { row.querySelector('.o-def .mono').textContent = fmt4(G.val(n)); const r = row.querySelector('input'); if (document.activeElement !== r) r.value = G.val(n); continue; }
      const html = rowHtml(n), tmp = document.createElement('div'); tmp.innerHTML = html;
      const nb = tmp.firstElementChild;
      if (row.className !== nb.className) row.className = nb.className;
      const b0 = row.querySelector('.o-body'), b1 = nb.querySelector('.o-body');
      if (b0.innerHTML !== b1.innerHTML) b0.innerHTML = b1.innerHTML;
    }
  }

  // ---------------- tools
  const TOOLS = {
    move: { n: 0, hint: 'Drag a black point or a slider; everything built on it follows. Drag empty space to pan.' },
    point: { n: 1, hint: 'Click to place a free point.' },
    line: { n: 2, kind: 'line', hint: 'Line through two points: click a point or empty space ({k} of 2).' },
    circle3: { n: 3, kind: 'circle3', hint: 'Circle through three points: click a point or empty space ({k} of 3).', area: true },
    circleCP: { n: 2, kind: 'circleCP', hint: 'Circle by centre and point: click the centre, then a point on it ({k} of 2).' },
    bisector: { n: 2, kind: 'bisector', hint: 'Perpendicular bisector: click two points ({k} of 2).' },
    meet: { n: 2, curves: true, hint: 'Intersection: click two curves ({k} of 2).' },
  };
  function setTool(t) {
    tool = t; picks = [];
    for (const b of document.querySelectorAll('#tools [data-tool]')) b.setAttribute('aria-pressed', String(b.dataset.tool === t));
    showHint(); dirty = true;
  }
  function showHint() { const T = TOOLS[tool]; $('hint').textContent = T.hint.replace('{k}', picks.length + 1); }
  const USED = () => new Set(G.names());
  function nextName(upper) {
    const set = USED(), letters = upper ? 'ABCDEFGHJKLMNOPQRSTUVW' : 'cdfghklmnpqstuv';
    for (const L of letters) if (!set.has(L)) return L;
    for (let k = 1; ; k++) for (const L of letters) if (!set.has(L + k)) return L + k;
  }
  let ciNext = 3;
  function hitPoint(x, y) {
    let best = null, bd = 12;
    for (const n of G.names()) { const d = G.get(n).def, v = G.val(n); if (!K.POINT_KINDS.has(d.kind) || !v || K.isInf(v)) continue; const [px, py] = toPx(v), dd = Math.hypot(px - x, py - y); if (dd < bd) { bd = dd; best = n; } }
    return best;
  }
  function hitCurve(x, y) {
    const z = toZ(x, y);
    let best = null, bd = 8 / view.s;
    for (const n of G.names()) { const v = G.val(n); if (!v || Array.isArray(v) || !K.CURVE_KINDS.has(G.get(n).def.kind)) continue; const d = Math.abs(K.fOf(v, z)) / 2 * (K.isLine(v) ? 1 : 1); if (d < bd) { bd = d; best = n; } }
    return best;
  }
  const snap = (z) => ($('snapChk').checked ? [Math.round(z[0] * 4) / 4, Math.round(z[1] * 4) / 4] : z);
  function pickPoint(x, y) {
    const h = hitPoint(x, y);
    if (h) return h;
    const n = nextName(true);
    addObj(n, { kind: 'point', at: snap(toZ(x, y)) });
    return n;
  }
  function complete() {
    const T = TOOLS[tool];
    if (T.curves) {
      const [a, b] = picks, ga = G.val(a), gb = G.val(b);
      const twoLines = ga && gb && K.isLine(ga) && K.isLine(gb);
      const n1 = nextName(true); addObj(n1, { kind: 'meet', args: [a, b], index: 0 });
      if (!twoLines) { const n2 = nextName(true); addObj(n2, { kind: 'meet', args: [a, b], index: 1 }); }
    } else {
      const n = nextName(false);
      addObj(n, { kind: T.kind, args: picks.slice() }, { ci: (ciNext++) % 8, area: !!T.area });
      sel = n;
    }
    picks = []; renderPanel(); showHint(); dirty = true;
  }

  // ---------------- pointer
  function evXY(e) { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  cv.addEventListener('pointerdown', (e) => {
    const [x, y] = evXY(e);
    cv.setPointerCapture(e.pointerId);
    if (tool === 'move') {
      const h = hitPoint(x, y);
      if (h && G.draggable(h)) { drag = { name: h }; sel = h; renderPanel(); }
      else if (h) { sel = h; renderPanel(); flash(`${h} is built from ${[...G.get(h).deps].join(', ')}: drag those`); }
      else { const c = hitCurve(x, y); if (c) { sel = c; renderPanel(); } drag = { pan: true, x, y, cx: view.cx, cy: view.cy }; }
      dirty = true; return;
    }
    if (tool === 'point') { const n = nextName(true); addObj(n, { kind: 'point', at: snap(toZ(x, y)) }); sel = n; renderPanel(); dirty = true; return; }
    const T = TOOLS[tool];
    if (T.curves) { const c = hitCurve(x, y); if (!c || picks.includes(c)) { flash('Click a curve'); return; } picks.push(c); }
    else picks.push(pickPoint(x, y));
    if (picks.length === T.n) complete(); else { renderPanel(); showHint(); }
    dirty = true;
  });
  cv.addEventListener('pointermove', (e) => {
    const [x, y] = evXY(e);
    pointer = snap(toZ(x, y));
    if (drag && drag.name) {
      const t0 = performance.now();
      const changed = G.drag(drag.name, snap(toZ(x, y)));
      engineMs = performance.now() - t0;
      refreshValues(changed);
    } else if (drag && drag.pan) {
      view.cx = drag.cx - (x - drag.x) / view.s; view.cy = drag.cy + (y - drag.y) / view.s;
    } else {
      const h = hitPoint(x, y) || hitCurve(x, y);
      if (h !== hover) { hover = h; markRows(); }
      cv.style.cursor = tool !== 'move' ? 'crosshair' : h && G.draggable(h) ? 'grab' : 'default';
    }
    dirty = true;
  });
  const end = () => { drag = null; dirty = true; };
  cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { hover = null; pointer = null; markRows(); dirty = true; });
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = evXY(e), z = toZ(x, y); view.s *= Math.exp(-e.deltaY * 0.0016); const z2 = toZ(x, y); view.cx += z[0] - z2[0]; view.cy += z[1] - z2[1]; dirty = true; }, { passive: false });
  function markRows() { for (const r of document.querySelectorAll('.o-row')) { const n = r.dataset.name, em = emphasis(); r.classList.toggle('hl', !!(em && em.has(n))); } }
  // panel events
  const panel = $('objPanel');
  panel.addEventListener('input', (e) => {
    const n = e.target.dataset.param; if (!n) return;
    const t0 = performance.now(); const ch = G.set(n, +e.target.value); engineMs = performance.now() - t0;
    refreshValues(ch); dirty = true;
  });
  panel.addEventListener('pointerover', (e) => { const r = e.target.closest('.o-row'); const n = r ? r.dataset.name : null; if (n !== hover) { hover = n; markRows(); dirty = true; } });
  panel.addEventListener('pointerleave', () => { hover = null; markRows(); dirty = true; });
  panel.addEventListener('click', (e) => {
    const pb = e.target.closest('[data-play]');
    if (pb) { const n = pb.dataset.play; playing = playing === n ? null : n; pb.classList.toggle('on', playing === n); return; }
    const r = e.target.closest('.o-row'); if (r && !e.target.closest('input')) { sel = sel === r.dataset.name ? null : r.dataset.name; renderPanel(); markRows(); dirty = true; }
  });
  // the Add field: an equation (Re z = b), a number (b = 2), a point (T = 1 + i); a new lowercase name becomes a slider
  $('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const src = $('addInp').value.trim(); if (!src) return;
    try {
      const m = /^([A-Za-z]\d*)\s*=\s*(.+)$/.exec(src);
      let made = [];
      const autoSliders = (s) => { for (const nm of K.namesOf(K.parse(s))) if (!G.has(nm)) { if (/^[a-z]/.test(nm)) { addObj(nm, { kind: 'param', value: 1, min: -5, max: 5, step: 0.01 }); made.push(nm); } else throw new K.FormulaError(`${nm} is not defined`); } };
      if (m && !/z/.test(m[2]) && !G.has(m[1])) {
        const name = m[1], rhs = m[2];
        if (/^-?[\d.]+$/.test(rhs) && /^[a-z]/.test(name)) addObj(name, { kind: 'param', value: +rhs, min: Math.min(-5, +rhs), max: Math.max(5, +rhs), step: 0.01 });
        else { autoSliders(rhs); addObj(name, { kind: /^[A-Z]/.test(name) ? 'point' : 'value', expr: rhs }); }
        sel = name;
      } else {
        autoSliders(src);
        const n = nextName(false); addObj(n, { kind: 'equation', src }, { ci: (ciNext++) % 8 }); sel = n;
      }
      $('addInp').value = ''; $('addErr').textContent = '';
      if (made.length) flash(`Added slider${made.length > 1 ? 's' : ''} ${made.join(', ')}`);
    } catch (err) { $('addErr').textContent = err.message; }
    renderPanel(); dirty = true;
  });
  for (const b of document.querySelectorAll('#tools [data-tool]')) b.addEventListener('click', () => setTool(b.dataset.tool));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { setTool('move'); } });
  let flashT = 0;
  function flash(msg) { const f = $('flash'); f.innerHTML = mathify(msg); f.hidden = false; clearTimeout(flashT); flashT = setTimeout(() => (f.hidden = true), 2200); }
  $('themeBtn').addEventListener('click', () => {
    const r = document.documentElement, cur = r.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    r.dataset.theme = cur === 'dark' ? 'light' : 'dark'; readTheme(); dirty = true;
  });
  $('resetBtn').addEventListener('click', () => { reset(); sel = null; renderPanel(); dirty = true; });

  // ---------------- frame loop
  let playing = null, engineMs = 0, drawMs = 0, lastEng = -1, ems = [], frames = [], lastT = performance.now(), dir = 1;
  function frame(t) {
    frames.push(t - lastT); lastT = t; if (frames.length > 60) frames.shift();
    if (playing) {
      const d = G.get(playing).def; let v = G.val(playing) + dir * (d.max - d.min) / 240;
      if (v > d.max || v < d.min) { dir = -dir; v = Math.max(d.min, Math.min(d.max, v)); }
      const t0 = performance.now(); refreshValues(G.set(playing, v)); engineMs = performance.now() - t0; dirty = true;
    }
    if (engineMs !== lastEng) { lastEng = engineMs; ems.push(engineMs); if (ems.length > 30) ems.shift(); }
    const emed = ems.length ? ems.slice().sort((x, y) => x - y)[ems.length >> 1] : 0;
    if (dirty) { const t0 = performance.now(); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(); drawMs = performance.now() - t0; dirty = false; }
    $('perf').textContent = `update ${emed.toFixed(3)} ms · draw ${drawMs.toFixed(1)} ms · ${G.names().length} objects`;
    requestAnimationFrame(frame);
  }
  // test hooks for the screenshots
  window.__demo = { G, K, view, setTool, toPx, toZ, setSel: (n) => { sel = n; renderPanel(); markRows(); dirty = true; }, setHover: (n) => { hover = n; markRows(); dirty = true; }, redraw: () => { readTheme(); renderPanel(); dirty = true; }, flash };
  readTheme(); reset(); renderPanel(); setTool('move'); resize();
  window.addEventListener('resize', resize);
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { readTheme(); dirty = true; });
  requestAnimationFrame(frame);
})();
