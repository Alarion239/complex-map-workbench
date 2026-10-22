'use strict';
// Visual and numeric test of the GL renderer (GLR). Renders every feature into canvases, synchronously on load.
// ?theme=dark uses the dark token set; ?only=grid,patterns,lines,color,land,sphere,perf limits the sections.
(function () {
  const R = window.__glTest = { errors: [], compare: [], timings: {}, glErrors: [], done: false };
  const qs = new URLSearchParams(location.search);
  const THEME = qs.get('theme') === 'dark' ? 'dark' : 'light';
  const ONLY = (qs.get('only') || '').split(',').filter(Boolean);
  const want = (s) => !ONLY.length || ONLY.includes(s);
  if (THEME === 'dark') document.documentElement.dataset.theme = 'dark';
  const LIGHT = {
    plane: '#FCFDFD', minor: '#E2EEF2', medium: '#D3E6ED', major: '#B5D4E0', axis: '#2E3D47', ink: '#121A20', halo: '#FCFDFD', haloA: 0.85,
    shapes: [['#3B6FD4', '#093B9B', '#8CABE5'], ['#CD821A', '#8A560B', '#F0C598'], ['#12938F', '#0A5C5A', '#8EC3C0'], ['#BC4E98', '#831466', '#DD9DC5']],
    shrink: '#2E69B2', grow: '#D79628', mid: '#E9F0F2', dcLine: '#FFFFFF', dcCasing: '#0B1114',
    landTop: '#F5F8F9', landBottom: '#DCE4E7', floor: '#FAFCFC', box: '#B3BEC4', modLine: '#18232A', argLine: '#FFFFFF', plaster: '#ECEEEC',
    shadow: '#2E3D47', shadowA: 0.30, hemiSky: '#E6EEF4', hemiGround: '#8C9296', accent: '#0A6A87', cut: '#CC3311', probe: '#121A20',
  };
  const DARK = {
    plane: '#0D1317', minor: '#14212A', medium: '#1A2D38', major: '#21404F', axis: '#94A8B3', ink: '#E3EAEE', halo: '#0D1317', haloA: 0.85,
    shapes: [['#3B6FD4', '#79A7FA', '#1F4591'], ['#CD821A', '#FBBD78', '#925B0A'], ['#12938F', '#74C5C1', '#096260'], ['#BC4E98', '#EA8EC9', '#802E67']],
    shrink: '#2E69B2', grow: '#D79628', mid: '#2D3436', dcLine: '#FFFFFF', dcCasing: '#05090B',
    landTop: '#1A252C', landBottom: '#0A1013', floor: '#10181D', box: '#36474F', modLine: '#05090B', argLine: '#FFFFFF', plaster: '#C9CFD2',
    shadow: '#000000', shadowA: 0.55, hemiSky: '#9FB2C0', hemiGround: '#3A3F44', accent: '#52B7D3', cut: '#FF6B3D', probe: '#E3EAEE',
  };
  const T = THEME === 'dark' ? DARK : LIGHT;
  const hx = GLR.hexRGB;
  const out = document.getElementById('out');
  const root = document.getElementById('root');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  const C = CX.C;
  const log = [];
  const say = (s) => { log.push(s); };
  if (!GLR.init()) { out.textContent = 'no webgl2'; R.done = true; return; }
  GLR.syncCompile = true;   // frames are compared right after chain changes: no stand-ins for compiling programs
  const gl = GLR.gl;
  const glCheck = (where) => { const e = gl.getError(); if (e) R.glErrors.push(where + ': 0x' + e.toString(16)); };

  function section(title) {
    const h = document.createElement('h2'); h.textContent = title; root.appendChild(h);
    const row = document.createElement('div'); row.className = 'row'; root.appendChild(row);
    return row;
  }
  function panel(row, label, w, h) {
    const fig = document.createElement('figure');
    const c = document.createElement('canvas');
    c.style.width = w + 'px'; c.style.height = h + 'px';
    c.width = Math.round(w * DPR); c.height = Math.round(h * DPR);
    const cap = document.createElement('figcaption'); cap.textContent = label;
    fig.appendChild(c); fig.appendChild(cap); row.appendChild(fig);
    return { c, cap, ctx: c.getContext('2d'), pw: c.width, ph: c.height, dpr: DPR, w, h };
  }
  function setChain(steps) {
    const st = steps.map(([type, params]) => ({ type, params: Object.assign(Funcs.defaults(type), params || {}), on: true }));
    const built = st.map((s) => Funcs.build(s));
    for (const b of built) if (b.error) throw new Error(b.error);
    GLR.setChain(GLChain.build(st, built));
    return { map: { mode: 0, a: 0, b: st.length }, F: (z) => built.reduce((w, b) => b.f(w), z) };
  }
  const CH = {
    id: [],
    exp: [['exp']],
    sq: [['pown', { n: 2 }]],
    mob: [['mobius', { a: '0', b: '1', c: '1', d: '-1' }]],
    rat: [['custom', { expr: '\\frac{z^2-1}{z^2+1}' }]],
    log: [['log']],
    expmob: [['exp'], ['mobius', { a: '1', b: '-i', c: '1', d: 'i' }]],
  };
  function fitView(pts, w, h, margin = 1.12) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of pts) if (Number.isFinite(p.re) && Number.isFinite(p.im)) { x0 = Math.min(x0, p.re); x1 = Math.max(x1, p.re); y0 = Math.min(y0, p.im); y1 = Math.max(y1, p.im); }
    return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, s: Math.min(w / ((x1 - x0) * margin), h / ((y1 - y0) * margin)) };
  }
  const gridSt = (p, view, extra) => Object.assign({ view, dpr: p.dpr, plane: hx(T.plane), minor: hx(T.minor), medium: hx(T.medium), major: hx(T.major), axis: hx(T.axis), unit: true, unitAlpha: 0.55 }, extra || {});
  function readGL(p) { const a = new Uint8Array(p.pw * p.ph * 4); gl.readPixels(0, 0, p.pw, p.ph, gl.RGBA, gl.UNSIGNED_BYTE, a); return a; }
  function diff(a, b) {
    let n = 0, mx = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]), Math.abs(a[i + 3] - b[i + 3]));
      if (d > 3) n++;
      if (d > mx) mx = d;
    }
    return { bad: n, frac: n / (a.length / 4), max: mx };
  }
  const run = (name, fn) => { try { fn(); } catch (e) { R.errors.push(name + ': ' + (e.stack || e)); console.error(e); } glCheck(name); };

  // shapes
  const disc = { kind: 'disc', c: [1.1, 0.4], r: 0.9 };
  const WIN = { x0: -3, x1: 3, y0: -3, y1: 3 };
  const discMesh = Region.buildMesh(disc, WIN, 48);
  const discRes = GLR.createMesh(Region.meshInstances(discMesh));
  const discLines = GLR.createLines(Region.curvesOf(disc, WIN).map((c) => Region.sampleCurve(c, WIN)));
  const boundaryPts = (F) => { const out = []; for (let i = 0; i < 256; i++) { const t = 2 * Math.PI * i / 256; out.push(F(C(1.1 + 0.9 * Math.cos(t), 0.4 + 0.9 * Math.sin(t)))); } return out; };
  const [c0, k0, c1] = T.shapes[0].map(hx);
  const regionSt = (p, view, map, pattern, extra) => Object.assign({
    map, view, dpr: p.dpr, L: 4, color: c0, color2: c1, edge: k0, ink: hx(T.ink), alpha: 0.85, pattern, cell: 0.2, lines: false,
    stretch: { shrink: hx(T.shrink), grow: hx(T.grow), mid: hx(T.mid) }, fade: null, cacheKey: null,
  }, extra || {});
  const edgeSt = (p, view, map, k) => ({ map, view, dpr: p.dpr, M: 8, width: 1.5 * p.dpr, color: k, alpha: 1, casing: { color: hx(T.halo), alpha: T.haloA, width: 3.5 * p.dpr } });

  // ---------------- 1. graph paper ----------------
  if (want('grid')) run('grid', () => {
    const row = section(`Graph paper tiers, axes, unit circle (${THEME})`);
    setChain(CH.id);
    for (const [s, cx, cy] of [[2.2, 3, 1], [9, 0.4, 0.2], [26, 0.3, -0.2], [64, 0.5, 0.3], [140, 0.6, 0.4], [420, 0.92, 0.25], [1500, 1.002, 0.01], [9000, 0.0005, 0.0003]]) {
      const p = panel(row, `s = ${s} px/unit`, 200, 150);
      GLR.begin(p.pw, p.ph);
      GLR.drawGrid(gridSt(p, { cx, cy, s }));
      GLR.blit(p.ctx);
    }
    // the portrait overlay variant
    const p = panel(row, 'overlay (portrait)', 200, 150);
    setChain(CH.rat);
    const view = { cx: 0, cy: 0, s: 40 };
    GLR.begin(p.pw, p.ph);
    GLR.drawColorPlot({ map: { mode: 0, a: 0, b: 1 }, view, dpr: p.dpr, style: 'enhanced', sectors: 12, plane: hx(T.plane), ink: hx(T.ink), dark: THEME === 'dark' });
    GLR.drawGrid({ view, dpr: p.dpr, unit: false, overlay: { color: hx(T.dcLine), alpha: 0.22, axisAlpha: 0.7, casing: hx(T.dcCasing), casingAlpha: 0.4 } });
    GLR.blit(p.ctx);
  });

  // ---------------- 2. patterns ----------------
  const PATS = ['checker', 'polar', 'grid', 'polargrid', 'tiles', 'phase', 'stretch', 'solid'];
  if (want('patterns')) run('patterns', () => {
    for (const [cname, label] of [['id', 'z (domain)'], ['exp', 'exp z'], ['sq', 'z^2']]) {
      const ch = setChain(CH[cname]);
      const W = 196, H = 156;
      const view = fitView(boundaryPts(ch.F), W, H, 1.18);
      const rowC = section(`Patterns under ${label}, cached (${THEME})`);
      const rowD = cname === 'id' ? null : section(`Patterns under ${label}, direct (${THEME})`);
      for (const pat of PATS) {
        for (const cached of rowD ? [true, false] : [true]) {
          const p = panel(cached ? rowC : rowD, pat + (pat === 'checker' || pat === 'solid' ? ' + net' : ''), W, H);
          const st = regionSt(p, view, ch.map, pat, { lines: pat === 'checker' || pat === 'solid' || pat === 'phase', cacheKey: cached ? 'disc|' + cname : null, origin: pat === 'polar' || pat === 'polargrid' ? [1.1, 0.4] : null });
          GLR.begin(p.pw, p.ph);
          GLR.drawGrid(gridSt(p, view));
          GLR.drawRegion(discRes, st);
          const pxR = readGL(p);   // fills alone: the cached and direct paths must agree
          GLR.drawLines(discLines, Object.assign(edgeSt(p, view, ch.map, k0), { cacheKey: cached ? 'discL|' + cname : null }));
          const px = pxR;
          GLR.blit(p.ctx);
          if (rowD) {
            if (cached) p.__px = px, R.__last = px;
            else {
              const d = diff(R.__last, px);
              R.compare.push({ map: cname, pattern: pat, ...d });
              p.cap.textContent += `  diff ${d.bad}px max ${d.max}`;
            }
          }
        }
      }
    }
    delete R.__last;
  });

  // ---------------- 3. lines with casing ----------------
  if (want('lines')) run('lines', () => {
    const row = section(`Curves with casing (${THEME})`);
    const grid = { kind: 'cgrid', a: [0.3, -0.9], b: [1.5, 0.9], n: 6 };
    const circ = { kind: 'circle', c: [0.8, 0.2], r: 0.5 };
    const seg = { kind: 'segment', a: [-1.2, -0.8], b: [1.4, 1.1] };
    const mk = (s) => GLR.createLines(Region.curvesOf(s, WIN).map((c) => Region.sampleCurve(c, WIN)));
    const gl1 = mk(grid), gl2 = mk(circ), gl3 = mk(seg);
    for (const [cname, label] of [['id', 'z'], ['sq', 'z^2'], ['exp', 'exp z'], ['mob', '1/(z-1)']]) {
      const ch = setChain(CH[cname]);
      const view = cname === 'mob' ? { cx: 0, cy: 0, s: 30 } : fitView([...[-1.2, 1.5].flatMap((x) => [-0.9, 1.1].map((y) => ch.F(C(x, y))))], 220, 170, 1.3);
      for (const cached of [false, true]) {
        const p = panel(row, `${label}${cached ? ' cached' : ''}`, 220, 170);
        GLR.begin(p.pw, p.ph);
        GLR.drawGrid(gridSt(p, view));
        const ck = (k) => (cached ? k + cname : null);
        GLR.drawLines(gl1, { map: ch.map, view, dpr: p.dpr, M: 8, width: 1 * p.dpr, color: hx(T.shapes[2][1]), alpha: 0.8, casing: { color: hx(T.halo), alpha: T.haloA, width: 2.5 * p.dpr }, cacheKey: ck('g') });
        GLR.drawLines(gl2, { map: ch.map, view, dpr: p.dpr, M: 8, width: 2 * p.dpr, color: hx(T.shapes[1][1]), alpha: 1, casing: { color: hx(T.halo), alpha: T.haloA, width: 4 * p.dpr }, cacheKey: ck('c') });
        GLR.drawLines(gl3, { map: ch.map, view, dpr: p.dpr, M: 8, width: 2 * p.dpr, color: hx(T.shapes[3][1]), alpha: 1, casing: { color: hx(T.halo), alpha: T.haloA, width: 4 * p.dpr }, cacheKey: ck('s') });
        const px = readGL(p);
        GLR.blit(p.ctx);
        if (!cached) R.__l = px;
        else { const d = diff(R.__l, px); R.compare.push({ map: cname, pattern: 'lines', ...d }); p.cap.textContent += `  diff ${d.bad}px`; }
      }
    }
    delete R.__l;
  });

  // ---------------- 4. phase portraits ----------------
  if (want('color')) run('color', () => {
    for (const [cname, label] of [['rat', '(z^2-1)/(z^2+1)'], ['log', 'log z']]) {
      const row = section(`Phase portrait of ${label} (${THEME})`);
      const ch = setChain(CH[cname]);
      for (const style of ['enhanced', 'phase', 'classic', 'modulus', 'grid']) {
        const p = panel(row, { enhanced: 'Tiles', phase: 'Phase', classic: 'Modulus', modulus: 'Contours', grid: 'Grid' }[style], 236, 200);
        const view = { cx: 0, cy: 0, s: 236 / 4.4 };
        GLR.begin(p.pw, p.ph);
        GLR.drawColorPlot({ map: ch.map, view, dpr: p.dpr, style, sectors: 12, grid: 0.5, plane: hx(T.plane), ink: hx(T.ink), dark: THEME === 'dark' });
        GLR.drawGrid({ view, dpr: p.dpr, unit: false, overlay: { color: hx(T.dcLine), alpha: 0.22, axisAlpha: 0.7, casing: hx(T.dcCasing), casingAlpha: 0.4 } });
        GLR.blit(p.ctx);
      }
    }
    // the LUT stops at L 0.75 against the spec's hex values
    const stops = ['#F58C7E', '#EA9853', '#CFA93E', '#A5B953', '#6EC580', '#27C8AF', '#1CC3D8', '#53B8F7', '#8EAAFD', '#B99BF5', '#DB8FD6', '#F089AC'];
    R.lutStops = stops.map((h, i) => {
      const a = GLR.phaseRGB(i * Math.PI / 6, 0.75).map((x) => Math.round(x * 255)), b = hx(h).map((x) => Math.round(x * 255));
      return { spec: h, lut: '#' + a.map((x) => x.toString(16).padStart(2, '0')).join('').toUpperCase(), d: Math.max(...a.map((x, k) => Math.abs(x - b[k]))) };
    });
  });

  // ---------------- 5. landscape ----------------
  function median(a) { const b = a.filter(Number.isFinite).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : 1; }
  function landPanel(row, label, ch, box, opts) {
    const p = panel(row, label, opts.w || 300, opts.h || 230);
    const ctx = p.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, p.ph);
    g.addColorStop(0, T.landTop); g.addColorStop(1, T.landBottom);
    ctx.fillStyle = g; ctx.fillRect(0, 0, p.pw, p.ph);
    const vals = [];
    for (let j = 0; j < 32; j++) for (let i = 0; i < 32; i++) {
      const w = ch.F(C(box.x0 + (box.x1 - box.x0) * (i + 0.5) / 32, box.y0 + (box.y1 - box.y0) * (j + 0.5) / 32));
      vals.push(opts.heightMode === 're' ? Math.abs(w.re) : opts.heightMode === 'im' ? Math.abs(w.im) : Math.hypot(w.re, w.im));
    }
    const mu = median(vals);
    const fov = 28 * Math.PI / 180;
    const cam = Object.assign({ yaw: -38 * Math.PI / 180, pitch: 30 * Math.PI / 180, dist: Math.hypot(1, 1, 0.7) / Math.sin(fov / 2) * 1.05, tx: 0, ty: 0, tz: -0.12, fov }, opts.cam || {});
    GLR.begin(p.pw, p.ph);
    const info = GLR.drawLandscape(Object.assign({
      map: ch.map, box, cam, heightMode: 'log', scale: 1, mu, material: 'phase', unitLevel: false, sectors: 12, cells: 256, L: 3, dpr: p.dpr,
      colors: {
        floor: hx(T.floor), box: hx(T.box), modLine: hx(T.modLine), argLine: hx(T.argLine), plaster: hx(T.plaster), shadow: hx(T.shadow), shadowA: T.shadowA,
        hemiSky: hx(T.hemiSky), hemiGround: hx(T.hemiGround), accent: hx(T.accent), minor: hx(T.minor), medium: hx(T.medium), major: hx(T.major), landBottom: hx(T.landBottom), cut: hx(T.cut), probe: hx(T.probe),
      },
      outlines: opts.outlines || [], probe: opts.probe || null,
    }, opts, { cam }));
    GLR.blit(ctx);
    return { p, info, mu };
  }
  if (want('land')) run('land', () => {
    const box = { x0: -2, x1: 2, y0: -2, y1: 2 };
    const row = section(`Landscape of (z^2-1)/(z^2+1): height modes (${THEME})`);
    const ch = setChain(CH.rat);
    const outl = [{ res: discLines, color: k0 }];
    for (const hm of ['log', 'abs', 're', 'im']) landPanel(row, `height ${hm}, phase`, ch, box, { heightMode: hm, outlines: outl });
    const row2 = section(`Landscape materials, unit level, probe (${THEME})`);
    landPanel(row2, 'tiles material', ch, box, { material: 'tiles' });
    landPanel(row2, 'plaster material', ch, box, { material: 'plaster' });
    const r = landPanel(row2, 'unit level + probe at 0.6+0.3i', ch, box, { unitLevel: true, probe: { x: 0.6, y: 0.3 }, outlines: outl });
    R.landInfo = { floorZ: r.info.floorZ, top: r.info.top, h1: r.info.heightOf(1), h10: r.info.heightOf(10) };
    const chl = setChain(CH.log);
    landPanel(row2, 'log z: cliff along the cut', chl, box, { material: 'phase', cam: { yaw: -120 * Math.PI / 180 } });
    const che = setChain(CH.exp);
    landPanel(row2, 'exp z, abs, scale 0.6', che, { x0: -2, x1: 2, y0: -3, y1: 3 }, { heightMode: 'abs', scale: 0.6, material: 'tiles' });
    landPanel(row2, 'top view', ch, box, { cam: { pitch: 88 * Math.PI / 180 } });
  });

  // ---------------- 6. sphere ----------------
  if (want('sphere')) run('sphere', () => {
    const fov = 28 * Math.PI / 180;
    const cam = { yaw: -60 * Math.PI / 180, pitch: 18 * Math.PI / 180, dist: 1 / Math.sin(fov / 2) * 1.32, tx: 0, ty: 0, tz: 0, fov };
    const row = section(`Riemann sphere (${THEME})`);
    const sp = (label, opts) => {
      const p = panel(row, label, 260, 230);
      const ctx = p.ctx;
      const g = ctx.createLinearGradient(0, 0, 0, p.ph);
      g.addColorStop(0, T.landTop); g.addColorStop(1, T.landBottom);
      ctx.fillStyle = g; ctx.fillRect(0, 0, p.pw, p.ph);
      GLR.begin(p.pw, p.ph);
      const info = GLR.drawSphere(Object.assign({
        map: opts.map, mode: 'image', cam: Object.assign({}, cam, opts.cam || {}), style: 'enhanced', sectors: 12, grid: 0.5, dpr: p.dpr,
        colors: { plane: hx(T.plane), gridMajor: hx(T.major), axis: hx(T.axis), ink: hx(T.ink), accent: hx(T.accent), hemiSky: hx(T.hemiSky), hemiGround: hx(T.hemiGround) },
        regions: [], lines: [], plane: false, probe: null,
      }, opts));
      GLR.blit(ctx);
      return info;
    };
    let ch = setChain(CH.id);
    const regs = (map, pat, ck) => [{ res: discRes, st: { map, dpr: DPR, L: 4, color: c0, color2: c1, edge: k0, ink: hx(T.ink), alpha: 0.85, pattern: pat, cell: 0.2, lines: false, cacheKey: ck } }];
    const lns = (map) => [{ res: discLines, st: { map, dpr: DPR, M: 8, width: 1.5 * DPR, color: k0, alpha: 1 } }];
    sp('regions: disc (identity)', { map: ch.map, regions: regs(ch.map, 'checker', 'sid'), lines: lns(ch.map) });
    ch = setChain(CH.mob);
    sp('regions: 1/(z-1) closes at infinity', { map: ch.map, regions: regs(ch.map, 'checker', 'smob'), lines: lns(ch.map), cam: { pitch: 40 * Math.PI / 180 } });
    sp('tiles pattern, plane + probe', { map: ch.map, regions: regs(ch.map, 'tiles', null), lines: lns(ch.map), plane: true, probe: { w: [0.7, -0.5] }, cam: { pitch: 30 * Math.PI / 180 } });
    ch = setChain(CH.rat);
    sp('phase: Tiles', { map: ch.map, mode: 'color', style: 'enhanced' });
    sp('phase: Phase', { map: ch.map, mode: 'color', style: 'phase' });
    sp('phase: Modulus', { map: ch.map, mode: 'color', style: 'classic', cam: { pitch: -20 * Math.PI / 180 } });
  });

  // ---------------- 7. timings ----------------
  if (want('perf')) run('perf', () => {
    const row = section('Timing: 120-base disc mesh, L = 4, exp then Mobius');
    const big = { kind: 'disc', c: [0, 0], r: 1.5 };
    const mesh = Region.buildMesh(big, { x0: -2, x1: 2, y0: -2, y1: 2 }, 120);
    const res = GLR.createMesh(Region.meshInstances(mesh));
    const ch = setChain(CH.expmob);
    const p = panel(row, `${res.n} base triangles, ${res.n * 16} sub-triangles`, 360, 300);
    const view0 = fitView(Array.from({ length: 256 }, (_, i) => ch.F(C(1.5 * Math.cos(i * Math.PI / 128), 1.5 * Math.sin(i * Math.PI / 128)))), 360, 300, 1.1);
    const sync = () => { gl.finish(); const b = new Uint8Array(4); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, b); };
    const frame = (view, key) => {
      GLR.begin(p.pw, p.ph);
      GLR.drawRegion(res, regionSt(p, view, ch.map, 'checker', { cacheKey: key, lines: true }));
    };
    const time = (n, fn) => { const ts = []; for (let i = 0; i < n; i++) { const t0 = performance.now(); fn(i); sync(); ts.push(performance.now() - t0); } ts.sort((a, b) => a - b); return { median: +ts[n >> 1].toFixed(2), min: +ts[0].toFixed(2), max: +ts[n - 1].toFixed(2) }; };
    const pan = (i) => ({ cx: view0.cx + 0.01 * i, cy: view0.cy, s: view0.s });
    frame(view0, null); sync();            // compile
    const direct = time(15, (i) => frame(pan(i), null));
    GLR.clearCaches();
    frame(view0, 'warm'); sync(); GLR.clearCaches();   // compile the TF and cached programs
    const build = time(1, () => frame(view0, 'perf'));
    const cached = time(30, (i) => frame(pan(i), 'perf'));
    const rebuild = time(6, (i) => { GLR.clearCaches(); frame(pan(i), 'perf'); });
    R.timings = { baseTriangles: res.n, subTriangles: res.n * 16, dpr: DPR, canvas: [p.pw, p.ph], directMs: direct, cachedFirstFrameMs: build, cachedPanMs: cached, cachedRebuildMs: rebuild };
    frame(view0, 'perf');
    GLR.blit(p.ctx);
  });

  R.done = true;
  const sum = {
    theme: THEME, dpr: DPR, errors: R.errors, glErrors: R.glErrors, glrError: GLR.error,
    compare: R.compare.map((c) => `${c.map}/${c.pattern}: ${c.bad} px differ (max ${c.max})`),
    lutStops: R.lutStops, land: R.landInfo, timings: R.timings,
  };
  out.textContent = JSON.stringify(sum, null, 1);
})();
