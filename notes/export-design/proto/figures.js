// Export-design prototype, round 2: the example figures, composed from the app copy's art rasters (window.__xdRender,
// art mode: fills only) and vector layers computed here. Each XF.* returns XD.svg's {svg, W, H, boxes, lines, meta}
// plus captionTex. File names and \label come from the scene name (B10), not from the preset.
(() => {
  const XF = (window.XF = {});
  const C = (re, im = 0) => [re, im];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]], sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const div = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const I = C(0, 1);
  const F = (z) => div(sub(z, I), add(z, I));
  const s3 = Math.sqrt(3), P = C((1 + s3) / 2, -(1 + s3) / 2), Q = C((1 - s3) / 2, (s3 - 1) / 2);
  const lamOf = (t) => C(Math.cos(2 * Math.PI * t / 3), Math.sin(2 * Math.PI * t / 3));
  const Ht = (t, z) => { const u = mul(lamOf(t), div(sub(z, P), sub(z, Q))); return div(sub(P, mul(Q, u)), sub(C(1), u)); };
  const HtInf = (t) => div(sub(P, mul(Q, lamOf(t))), sub(C(1), lamOf(t)));
  XF.check = () => { let e = 0; for (const z of [C(2, 0.3), C(-1, 2), C(0.2, -3)]) { const a = Ht(1, z), b = F(z); e = Math.max(e, Math.hypot(a[0] - b[0], a[1] - b[1])); } return { H1vsF: e, F_inf: HtInf(1) }; };
  const realLineUnder = (g) => XD.sample((s) => g(C(Math.tan(s))), -Math.PI / 2 + 1e-7, Math.PI / 2 - 1e-7, 400, 0.0008);

  // ---------- palettes ----------
  // A2: B/W tones 45 % / 14 % grey (L* 58 / 87); A5: point identity by marker shape, letters always black
  const PAL = {
    article: { dark: '#699DCD', light: '#CCDCEE', edge: '#1D4A7A', ink: '#000000', art: 'indexed' },
    homework: { dark: '#5C93C6', light: '#CFDEF0', edge: '#1D4A7A', ink: '#000000', art: 'indexed' },
    mono: { dark: '#8C8C8C', light: '#DBDBDB', edge: '#000000', ink: '#000000', art: 'grey' },
  };
  const PTS = [['dot', '#D55E00'], ['square', '#009E73'], ['tri', '#CC79A7'], ['diamond', '#E69F00']];
  XF.PAL = PAL;
  const comp = (h, a = 0.845) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(255 - (255 - parseInt(h.slice(i, i + 2), 16)) / a))).toString(16).padStart(2, '0')).join('');
  XF.setPalette = async (name) => {
    let st = document.getElementById('xdPal');
    if (!st) { st = document.createElement('style'); st.id = 'xdPal'; document.head.append(st); }
    const p = PAL[name];
    st.textContent = `:root.xd-${name} { --plane: #FFFFFF; --c1: ${comp(p.dark)}; --c1-alt: ${comp(p.light)}; --c1-edge: ${p.dark}; --dc-line-a: 0; --dc-axis-a: 0; }`;
    document.documentElement.className = `xd-${name}`;
    await new Promise((r) => setTimeout(r, 30));
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  };
  XF.stats = [];
  // B2: flat tones at 600 dpi, indexed; continuous tone at 300 dpi
  const render = async (side, box, wpt, pal, o = {}) => {
    const dpi = o.dpi || (PAL[pal].art === 'rgb' ? 300 : 600);
    const r = await window.__xdRender(side, box, wpt, dpi);
    const a = await XD.art(r.url, box, Object.assign({ mode: PAL[pal].art, wpt }, o));
    XF.stats.push({ fig: XD.name, side, w: a.w, h: a.h, enc: a.enc, bytes: a.bytes, dpi });
    return a;
  };
  const aspect = (b) => (b.x1 - b.x0) / (b.y1 - b.y0);
  const maxW = (texs, pt) => Math.max(0, ...texs.map((t) => XD.tex(t, pt).w));
  const tickW = (b, step, tp) => { const d = XD.decimals(step); return maxW(XD.ticks(b.y0, b.y1, step).map((v) => XD.tickTex(v, d)), tp); };
  const head = (x0, x1, y, letter, tag, pt) => (letter ? XD.at(XD.tex(`\\text{${letter}}`, pt), x0, y, 'start', 'base', 'panel-letter') : '') + (tag ? XD.at(XD.tex(tag, pt), x1, y, 'end', 'base', 'panel-letter') : '');

  // ---------- (1) X -> Y: two plane panels and the F arrow ----------
  XF.mapFigure = async (o) => {
    XD.begin(o.name);
    const pal = PAL[o.pal], tp = o.tp, lp = o.lp, A = o.A, B = o.B, D = o.detail;
    const lw = Object.assign({ frame: 0.5, tick: 0.5, edge: 0.6, axis: 0.6, arrow: 0.5 }, o.lw || {});
    const box = o.axes === 'box', ah = 4.6;
    const arrowLab = o.arrow ? XD.tex(o.arrow, o.arrowPt || lp) : null;
    const arrowSpan = Math.max(o.minGut || 26, arrowLab ? arrowLab.w + 12 : 0);
    let mL, gut, mR, top, bottom, gap2 = 0, arrow0, arrow1;
    if (box) {
      // B5: mirrored tick labels only in a two-panel column layout; otherwise every panel's labels on its left
      mL = tickW(A.box, A.step, tp) + 3;
      const bL = o.mirror ? 0 : tickW(B.box, B.step, tp) + 3;
      gut = arrowSpan + 10 + bL;
      mR = o.mirror ? tickW(B.box, B.step, tp) + 3 : 2;
      if (D) gap2 = 10 + tickW(D.box, D.step, tp) + 3;
      top = lp * 1.15 + 3; bottom = tp * 1.05 + 4.2;
    } else {
      const nA = XD.tex(A.titles[0], lp).w, nB = XD.tex(B.titles[0], lp).w;
      mL = 3; gut = ah * 0.3 + 2 + nA + 8 + arrowSpan + 8; mR = ah * 0.3 + 2 + nB + 2;
      top = XD.tex(A.titles[1], lp).a + XD.tex(A.titles[1], lp).d + ah + 5; bottom = 3;
    }
    const h = (o.W - mL - gut - mR - (D ? gap2 : 0)) / (aspect(A.box) + aspect(B.box) + (D ? aspect(D.box) : 0));
    const wA = h * aspect(A.box), wB = h * aspect(B.box);
    const xA = mL, xB = mL + wA + gut, y = top;
    await XF.setPalette(o.pal);
    const artA = await render('L', A.box, wA, o.pal, { fade: A.fade });
    const artB = await render('R', B.box, wB, o.pal);
    const dash = o.open ? '3 2' : null; // A7: one flag drives the figure and the caption
    const curvesA = [{ pts: [[[A.box.x0 - 1, 0], [A.box.x1 + 1, 0]]], w: lw.edge, color: pal.edge, cap: 'butt', dash }];
    const curvesB = [{ pts: realLineUnder(F), w: lw.edge, color: pal.edge, dash, cap: 'butt' }];
    const common = { tickPt: tp, labelPt: lp, axes: o.axes, ink: pal.ink, lw };
    const items = [];
    const pa = XD.panel(Object.assign({}, common, { x: xA, y, w: wA, h, box: A.box, step: A.step, art: [artA], curves: curvesA, points: A.points, ylab: 'left', axisTitles: A.titles, over: A.over }));
    items.push(pa.markup);
    const pb = XD.panel(Object.assign({}, common, { x: xB, y, w: wB, h, box: B.box, step: B.step, art: [artB], curves: curvesB, points: B.points, ylab: o.mirror ? 'right' : 'left', axisTitles: B.titles, over: B.over }));
    items.push(pb.markup);
    const lines = [...pa.lines, ...pb.lines];
    let defs = pa.defs + pb.defs;
    if (box) { items.push(head(xA, xA + wA, y - 3, '(a)', A.tag, lp)); items.push(head(xB, xB + wB, y - 3, '(b)', B.tag, lp)); }
    if (D) {
      const wC = h * aspect(D.box), xC = xB + wB + gap2;
      const artC = await render('R', D.box, wC, o.pal, { dpi: 600 });
      const pc = XD.panel(Object.assign({}, common, { x: xC, y, w: wC, h, box: D.box, step: D.step, art: [artC], curves: [{ pts: realLineUnder(F), w: lw.edge, color: pal.edge }], points: D.points, ylab: 'left' }));
      items.push(pc.markup, head(xC, xC + wC, y - 3, '(c)', B.tag, lp)); defs += pc.defs; lines.push(...pc.lines);
      // the detail marker in (b): 0.5 pt, at least 10 pt a side (nit C), labelled on its flat side
      const X = pb.X, Y = pb.Y, cx = (X(D.box.x0) + X(D.box.x1)) / 2, cy = (Y(D.box.y0) + Y(D.box.y1)) / 2;
      const s = Math.max(10, X(D.box.x1) - X(D.box.x0)) / 2;
      items.push(`<rect x="${(cx - s).toFixed(2)}" y="${(cy - s).toFixed(2)}" width="${(2 * s).toFixed(2)}" height="${(2 * s).toFixed(2)}" fill="none" stroke="${pal.ink}" stroke-width="0.5"/>`);
      items.push(XD.at(XD.tex('\\text{(c)}', tp), cx - s - 1.5, cy - s - 1, 'end', 'bottom', 'marker-label', 0.4));
    }
    const ay = y + h / 2;
    if (box) { arrow0 = xA + wA + 5; arrow1 = xA + wA + 5 + arrowSpan; }
    else { arrow0 = xA + wA + ah * 0.3 + 2 + XD.tex(A.titles[0], lp).w + 8; arrow1 = xB - 8; }
    items.push(XD.mapArrow(arrow0, arrow1, ay, o.arrow, o.arrowPt || lp, lw.arrow, pal.ink));
    let H = y + h + bottom;
    if (o.caption) { const c = XD.caption(o.caption, 0, H + 7, o.W, o.capPt || lp); items.push(c.markup); H += 7 + c.h + 2; }
    return XD.svg({ W: o.W, H, items, defs, meta: o.meta, lines });
  };

  // the Cayley scene's points: Article marks i and F(i); Homework names A-E with shapes (A5)
  const pts = (named) => {
    if (!named) return {
      A: [{ z: [0, 1], label: 'i' }],
      B: [{ z: [0, 0], label: 'F(i)' }, { z: [1, 0], kind: 'ring', r: 1.5 }],
    };
    const m = (i, z, label, at) => ({ z, r: 2.0, kind: PTS[i][0], fill: PTS[i][1], label, at });
    return {
      A: [m(0, [-1, 0], 'A', 'n'), m(1, [0, 0], 'B', 'ne'), m(2, [1, 0], 'C', 'n'), m(3, [0, 1], 'D', 'auto')],
      B: [m(0, [0, 1], "A'", 'auto'), m(1, [-1, 0], "B'", 'auto'), m(2, [0, -1], "C'", 'auto'), m(3, [0, 0], "D'", 'auto'),
        { z: [1, 0], kind: 'ring', r: 2.0, sw: 0.7, label: "E'", at: 'auto' }],
    };
  };
  // captions: en-US, regular (a) as in the figure (B10); homework names only (P1-6); "open" from the same flag (A7)
  XF.capTex = (kind) => ({
    article: '(a) The upper half-plane $\\operatorname{Im} z>0$ with the point $i$. (b) Its image under $F(z)=(z-i)/(z+i)$, the unit disk, with $F(i)=0$. A checkerboard of unit cells in the $z$-plane is carried by $F$; the point at infinity goes to $1$ (open circle).',
    wide: '(a) The upper half-plane $\\operatorname{Im} z>0$ with the point $i$. (b) Its image under $F(z)=(z-i)/(z+i)$, the unit disk, with $F(i)=0$; the point at infinity goes to $1$ (open circle). (c) Detail of (b) near $w=1$, where the image cells accumulate. Shading: a checkerboard of unit cells in the $z$-plane and its image.',
    homework: '$w=(z-i)/(z+i)$ on $\\mathbb{H}$: the points $A$--$E$ and their images $A\'$--$E\'$. Dashed: boundary not included; arrowheads: orientation.',
    film: 'The Cayley map as a deformation: $H_t(\\mathbb{H})$ at (a) $t=0$, (b) $t=1/3$, (c) $t=2/3$ and (d) $t=1$, where $H_t$ is the elliptic M\\"obius map fixing $p=\\tfrac{1+\\sqrt3}{2}(1-i)$ and $q=\\tfrac{1-\\sqrt3}{2}(1-i)$ with $H_t\'(p)=e^{2\\pi i t/3}$, so $H_0=\\mathrm{id}$ and $H_1=F$. Solid: the paths $t\\mapsto H_t(z)$ of $z=i$ (circle), $0$ (square) and $1$ (triangle) up to the frame\'s $t$; dotted: the rest of each path; dashed: the real axis; open circle: $H_t(\\infty)$.',
    phase: 'Phase portrait of $f(z)=(z^3-1)/(z^2+1)$ on $[-2,2]^2$: the color shows $\\arg f(z)$ (key at right) and the thin lines are the level sets $\\arg f\\in\\frac{\\pi}{6}\\mathbb{Z}$. Zeros (dots) at the cube roots of unity; simple poles (open circles) at $\\pm i$.',
    phaseBW: 'Phase portrait of $f(z)=(z^3-1)/(z^2+1)$ on $[-2,2]^2$ as level sets of $\\arg f$ at multiples of $\\pi/6$; heavy: $\\arg f=0$, dashed: $\\arg f=\\pi$. Bands: $\\lfloor\\log_2|f|\\rfloor$ even (gray) or odd (white). Zeros (dots) at the cube roots of unity; simple poles (open circles) at $\\pm i$.',
  }[kind]);
  const segsOf = (tex) => tex.split(/(\$[^$]*\$)/).filter(Boolean).map((s) => (s[0] === '$' ? { m: s.slice(1, -1) } : { t: s.replace(/--/g, '–') }));

  const meta = (name, preset, extra) => ({ app: 'Complex Map Workbench', v: 12, name, preset, scene: { shapes: [{ kind: 'halfplane', a: [0, 0], b: [1, 0] }], steps: [{ type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } }], pattern: 'checker' }, ...extra });
  // B4: periodic patterns end on whole cells (top at 3), the empty part of the window below the boundary
  XF.cayley = (name, Wtex, pal = 'article') => XF.mapFigure({
    name, W: XD.bp(Wtex), pal, tp: 8, lp: 9, axes: 'box', mirror: true, arrow: 'F', minGut: 22,
    A: { box: { x0: -2, x1: 2, y0: -0.5, y1: 3 }, step: 1, tag: 'z', points: pts(false).A },
    B: { box: { x0: -1.25, x1: 1.25, y0: -1.25, y1: 1.25 }, step: 1, tag: 'w', points: pts(false).B },
    meta: meta(name, pal === 'mono' ? 'article-bw' : 'article', { width: Wtex + 'pt', text: '10pt' }),
  });
  XF.cayleyWide = () => XF.mapFigure({
    name: 'cayley-wide', W: XD.bp(510), pal: 'article', tp: 8, lp: 9, axes: 'box', mirror: false, arrow: 'F', minGut: 30,
    A: { box: { x0: -3, x1: 3, y0: -0.5, y1: 3 }, step: 1, tag: 'z', points: pts(false).A },
    B: { box: { x0: -1.25, x1: 1.25, y0: -1.25, y1: 1.25 }, step: 1, tag: 'w', points: pts(false).B },
    detail: { box: { x0: 0.86, x1: 1.04, y0: -0.09, y1: 0.09 }, step: 0.05, points: [{ z: [1, 0], kind: 'ring', r: 1.6 }] },
    meta: meta('cayley-wide', 'article-wide', { width: '510pt', text: '10pt' }),
  });
  // Homework: Overleaf's default article at 11 pt (\linewidth 360 pt) is the default size (UX P0-4)
  XF.homework = (caption) => {
    const H = (X, Y) => XD.at(XD.tex('\\mathbb{H}', 12), X(1.5), Y(1.5), 'middle', 'mid', 'region-name');
    const chev = (X, Y, z, z2) => { const a = [X(z[0]), Y(z[1])], b = [X(z2[0]), Y(z2[1])]; return XD.chevron(a[0], a[1], Math.atan2(b[1] - a[1], b[0] - a[0]), 3.8, PAL.homework.edge, 0.8); };
    return XF.mapFigure({
      name: caption ? 'cayley-hw-docs' : 'cayley-hw', W: XD.bp(360), pal: 'homework', tp: 10, lp: 10.95, axes: 'cross', arrow: 'w=\\dfrac{z-i}{z+i}', arrowPt: 10.95, minGut: 40, open: true,
      lw: { edge: 0.9, axis: 0.6, arrow: 0.6 },
      A: { box: { x0: -2.5, x1: 2.5, y0: -0.7, y1: 2.5 }, step: 1, titles: ['\\operatorname{Re} z', '\\operatorname{Im} z'], points: pts(true).A, fade: { l: 8, r: 8, t: 8 },
        over: (X, Y) => chev(X, Y, [0.5, 0], [0.6, 0]) + H(X, Y) + XD.at(XD.tex('E=\\infty', 9), X(2.5) - 1, Y(0) - 3.5, 'end', 'bottom', 'label', 0.4) },
      B: { box: { x0: -1.45, x1: 1.45, y0: -1.35, y1: 1.45 }, step: 1, titles: ['\\operatorname{Re} w', '\\operatorname{Im} w'], points: pts(true).B,
        over: (X, Y) => chev(X, Y, F(C(0.5)), F(C(0.501))) + XD.at(XD.tex('\\mathbb{D}', 12), X(-1.02), Y(1.05), 'middle', 'mid', 'region-name') },
      caption: caption ? [{ b: 'Figure 1.' }, { t: ' ' }, ...segsOf(XF.capTex('homework'))] : null, capPt: 10.95,
      meta: meta(caption ? 'cayley-hw-docs' : 'cayley-hw', 'homework', { width: '360pt', text: '11pt' }),
    });
  };

  // ---------- (2) the deformation filmstrip ----------
  XF.filmstrip = async () => {
    XD.begin('cayley-deformation');
    const W = XD.bp(510), tp = 8, lp = 9, pal = PAL.article;
    const ts = [[0, '0', '(a)'], [1 / 3, '1/3', '(b)'], [2 / 3, '2/3', '(c)'], [1, '1', '(d)']];
    // P2-15: the shared window is the union of the bounded frames' boxes and the t = 0 window, snapped to whole cells
    let bx = { x0: -2, x1: 2, y0: -1, y1: 2 };
    for (const [t] of ts.slice(1)) for (const seg of realLineUnder((z) => Ht(t, z))) for (const p of seg) { bx.x0 = Math.min(bx.x0, p[0]); bx.x1 = Math.max(bx.x1, p[0]); bx.y0 = Math.min(bx.y0, p[1]); bx.y1 = Math.max(bx.y1, p[1]); }
    const box = { x0: Math.max(-6, Math.floor(bx.x0 - 0.1)), x1: Math.min(6, Math.ceil(bx.x1 + 0.1)), y0: Math.max(-6, Math.floor(bx.y0 - 0.1)), y1: Math.min(6, Math.ceil(bx.y1 + 0.1)) };
    const step = Math.max(box.x1 - box.x0, box.y1 - box.y0) > 6 ? 2 : 1;
    const mL = tickW(box, step, tp) + 3, gap = 8;
    const pw = (W - mL - gap * 3 - 1) / 4, ph = pw / aspect(box);
    // A3: one baseline for all titles, below which the deepest title's depth is reserved; inline fractions
    const titles = ts.map(([, tt, L]) => XD.tex(`\\text{${L}}\\enspace t=${tt}`, lp));
    const dmax = Math.max(...titles.map((it) => it.d)), amax = Math.max(...titles.map((it) => it.a));
    const top = amax + dmax + 3 + 1, base = top - 3 - dmax;
    await XF.setPalette('article');
    const items = [], lines = []; let defs = '';
    const tracked = [[C(0, 1), 0, 'i'], [C(0, 0), 1, '0'], [C(1, 0), 2, '1']];
    for (const [i, [t]] of ts.entries()) {
      await window.__cmwMorph({ T: t });
      await new Promise((r) => setTimeout(r, 120));
      const x = mL + i * (pw + gap);
      const sx = pw / (box.x1 - box.x0), inf = t > 0 ? HtInf(t) : null;
      const fill = inf ? { x: Math.round((inf[0] - box.x0) * sx * 600 / 72), y: Math.round((box.y1 - inf[1]) * sx * 600 / 72), rad: Math.round(5 * 600 / 72), tone: [0x9A, 0xBC, 0xDE] } : null;
      const art = await render('R', box, pw, 'article', { fill });
      const curves = [];
      if (t > 0) curves.push({ pts: [[[box.x0 - 1, 0], [box.x1 + 1, 0]]], w: 0.5, color: '#666', dash: '3 2', cap: 'butt' });
      curves.push({ pts: realLineUnder((z) => Ht(t, z)), w: 0.6, color: pal.edge });
      for (const [z, k] of tracked) {
        if (t < 1) curves.push({ pts: XD.sample((u) => Ht(u, z), t, 1, 64, 0.001), w: 0.7, color: '#444', dash: '0 1.8' });
        if (t > 0) curves.push({ pts: XD.sample((u) => Ht(u, z), 0, t, 64, 0.001), w: 0.6, color: PTS[k][1], casing: 0.4 });
      }
      const points = tracked.map(([z, k, lab]) => ({ z: Ht(t, z), r: 1.9, kind: PTS[k][0], fill: PTS[k][1], label: i === 0 ? lab : null, at: 'auto', lpt: tp }));
      if (inf) points.push({ z: inf, kind: 'ring', r: 1.6 });
      points.push({ z: P, kind: 'cross', r: 1.5, sw: 0.6, label: i === 0 ? 'p' : null, at: 'auto', lpt: tp }, { z: Q, kind: 'cross', r: 1.5, sw: 0.6, label: i === 0 ? 'q' : null, at: 'auto', lpt: tp });
      const p = XD.panel({ x, y: top, w: pw, h: ph, box, step, art: [art], curves, points, axes: 'box', ylab: i === 0 ? 'left' : 'none', tickPt: tp, labelPt: lp, ink: '#000', lw: { frame: 0.5, tick: 0.5 } });
      items.push(p.markup); defs += p.defs; lines.push(...p.lines);
      items.push(XD.at(titles[i], x, base, 'start', 'base', 'title'));
    }
    await window.__cmwMorph({ T: 1 });
    return XD.svg({ W, H: top + ph + tp * 1.05 + 4.2, items, defs, lines, meta: meta('cayley-deformation', 'article-wide', { deformation: { t: [0, 1 / 3, 2 / 3, 1] }, window: box }) });
  };

  // ---------- (3) the phase portrait (M1): colour with level lines and a ring key; B/W as a contour portrait ----------
  const fz = (z) => { const z2 = mul(z, z), z3 = mul(z2, z); return div(sub(z3, C(1)), add(z2, C(1))); };
  // level sets arg f = k pi/6 by marching squares on an n x n grid (branch jumps of arg excluded)
  const levels = (box, n, ks) => {
    const G = [], dx = (box.x1 - box.x0) / n, dy = (box.y1 - box.y0) / n;
    for (let j = 0; j <= n; j++) { const r = []; for (let i = 0; i <= n; i++) { const w = fz(C(box.x0 + i * dx, box.y0 + j * dy)); r.push(Math.atan2(w[1], w[0])); } G.push(r); }
    const out = {};
    for (const k of ks) {
      const th = k * Math.PI / 6, segs = [];
      const g = (v) => { let d = v - th; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI; return d; };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => [a, b, g(G[b][a])]);
        const pts = [];
        for (let e = 0; e < 4; e++) {
          const A = c[e], B = c[(e + 1) % 4];
          if ((A[2] < 0) !== (B[2] < 0) && Math.abs(A[2] - B[2]) < Math.PI) { const s = A[2] / (A[2] - B[2]); pts.push([box.x0 + (A[0] + s * (B[0] - A[0])) * dx, box.y0 + (A[1] + s * (B[1] - A[1])) * dy]); }
        }
        if (pts.length >= 2) segs.push([pts[0], pts[1]]);
        if (pts.length === 4) segs.push([pts[2], pts[3]]);
      }
      out[k] = join(segs);
    }
    return out;
  };
  // chain the cell segments into polylines, so dash patterns run along a whole level line
  const join = (segs) => {
    const key = (p) => `${p[0].toFixed(7)},${p[1].toFixed(7)}`, ends = new Map(), used = new Uint8Array(segs.length);
    segs.forEach((s, i) => { for (const e of [0, 1]) { const k = key(s[e]); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
    const lines = [];
    for (let i = 0; i < segs.length; i++) {
      if (used[i]) continue; used[i] = 1;
      const line = [segs[i][0], segs[i][1]];
      for (const dir of [1, 0]) {
        for (;;) {
          const tip = dir ? line[line.length - 1] : line[0], nb = (ends.get(key(tip)) || []).find((j) => !used[j]);
          if (nb == null) break;
          used[nb] = 1; const s2 = segs[nb], nxt = key(s2[0]) === key(tip) ? s2[1] : s2[0];
          if (dir) line.push(nxt); else line.unshift(nxt);
        }
      }
      lines.push(line);
    }
    return lines;
  };
  // a JS raster (grey modulus bands for B/W): luminance per pixel -> XD.art-compatible grey image
  const bandsArt = async (box, wpt, dpi) => {
    const w = Math.round(wpt * dpi / 72), h = Math.round(w * (box.y1 - box.y0) / (box.x1 - box.x0)), lum = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const z = C(box.x0 + (i + 0.5) / w * (box.x1 - box.x0), box.y1 - (j + 0.5) / h * (box.y1 - box.y0)), f = fz(z), m = Math.log2(Math.hypot(f[0], f[1]));
      lum[j * w + i] = Number.isFinite(m) && (Math.floor(m) & 1) === 0 ? 0xE0 : 0xFF;
    }
    const png = await XD.encodePNG({ w, h, type: 0, data: lum });
    let s = ''; for (let i = 0; i < png.length; i += 0x8000) s += String.fromCharCode.apply(null, png.subarray(i, i + 0x8000));
    return { url: 'data:image/png;base64,' + btoa(s), box, lum, w, h, enc: 'grey', bytes: png.length };
  };
  const ZEROS = [C(1), C(-0.5, s3 / 2), C(-0.5, -s3 / 2)], POLES = [C(0, 1), C(0, -1)];
  XF.phase = async (bw, keyUrl) => {
    XD.begin(bw ? 'phase-bw' : 'phase');
    const W = XD.bp(246), tp = 8, lp = 9, box = { x0: -2, x1: 2, y0: -2, y1: 2 };
    const key = !bw, keyW = key ? 58 : 0;
    const mL = tickW(box, 1, tp) + 3, top = lp * 1.15 + 3, bottom = tp * 1.05 + 4.2;
    const w = W - mL - 4 - keyW, h = w;
    let art;
    if (bw) art = await bandsArt(box, w, 300);
    else { const r = await window.__xdRender('L', box, w, 300); art = await XD.art(r.url, box, { mode: 'rgb', wpt: w }); }
    XF.stats.push({ fig: XD.name, w: art.w, h: art.h, enc: art.enc, bytes: art.bytes, dpi: 300 });
    const ks = [...Array(12).keys()].map((k) => k - 5); // -5..6 -> -5pi/6 .. pi
    const L = levels(box, 220, ks);
    const curves = [];
    for (const k of ks) {
      const heavy = k === 0, pi = k === 6;
      const pts = L[k];
      if (bw) curves.push({ pts, w: heavy || pi ? 0.7 : 0.35, color: '#000', dash: pi ? '3 2' : null, cap: 'butt' });
      else curves.push({ pts, w: 0.35, color: '#1a1a1a', cap: 'butt' });
    }
    const points = [...ZEROS.map((z) => ({ z, r: 1.6, fill: '#000', stroke: '#fff', sw: 0.5 })), ...POLES.map((z) => ({ z, kind: 'ring', r: 1.7, sw: 0.7 }))];
    const p = XD.panel({ x: mL, y: top, w, h, box, step: 1, art: [art], curves, points, axes: 'box', ylab: 'left', tickPt: tp, labelPt: lp, ink: '#000' });
    const items = [p.markup, head(mL, mL + w, top - 3, '', 'z', lp)];
    let defs = p.defs;
    if (key && keyUrl) {
      // the ring key: the app's own colouring of f(z) = z on an annulus, labelled -pi .. pi on its rim
      const kx = mL + w + 6 + keyW / 2, ky = top + h / 2, R = keyW / 2 - 13, r0 = R * 0.55;
      items.push(`<g><clipPath id="${XD.ns}-key"><path d="M${kx - R} ${ky}a${R} ${R} 0 1 0 ${2 * R} 0a${R} ${R} 0 1 0 ${-2 * R} 0ZM${kx - r0} ${ky}a${r0} ${r0} 0 1 1 ${2 * r0} 0a${r0} ${r0} 0 1 1 ${-2 * r0} 0Z" clip-rule="evenodd"/></clipPath>`
        + `<image x="${(kx - R).toFixed(2)}" y="${(ky - R).toFixed(2)}" width="${(2 * R).toFixed(2)}" height="${(2 * R).toFixed(2)}" preserveAspectRatio="none" clip-path="url(#${XD.ns}-key)" xlink:href="${keyUrl}"/>`
        + `<circle cx="${kx}" cy="${ky}" r="${R}" fill="none" stroke="#000" stroke-width="0.5"/><circle cx="${kx}" cy="${ky}" r="${r0}" fill="none" stroke="#000" stroke-width="0.5"/></g>`);
      items.push(XD.at(XD.tex('0', tp), kx + R + 1.5, ky, 'start', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\pi/2', tp), kx, ky - R - 1.5, 'middle', 'bottom', 'key'));
      items.push(XD.at(XD.tex('\\pm\\pi', tp), kx - R - 1.5, ky, 'end', 'mid', 'key'));
      items.push(XD.at(XD.tex('-\\pi/2', tp), kx, ky + R + 1.5, 'middle', 'top', 'key'));
      items.push(XD.at(XD.tex('\\arg f', tp), kx, ky - R - 12, 'middle', 'bottom', 'key'));
    }
    return XD.svg({ W, H: top + h + bottom, items, defs, lines: p.lines, meta: { app: 'Complex Map Workbench', v: 12, name: XD.name, preset: bw ? 'article-bw' : 'article', scene: { steps: [{ type: 'custom', params: { expr: '(z^3-1)/(z^2+1)' } }], view: 'phase' } } });
  };
})();
