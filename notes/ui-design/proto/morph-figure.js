#!/usr/bin/env node
'use strict';
// Prototype of the deformation figure (notes/ui-design/morph-figure.md), revision 2 (after review.md B3, M3, M6).
// One plane holds X (neutral grey), its image F(X) (the carried checkerboard) and the paths t -> H_t(z) of sample
// points with arrowheads. The homotopies are the app's own (src/funcs.js, read-only).
// Everything that was hand-picked in revision 1 is now computed by the rule of morph-figure.md 4-5:
//   - path selection (budget 2.5 per inch, frame margin, hidden-along-ink, head-on-start, crossings, clearance),
//   - label placement (tested against every ink layer; omitted when no position is clear),
//   - the caption (generated from the kept set, the homotopy and the measured path geometry).
// Labels and the caption are typeset by TeX (latex + dvisvgm, glyphs as paths), standing in for MathJax in the app.
//
//   node notes/ui-design/proto/morph-figure.js          -> notes/ui-design/proto/out/*.svg
//
// Needs TeX Live (latex, dvisvgm) on PATH or in /usr/local/texlive/2025/bin/universal-darwin.
const fs = require('fs'), path = require('path'), zlib = require('zlib'), cp = require('child_process'), os = require('os');
const ROOT = path.resolve(__dirname, '../../..');
global.CX = require(path.join(ROOT, 'src/cx.js'));
global.Expr = require(path.join(ROOT, 'src/parse.js'));
const Funcs = require(path.join(ROOT, 'src/funcs.js'));
const { C } = CX;
const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- tokens (light theme, src/page.html)
const TOK = {
  plane: '#FCFDFD', gridMinor: '#E2EEF2', gridMajor: '#B5D4E0', axis: '#2E3D47',
  ink: '#121A20', ink2: '#3E4C56', faint: '#8A969E',
  c1: '#3B6FD4', c1edge: '#093B9B', c1alt: '#8CABE5',
  alpha: 0.85,
};
// figure units: 1 px = 1/96 in (as buildFigure); text 8-9 pt
const PT = 96 / 72;
const DPI = 300;
const FIG = {
  frameW: 0.75, tickW: 0.6, tickMajor: 4, tickMinor: 2.2,
  edgeW: 1.0, dash: '3.2 2.2',                       // F(X) edge (dashed when the set is open)
  srcFill: TOK.ink, srcFillA: 0.07,                  // X: neutral tint (B3.7); colour belongs to the image
  srcEdge: TOK.ink2, srcEdgeW: 0.6,                  // X's outline, over the image
  halfway: false, halfW: 0.6, halfDash: '0.1 1.6',   // the boundary at t = 1/2: off by default (B3.8); dotted ink when on
  perInch: 2.5, maxNodes: 2,                         // path budget (B3.4) and interior points
  minClear: 4, minPaths: 4,                          // beyond 4 paths, each must clear the others by 4 px
  margin: 3,                                         // a path must lie inside the panel by this much (B3.3)
  pathW: 0.65, pathColor: '#1B252C', haloW: 2.0, haloA: 0.85,
  headL: 4.6, headW: 1.75, headNotch: 0.7, dotR: 1.4, dotRing: 2.1,   // M6
  fadePx: [2, 4],                                    // checker fades to its mean below this cell size, device px (B3.6)
};

// ---------------------------------------------------------------- PNG (RGBA, with 300 dpi pHYs)
const CRC_T = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(b) { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC_T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; Buffer.from(rgba.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1); }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const phys = Buffer.alloc(9); const ppm = Math.round(DPI / 0.0254); phys.writeUInt32BE(ppm, 0); phys.writeUInt32BE(ppm, 4); phys[8] = 1;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('pHYs', phys), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// ---------------------------------------------------------------- TeX (latex + dvisvgm, cached)
const TEXBIN = ['/usr/local/texlive/2025/bin/universal-darwin', '/Library/TeX/texbin'].find((d) => fs.existsSync(path.join(d, 'latex')));
const texCacheFile = path.join(OUT, '.texcache.json');
let texCache = {};
try { texCache = JSON.parse(fs.readFileSync(texCacheFile, 'utf8')); } catch (e) { texCache = {}; }
const texMissing = new Map();
let texSeq = 0;
// body: LaTeX (math in $...$); pt: font size; width (bp): a ragged-right paragraph of that width (captions)
function T(body, pt, width = 0) {
  const key = `r2|${pt}|${width}|${body}`;
  const c = texCache[key];
  if (c) return c;
  texMissing.set(key, { body, pt, width });
  return { missing: true, w: body.length * pt * 0.5, h: pt, d: 0, inner: '' };
}
function runTeX() {
  if (!texMissing.size) return false;
  if (!TEXBIN) throw new Error('TeX Live not found');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'morphfig-'));
  const items = [...texMissing.entries()];
  // no line breaks inside formulas (B3.5): relations and binary operators never break
  const doc = ['\\documentclass{article}', '\\usepackage{amsmath,amssymb}', '\\usepackage[active,tightpage]{preview}', '\\setlength\\PreviewBorder{0pt}',
    '\\relpenalty=10000', '\\binoppenalty=10000', '\\begin{document}'];
  for (const [, it] of items) {
    const sz = `\\fontsize{${it.pt}}{${(it.pt * 1.36).toFixed(2)}}\\selectfont`;
    if (it.width) doc.push(`\\begin{preview}\\parbox[t]{${it.width}bp}{${sz}\\raggedright\\noindent ${it.body}}\\end{preview}`);
    else doc.push(`\\begin{preview}${sz}${it.body}\\end{preview}`);
  }
  doc.push('\\end{document}');
  fs.writeFileSync(path.join(dir, 'l.tex'), doc.join('\n'));
  const env = Object.assign({}, process.env, { PATH: `${TEXBIN}:${process.env.PATH}` });
  const r = cp.spawnSync('latex', ['-interaction=nonstopmode', 'l.tex'], { cwd: dir, env, encoding: 'utf8' });
  if (r.status !== 0 && !fs.existsSync(path.join(dir, 'l.dvi'))) throw new Error('latex failed:\n' + r.stdout.slice(-2000));
  cp.spawnSync('dvisvgm', ['--no-fonts', '--bbox=preview', '--page=1-', '-o', 'p%p.svg', 'l.dvi'], { cwd: dir, env, encoding: 'utf8' });
  items.forEach(([key], i) => {
    const files = fs.readdirSync(dir).filter((n) => new RegExp(`^p0*${i + 1}\\.svg$`).test(n));
    const src = fs.readFileSync(path.join(dir, files[0]), 'utf8');
    const vb = src.match(/viewBox='([^']+)'/)[1].split(/\s+/).map(Number);
    let inner = src.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
    const pre = `t${(++texSeq).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    inner = inner.replace(/id='([^']+)'/g, `id='${pre}$1'`).replace(/xlink:href='#([^']+)'/g, `xlink:href='#${pre}$1'`).replace(/\n/g, '');
    texCache[key] = { w: vb[2] * PT, h: -vb[1] * PT, d: (vb[3] + vb[1]) * PT, vb, inner };
  });
  fs.writeFileSync(texCacheFile, JSON.stringify(texCache));
  texMissing.clear();
  return true;
}
// place a typeset item with its baseline at (x, y); anchor start | middle | end; halo: a white casing (labels on the plot)
function texAt(it, x, y, anchor = 'start', halo = false, color = '#000') {
  if (it.missing) return '';
  const left = anchor === 'middle' ? x - it.w / 2 : anchor === 'end' ? x - it.w : x;
  const top = y - it.h;
  const [vx, vy, vw, vh] = it.vb;
  const body = it.inner.replace(/<g /, `<g fill='${color}' `);
  const casing = halo ? `<g stroke='#FFFFFF' stroke-width='1.5' stroke-linejoin='round' fill='#FFFFFF' opacity='0.9'>${it.inner.replace(/<defs>[\s\S]*?<\/defs>/, '')}</g>` : '';
  return `<svg x="${left.toFixed(2)}" y="${top.toFixed(2)}" width="${(vw * PT).toFixed(2)}" height="${(vh * PT).toFixed(2)}" viewBox="${vx} ${vy} ${vw} ${vh}" overflow="visible">${casing}${body}</svg>`;
}

// ---------------------------------------------------------------- geometry
const niceStep = (raw) => { const p = 10 ** Math.floor(Math.log10(raw)); const m = raw / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
const f2 = (v) => (Math.round(v * 100) / 100).toString();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
// a curve s -> w(s) traced adaptively in figure px: polylines, broken where w is not finite or jumps
function trace(f, s0, s1, P, N = 64) {
  const lines = [];
  let cur = null;
  const ev = (s) => { const w = f(s); if (!w || !CX.isFin(w)) return null; const p = P(w); return Math.abs(p[0]) < 2e4 && Math.abs(p[1]) < 2e4 ? p : null; };
  const emit = (p) => {
    if (!p) { if (cur && cur.length > 1) lines.push(cur); cur = null; return; }
    if (!cur) cur = [p]; else cur.push(p);
  };
  const rec = (sa, pa, sb, pb, d) => {
    if (d >= 18) {
      if (pa && pb && Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) > 25) emit(null);
      emit(pb);
      return;
    }
    const sm = 0.5 * (sa + sb), pm = ev(sm);
    if (pa && pb && pm) {
      const L = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      const dev = Math.hypot(pm[0] - 0.5 * (pa[0] + pb[0]), pm[1] - 0.5 * (pa[1] + pb[1]));
      if (d >= 1 && ((L < 1.2 && dev < 0.12) || (dev < 0.04 && d >= 3))) { emit(pb); return; }
    } else if (!pa && !pb && !pm && d >= 5) { emit(null); return; }
    rec(sa, pa, sm, pm, d + 1);
    rec(sm, pm, sb, pb, d + 1);
  };
  let s = s0, p = ev(s0);
  emit(p);
  for (let i = 1; i <= N; i++) { const sb = s0 + (s1 - s0) * i / N, pb = ev(sb); rec(s, p, sb, pb, 0); s = sb; p = pb; }
  emit(null);
  return lines;
}
const dPath = (lines) => lines.map((l) => 'M' + l.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')).join('');
const plen = (l) => { let s = 0; for (let i = 1; i < l.length; i++) s += Math.hypot(l[i][0] - l[i - 1][0], l[i][1] - l[i - 1][1]); return s; };
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
// a polyline resampled to points at most `step` px apart (for clearance and hiding tests)
function resample(l, step = 1.5) {
  const out = [l[0]];
  for (let i = 1; i < l.length; i++) {
    const a = l[i - 1], b = l[i], n = Math.ceil(dist(a, b) / step);
    for (let k = 1; k <= n; k++) out.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
  }
  return out;
}
const segDist = (p, a, b) => {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};
const polyDist = (p, l) => { let m = Infinity; for (let i = 1; i < l.length; i++) m = Math.min(m, segDist(p, l[i - 1], l[i])); return m; };
const bboxOf = (l) => { let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity; for (const p of l) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); } return { x0, y0, x1, y1 }; };
const orient = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
const segCross = (a, b, c, d) => { const d1 = orient(c, d, a), d2 = orient(c, d, b), d3 = orient(a, b, c), d4 = orient(a, b, d); return d1 * d2 < 0 && d3 * d4 < 0; };
function crosses(l1, l2) {
  const A = bboxOf(l1), B = bboxOf(l2);
  if (A.x1 < B.x0 || B.x1 < A.x0 || A.y1 < B.y0 || B.y1 < A.y0) return false;
  for (let i = 1; i < l1.length; i++) for (let j = 1; j < l2.length; j++) if (segCross(l1[i - 1], l1[i], l2[j - 1], l2[j])) return true;
  return false;
}
// Liang-Barsky: does segment ab meet rectangle R?
function segHitsRect(a, b, R) {
  let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy], q = [a[0] - R.x0, R.x1 - a[0], a[1] - R.y0, R.y1 - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return false; continue; }
    const r = q[i] / p[i];
    if (p[i] < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
  }
  return true;
}
const polyHitsRect = (l, R) => { for (let i = 1; i < l.length; i++) if (segHitsRect(l[i - 1], l[i], R)) return true; return l.length === 1 && segHitsRect(l[0], l[0], R); };

// boundary pieces: {kind: 'line', p, dir} (the whole line), {kind: 'seg', a, b}, {kind: 'arc', c, r, a0, a1}
function pieceFn(pc) {
  if (pc.kind === 'line') return (s) => CX.add(pc.p, CX.scale(pc.dir, Math.tan(Math.PI * (s - 0.5))));
  if (pc.kind === 'seg') return (s) => C(pc.a.re + (pc.b.re - pc.a.re) * s, pc.a.im + (pc.b.im - pc.a.im) * s);
  return (s) => { const a = pc.a0 + (pc.a1 - pc.a0) * s; return C(pc.c.re + pc.r * Math.cos(a), pc.c.im + pc.r * Math.sin(a)); };
}
const sEnds = (pc) => (pc.kind === 'line' ? [1e-7, 1 - 1e-7] : [0, 1]);
const inWin = (z, w, m = 0) => z.re >= w.x0 + m && z.re <= w.x1 - m && z.im >= w.y0 + m && z.im <= w.y1 - m;

// ---------------------------------------------------------------- sample points (morph-figure.md 4)
// Candidates only; the selection below decides what is drawn. Boundary: corners and lattice crossings of step h;
// interior: nodes of the lattice of step 2h inside X, at least 0.4 h from the boundary.
function samplePoints(ex, h) {
  const win = ex.srcWin || ex.win;
  const B = [], I = [];
  const push = (arr, z, kind) => { if (inWin(z, win, 1e-9) && !arr.some((q) => CX.abs(CX.sub(q.z, z)) < 0.45 * h) && !B.some((q) => CX.abs(CX.sub(q.z, z)) < 0.45 * h)) arr.push({ z, kind }); };
  for (const pc of ex.X.pieces) {
    if (pc.kind === 'seg') {
      const dx = pc.b.re - pc.a.re, dy = pc.b.im - pc.a.im, useX = Math.abs(dx) >= Math.abs(dy);
      const c0 = useX ? pc.a.re : pc.a.im, c1 = useX ? pc.b.re : pc.b.im, lo = Math.min(c0, c1), hi2 = Math.max(c0, c1);
      push(B, pc.a, 'corner');
      push(B, pc.b, 'corner');
      for (let k = Math.ceil(lo / h); k * h <= hi2 + 1e-9; k++) push(B, pieceFn(pc)((k * h - c0) / (c1 - c0)), 'edge');
    } else if (pc.kind === 'line') {
      for (let k = -200; k <= 200; k++) push(B, CX.add(pc.p, CX.scale(pc.dir, k * h)), 'edge');
    } else {
      const n = Math.max(2, Math.round(pc.r * Math.abs(pc.a1 - pc.a0) / h));
      for (let k = 0; k <= n; k++) push(B, pieceFn(pc)(k / n), k === 0 || k === n ? 'corner' : 'edge');
    }
  }
  const dense = [];
  for (const pc of ex.X.pieces) { const g = pieceFn(pc), [a, b] = sEnds(pc); for (let i = 0; i <= 2000; i++) dense.push(g(a + (b - a) * i / 2000)); }
  const hi = 2 * h;
  for (let i = Math.ceil(win.x0 / hi); i <= Math.floor(win.x1 / hi); i++) {
    for (let j = Math.ceil(win.y0 / hi); j <= Math.floor(win.y1 / hi); j++) {
      const z = C(i * hi, j * hi);
      if (!ex.X.inside(z)) continue;
      let dmin = Infinity;
      for (const q of dense) if (CX.isFin(q)) dmin = Math.min(dmin, CX.abs(CX.sub(q, z)));
      if (dmin >= 0.4 * h) push(I, z, 'node');
    }
  }
  return [...B, ...I];
}

// ---------------------------------------------------------------- the examples
// Each example states its set, its map and its homotopy in TeX. In the app these come from the shape list
// (shapeTex), the chain (figureCaption) and a new homTex on each function definition (morph-figure.md 5).
const mobInv = (M) => [M[3], CX.neg(M[1]), CX.neg(M[2]), M[0]];
const CAYLEY = [C(1, 0), C(0, -1), C(1, 0), C(0, 1)];
// The elliptic Cayley map: fixed points p = (sqrt3 - 1)(i - 1)/2 and q = (sqrt3 + 1)(1 - i)/2. The branch of F^t that
// mobPath takes is read off numerically: the total turn of H_t'(p) over 0 <= t <= 1.
function cayleyHomTex() {
  const s3 = Math.sqrt(3), p = C((1 - s3) / 2, (s3 - 1) / 2);
  const Pt = CX.mobPath(CAYLEY);
  let ang = 0, prev = 0;
  for (let i = 1; i <= 400; i++) {
    const M = Pt(i / 400), e = 1e-6;
    const d = CX.div(CX.sub(CX.mobApply(M, CX.add(p, C(e, 0))), CX.mobApply(M, p)), C(e, 0));
    let a = Math.atan2(d.im, d.re), da = a - prev;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    ang += da; prev = a;
  }
  const k = ang / (2 * Math.PI / 3);
  if (Math.abs(Math.abs(k) - 1) > 1e-6) throw new Error('unexpected Cayley branch: turn ' + ang);
  const sgn = k > 0 ? '' : '-';
  return `the elliptic M\\"obius transformations $H_t$ that fix $p=\\tfrac12(\\sqrt3-1)(i-1)$ and $q=\\tfrac12(\\sqrt3+1)(1-i)$, with $H_t'(p)=e^{${sgn}2\\pi i t/3}$, $0\\le t\\le 1$`;
}
const EXAMPLES = [
  {
    id: 'cayley',
    title: 'Cayley map of the upper half-plane',
    step: { type: 'mobius', params: { a: '1', b: '-i', c: '1', d: 'i' } },
    win: { x0: -2.4, x1: 2.4, y0: -1.35, y1: 2.25 },
    cell: 0.5,
    X: { inside: (z) => z.im > 0, open: true, bounded: false, pieces: [{ kind: 'line', p: C(0, 0), dir: C(1, 0) }],
      poly: [C(-50, 0), C(50, 0), C(50, 50), C(-50, 50)] },
    invAt(t) { const P = CX.mobPath(CAYLEY); const M = mobInv(P(t)); return (w) => CX.mobApply(M, w); },
    setTex: 'The half-plane $\\operatorname{Im} z>0$',
    mapTex: '$F(z)=(z-i)/(z+i)$',
    homTex: cayleyHomTex,
    circular: true,                 // Möbius: the paths are arcs of circles or segments (checked per path below)
  },
  {
    id: 'square',
    title: 'z^2 of a quarter disc',
    step: { type: 'pown', params: { n: 2 } },
    win: { x0: -2.6, x1: 2.6, y0: -0.55, y1: 2.65 },
    cell: 0.25,
    X: { inside: (z) => z.re > 0 && z.im > 0 && CX.abs(z) < 1.5, open: true, bounded: true,
      pieces: [{ kind: 'seg', a: C(0, 0), b: C(1.5, 0) }, { kind: 'arc', c: C(0, 0), r: 1.5, a0: 0, a1: Math.PI / 2 }, { kind: 'seg', a: C(0, 1.5), b: C(0, 0) }],
      poly: null },
    invAt(t) { return (w) => CX.powReal(w, 1 / (1 + t), Math.PI, 0); },
    setTex: 'The quarter disc $|z|<1.5$, $0<\\arg z<\\pi/2$',
    mapTex: '$F(z)=z^{2}$',
    homTex: () => 'the homotopy $H_t(z)=z^{1+t}$ (principal branch), $0\\le t\\le 1$',
  },
  {
    id: 'exp',
    title: 'exp of a rectangle in the strip',
    step: { type: 'exp', params: {} },
    win: { x0: -3.1, x1: 3.1, y0: -0.75, y1: 3.6 },
    cell: 0.5,
    X: { inside: (z) => z.re > -1 && z.re < 1 && z.im > 0 && z.im < Math.PI, open: true, bounded: true,
      pieces: [{ kind: 'seg', a: C(-1, 0), b: C(1, 0) }, { kind: 'seg', a: C(1, 0), b: C(1, Math.PI) }, { kind: 'seg', a: C(1, Math.PI), b: C(-1, Math.PI) }, { kind: 'seg', a: C(-1, Math.PI), b: C(-1, 0) }],
      poly: null },
    invAt(t) { if (t < 1e-6) return (w) => w; return (w) => CX.scale(CX.log(CX.add(C(1, 0), CX.scale(CX.sub(w, C(t, 0)), t))), 1 / t); },
    setTex: 'The rectangle $-1<\\operatorname{Re} z<1$, $0<\\operatorname{Im} z<\\pi$',
    mapTex: '$F(z)=e^{z}$',
    homTex: () => 'the homotopy $H_t(z)=(e^{tz}-1)/t+t$ for $0<t\\le 1$, $H_0(z)=z$',
  },
];

// ---------------------------------------------------------------- raster: the region at time t, by the inverse of H_t
// The checker fades to its mean colour where a cell is smaller than FIG.fadePx device px (B3.6): no moiré at F(∞).
function regionRaster(ex, t, box, win, ink) {
  const k = DPI / 96;
  const W = Math.round(box.w * k), Hh = Math.round(box.h * k);
  const rgba = new Uint8Array(W * Hh * 4);
  const inv = ex.invAt(t), cell = ex.cell;
  const c0 = hexRGB(ink.base), c1 = hexRGB(ink.alt), cm = c0.map((v, i) => 0.5 * (v + c1[i]));
  const SS = 3, A = TOK.alpha;
  const sx = (win.x1 - win.x0) / W, sy = (win.y1 - win.y0) / Hh;
  for (let y = 0; y < Hh; y++) {
    for (let x = 0; x < W; x++) {
      // cell size in device px: the inverse's derivative over one device px
      const wc = C(win.x0 + (x + 0.5) * sx, win.y1 - (y + 0.5) * sy);
      const z0 = inv(wc), zx = inv(C(wc.re + sx, wc.im)), zy = inv(C(wc.re, wc.im - sy));
      let g = 1;
      if (CX.isFin(z0) && CX.isFin(zx) && CX.isFin(zy)) {
        const dz = Math.max(CX.abs(CX.sub(zx, z0)), CX.abs(CX.sub(zy, z0)));
        g = smooth(FIG.fadePx[0], FIG.fadePx[1], cell / Math.max(dz, 1e-300));
      }
      let r = 0, gg = 0, b = 0, a = 0;
      for (let ssy = 0; ssy < SS; ssy++) {
        for (let ssx = 0; ssx < SS; ssx++) {
          const z = inv(C(win.x0 + (x + (ssx + 0.5) / SS) * sx, win.y1 - (y + (ssy + 0.5) / SS) * sy));
          if (!CX.isFin(z) || !ex.X.inside(z)) continue;
          const par = (Math.floor(z.re / cell) + Math.floor(z.im / cell)) & 1;
          const c = par ? c1 : c0;
          r += (cm[0] + (c[0] - cm[0]) * g) * A; gg += (cm[1] + (c[1] - cm[1]) * g) * A; b += (cm[2] + (c[2] - cm[2]) * g) * A; a += A;
        }
      }
      const n = SS * SS, o = 4 * (y * W + x);
      if (a > 0) { rgba[o] = Math.round(r / a); rgba[o + 1] = Math.round(gg / a); rgba[o + 2] = Math.round(b / a); rgba[o + 3] = Math.round(255 * a / n); }
    }
  }
  return 'data:image/png;base64,' + encodePNG(W, Hh, rgba).toString('base64');
}

// ---------------------------------------------------------------- path selection (morph-figure.md 4)
// candidates -> hard prunes -> greedy by clearance. Returns the kept paths and a log of why others were dropped.
function selectPaths(cands, ctx) {
  const { box, budget, staticInk, axes } = ctx;
  const m = FIG.margin;
  const inner = { x0: box.x + m, x1: box.x + box.w - m, y0: box.y + m, y1: box.y + box.h - m };
  const inBox = (p) => p[0] >= inner.x0 && p[0] <= inner.x1 && p[1] >= inner.y0 && p[1] <= inner.y1;
  const log = [];
  const ok = [];
  for (const c of cands) {
    if (c.broken) { log.push([c, 'through ∞ or a cut']); continue; }
    if (c.len < 7) { log.push([c, 'fixed (< 7 px)']); continue; }
    if (!c.l.every(inBox)) { log.push([c, 'leaves the panel (3 px margin)']); continue; }
    // hidden: the whole trace within 1.5 px of an axis or a region edge (exp's real axis, z^2's real axis)
    const hidden = c.rs.every((p) => Math.abs(p[1] - axes.y) <= 1.5 || Math.abs(p[0] - axes.x) <= 1.5 || staticInk.some((l) => polyDist(p, l) <= 1.5));
    if (hidden) { c.hidden = true; log.push([c, 'hidden along an axis or edge']); continue; }
    ok.push(c);
  }
  if (!ok.length) { const h = cands.filter((c) => c.hidden); if (h.length) ok.push(h[0]); }   // "unless no other path is left"
  const kept = [];
  const clearance = (c) => { let d = Infinity; for (const k of kept) for (const p of c.rs) { d = Math.min(d, polyDist(p, k.l)); if (d < 0.5) return d; } return d; };
  // boundary points first; interior points only afterwards, and only when they cross nothing (B3.4)
  for (const phase of ['boundary', 'node']) while (kept.length < budget) {
    let best = null, bestScore = -Infinity;
    for (const c of ok) {
      if (kept.includes(c) || c.dead || (phase === 'boundary') === (c.sp.kind === 'node')) continue;
      let bad = null, nCross = 0;
      for (const k of kept) {
        const s0 = c.l[0], e0 = c.l[c.l.length - 1], s1 = k.l[0], e1 = k.l[k.l.length - 1];
        if (dist(e0, s1) < 6 || dist(s0, e1) < 6) { bad = 'its head lands on a start dot (or the reverse)'; break; }
        if (dist(s0, s1) < 6 && dist(e0, e1) < 6) { bad = 'near-duplicate'; break; }
        if (crosses(c.l, k.l)) nCross++;
      }
      if (!bad && nCross >= 2) bad = 'crosses two kept paths';
      if (!bad && c.sp.kind === 'node' && (nCross >= 1 || kept.filter((k) => k.sp.kind === 'node').length >= FIG.maxNodes)) bad = 'interior point: crossing or over the limit of 2';
      if (bad) { c.dead = true; log.push([c, bad]); continue; }
      const cl = clearance(c);
      // clear beats many: once FIG.minPaths are kept, a path that crosses or comes within FIG.minClear px is skipped
      if (kept.length >= FIG.minPaths && cl < FIG.minClear) { c.dead = true; log.push([c, `within ${FIG.minClear} px of a kept path`]); continue; }
      const score = Math.min(cl, 30) + 0.03 * c.len;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    if (!best) break;
    kept.push(best);
  }
  for (const c of ok) if (!kept.includes(c) && !c.dead) log.push([c, 'over the budget']);
  // non-injective maps (M3): heads that meet stop 1.5 px short, both visible
  for (const a of kept) for (const b of kept) if (a !== b && dist(a.l[a.l.length - 1], b.l[b.l.length - 1]) < 2) { a.meet = true; b.meet = true; }
  return { kept, log };
}

// the geometry of a path in world coordinates: 'segment', 'arc' or 'other' (for the caption's path clause)
function pathShape(H, z) {
  const pts = []; for (let i = 0; i <= 40; i++) pts.push(H(i / 40)(z));
  const a = pts[0], b = pts[40], L = CX.abs(CX.sub(b, a));
  const u = CX.scale(CX.sub(b, a), 1 / L);
  const off = (p) => { const d = CX.sub(p, a); return Math.abs(d.re * u.im - d.im * u.re); };
  if (pts.every((p) => off(p) < 1e-7 * Math.max(1, L))) return 'segment';
  // circle through a, the middle point and b
  const m = pts[20];
  const ax = a.re, ay = a.im, bx = m.re, by = m.im, cx = b.re, cy = b.im;
  const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
  if (Math.abs(d) < 1e-14) return 'other';
  const ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d;
  const uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d;
  const R = Math.hypot(ax - ux, ay - uy);
  return pts.every((p) => Math.abs(Math.hypot(p.re - ux, p.im - uy) - R) < 1e-7 * Math.max(1, R)) ? 'arc' : 'other';
}

// ---------------------------------------------------------------- the deformation panel (shared by the figure and the screen mockup)
function deformation(ex, box, opt = {}) {
  const win = ex.win;
  const b = Funcs.build(ex.step);
  if (b.error) throw new Error(b.error);
  const H = (t) => b.hom(t);
  const P = (w) => [box.x + (w.re - win.x0) / (win.x1 - win.x0) * box.w, box.y + (win.y1 - w.im) / (win.y1 - win.y0) * box.h];
  const Pinv = (p) => C(win.x0 + (p[0] - box.x) / box.w * (win.x1 - win.x0), win.y1 - (p[1] - box.y) / box.h * (win.y1 - win.y0));
  const tEnd = opt.t == null ? 1 : opt.t;
  const ink = { base: TOK.c1, edge: TOK.c1edge, alt: TOK.c1alt };
  const halfway = opt.halfway ?? FIG.halfway;
  let s = '';
  const clip = `clip${ex.id}${opt.screen ? 's' : ''}`;
  s += `<defs><clipPath id="${clip}"><rect x="${f2(box.x)}" y="${f2(box.y)}" width="${f2(box.w)}" height="${f2(box.h)}"/></clipPath></defs>`;
  s += `<g clip-path="url(#${clip})">`;
  // paper: plane, grid, axes
  const step = niceStep(Math.max(win.x1 - win.x0, win.y1 - win.y0) / 5);
  const minor = step / (String(step / 10 ** Math.floor(Math.log10(step)))[0] === '2' ? 4 : 5);
  s += `<rect x="${f2(box.x)}" y="${f2(box.y)}" width="${f2(box.w)}" height="${f2(box.h)}" fill="${TOK.plane}"/>`;
  const grid = (st, color, w) => {
    let d = '';
    for (let i = Math.ceil(win.x0 / st); i <= Math.floor(win.x1 / st); i++) { const x = P(C(i * st, 0))[0]; d += `M${f2(x)} ${f2(box.y)}V${f2(box.y + box.h)}`; }
    for (let j = Math.ceil(win.y0 / st); j <= Math.floor(win.y1 / st); j++) { const y = P(C(0, j * st))[1]; d += `M${f2(box.x)} ${f2(y)}H${f2(box.x + box.w)}`; }
    return `<path d="${d}" stroke="${color}" stroke-width="${w}" fill="none"/>`;
  };
  s += grid(minor, TOK.gridMinor, 0.4) + grid(step, TOK.gridMajor, 0.5);
  const o = P(C(0, 0));
  s += `<path d="M${f2(box.x)} ${f2(o[1])}H${f2(box.x + box.w)}M${f2(o[0])} ${f2(box.y)}V${f2(box.y + box.h)}" stroke="${TOK.axis}" stroke-width="0.6" fill="none"/>`;
  // X (t = 0): a neutral tint (B3.7); on screen an unbounded X is outline-only
  const srcLines = [];
  for (const pc of ex.X.pieces) { const g = pieceFn(pc), [a0, a1] = sEnds(pc); srcLines.push(...trace(g, a0, a1, P)); }
  const srcPoly = ex.X.poly ? [ex.X.poly.map(P)] : (() => {
    const pts = [];
    for (const pc of ex.X.pieces) { const g = pieceFn(pc); for (let i = 0; i <= 200; i++) pts.push(P(g(i / 200))); }
    return [pts];
  })();
  if (!(opt.screen && !ex.X.bounded)) s += `<path d="${dPath(srcPoly)}Z" fill="${FIG.srcFill}" fill-opacity="${FIG.srcFillA}" stroke="none"/>`;
  // the region at T (the end in the figure), its edge
  s += `<image x="${f2(box.x)}" y="${f2(box.y)}" width="${f2(box.w)}" height="${f2(box.h)}" preserveAspectRatio="none" href="${regionRaster(ex, tEnd, box, win, ink)}"/>`;
  const edgeAt = (t) => { const Ht = H(t), out = []; for (const pc of ex.X.pieces) { const g = pieceFn(pc), [a0, a1] = sEnds(pc); out.push(...trace((u) => Ht(g(u)), a0, a1, P)); } return out; };
  const endEdge = edgeAt(1);
  const halfEdge = halfway ? edgeAt(0.5) : [];
  if (halfway && !opt.screen) s += `<path d="${dPath(halfEdge)}" fill="none" stroke="${TOK.ink}" stroke-width="${FIG.halfW}" stroke-linecap="round" stroke-dasharray="${FIG.halfDash}"/>`;
  if (opt.screen) s += `<path d="${dPath(endEdge)}" fill="none" stroke="${TOK.faint}" stroke-width="1" stroke-dasharray="1 2"/>`;
  s += `<path d="${dPath(tEnd === 1 ? endEdge : edgeAt(tEnd))}" fill="none" stroke="${ink.edge}" stroke-width="${opt.screen ? 1.5 : FIG.edgeW}"${ex.X.open ? ` stroke-dasharray="${opt.screen ? '5 3' : FIG.dash}"` : ''}/>`;
  // X's outline over the image: X stays readable where F(X) covers it
  s += `<path d="${dPath(srcLines)}" fill="none" stroke="${opt.screen ? TOK.faint : FIG.srcEdge}" stroke-width="${opt.screen ? 1 : FIG.srcEdgeW}"${ex.X.open ? ` stroke-dasharray="${opt.screen ? '4 3' : FIG.dash}"` : ''}/>`;
  s += '</g>';

  // ---- candidates and selection
  const sb = ex.X.pieces.reduce((acc, pc) => {
    if (pc.kind === 'line') return acc + (win.x1 - win.x0);
    if (pc.kind === 'seg') return acc + CX.abs(CX.sub(pc.b, pc.a));
    return acc + pc.r * Math.abs(pc.a1 - pc.a0);
  }, 0);
  const h = niceStep(sb / 10);
  const cands = [];
  for (const sp of samplePoints(ex, h)) {
    const full = trace((t) => H(t)(sp.z), 0, 1, P, 48);
    const c = { sp, broken: full.length !== 1, l: full[0] || [[0, 0]] };
    c.len = plen(c.l); c.rs = resample(c.l);
    cands.push(c);
  }
  const staticInk = [...srcLines, ...endEdge].map((l) => resample(l, 2));
  const budget = Math.floor(FIG.perInch * (opt.widthIn || box.w / 96));   // per inch of the figure's width: 8 at 3.4 in
  const { kept: paths, log } = selectPaths(cands, { box, budget, staticInk, axes: { x: o[0], y: o[1] } });
  for (const p of paths) p.upTo = tEnd < 1 ? trace((t) => H(t)(p.sp.z), 0, tEnd, P, 48)[0] : p.l;

  // arrowhead at the end of a polyline: tip on the last point (or `short` px before it), along the chord over ~L
  const head = (l, L, Wd, short = 0) => {
    const last = l[l.length - 1];
    let i = l.length - 2;
    while (i > 0 && dist(last, l[i]) < L * 0.9) i--;
    const q = l[Math.max(0, i)], dx = last[0] - q[0], dy = last[1] - q[1], n = Math.hypot(dx, dy) || 1, ux = dx / n, uy = dy / n;
    const tip = [last[0] - short * ux, last[1] - short * uy];
    const bx = tip[0] - L * ux, by = tip[1] - L * uy, nx = -uy, ny = ux;
    const notch = [tip[0] - L * FIG.headNotch * ux, tip[1] - L * FIG.headNotch * uy];
    const poly = [tip, [bx + Wd * nx, by + Wd * ny], notch, [bx - Wd * nx, by - Wd * ny]];
    return { d: `M${poly.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}Z`, poly, u: [ux, uy] };
  };
  const trimEnd = (l, d) => {
    const out = l.slice();
    let rem = d;
    while (out.length > 2) {
      const a = out[out.length - 2], bq = out[out.length - 1], sl = dist(a, bq);
      if (sl > rem) { const u = (sl - rem) / sl; out[out.length - 1] = [a[0] + (bq[0] - a[0]) * u, a[1] + (bq[1] - a[1]) * u]; return out; }
      rem -= sl; out.pop();
    }
    return out;
  };
  const L = opt.screen ? 7 : FIG.headL, Wd = opt.screen ? 2.6 : FIG.headW;
  let halo = '', lines = '', heads = '', dots = '', rails = '';
  const inkLines = [], inkHeads = [];
  for (const p of paths) {
    const short = p.meet ? 1.5 : 0;
    const hd = head(p.l, L, Wd, short);
    p.head = hd;
    inkHeads.push(hd.poly);
    if (opt.screen) {
      rails += `<path d="${dPath([trimEnd(p.l, L * 0.6 + short)])}" fill="none" stroke="${TOK.faint}" stroke-width="1" stroke-opacity="0.75"/>`;
      rails += `<path d="${hd.d}" fill="${TOK.faint}" fill-opacity="0.75"/>`;
      if (p.upTo && p.upTo.length > 1) {
        halo += `<path d="${dPath([p.upTo])}"/>`;
        lines += `<path d="${dPath([p.upTo])}"/>`;
      }
      const e = p.upTo ? p.upTo[p.upTo.length - 1] : p.l[0];
      dots += `<circle cx="${f2(e[0])}" cy="${f2(e[1])}" r="2.6" fill="${TOK.ink2}" stroke="#FFFFFF" stroke-width="1.2"/>`;
      dots += `<circle cx="${f2(p.l[0][0])}" cy="${f2(p.l[0][1])}" r="2" fill="${TOK.ink2}" stroke="#FFFFFF" stroke-width="1"/>`;
    } else {
      const body = trimEnd(p.l, L * (1 - FIG.headNotch) + 0.3 + short);
      inkLines.push(body);
      halo += `<path d="${dPath([body])}"/>`;
      lines += `<path d="${dPath([body])}"/>`;
      heads += `<path d="${hd.d}"/>`;
      dots += `<circle cx="${f2(p.l[0][0])}" cy="${f2(p.l[0][1])}" r="${FIG.dotR}"/>`;
    }
  }
  let labelled = null;
  if (opt.screen) {
    s += rails;
    s += `<g fill="none" stroke="#FFFFFF" stroke-opacity="0.8" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${halo}</g>`;
    s += `<g fill="none" stroke="${TOK.ink2}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${lines}</g>`;
    s += dots;
  } else {
    s += `<g fill="none" stroke="#FFFFFF" stroke-opacity="${FIG.haloA}" stroke-width="${FIG.haloW}" stroke-linecap="round" stroke-linejoin="round">${halo}</g>`;
    s += `<g fill="#FFFFFF" fill-opacity="${FIG.haloA}" stroke="#FFFFFF" stroke-opacity="${FIG.haloA}" stroke-width="1.3" stroke-linejoin="round">${heads}${dots.replace(/r="[^"]+"/g, `r="${FIG.dotRing}"`)}</g>`;
    s += `<g fill="none" stroke="${FIG.pathColor}" stroke-width="${FIG.pathW}" stroke-linecap="round" stroke-linejoin="round">${lines}</g>`;
    s += `<g fill="${FIG.pathColor}" stroke="none">${heads}${dots}</g>`;

    // ---- labels z and F(z) on one path, placed by search and tested against every ink layer (B3.1)
    const lz = T('$z$', 9), lf = T('$F(z)$', 9);
    const PAD = 2.5;                                       // casing (0.75) + 1.75 px clearance
    const frameIn = { x0: box.x + 5, y0: box.y + 5, x1: box.x + box.w - 5, y1: box.y + box.h - 5 };   // frame and ticks
    const ink = [...inkLines, ...srcLines, ...endEdge, ...halfEdge,
      [[box.x, o[1]], [box.x + box.w, o[1]]], [[o[0], box.y], [o[0], box.y + box.h]]];
    const rectOf = (it, c) => ({ x0: c[0] - it.w / 2 - PAD, x1: c[0] + it.w / 2 + PAD, y0: c[1] - (it.h + it.d) / 2 - PAD, y1: c[1] + (it.h + it.d) / 2 + PAD });
    const grow = (R, e) => ({ x0: R.x0 - e, x1: R.x1 + e, y0: R.y0 - e, y1: R.y1 + e });
    // the extra clearance a placement has beyond PAD (0, 1.5, 3.5 or 5.5 px): used to prefer open space
    const room = (R) => { let best = -1; for (const e of [0, 1.5, 3.5, 5.5]) { if (clear(grow(R, e))) best = e; else break; } return best; };
    const clear = (R) => {
      if (R.x0 < frameIn.x0 || R.x1 > frameIn.x1 || R.y0 < frameIn.y0 || R.y1 > frameIn.y1) return false;
      for (const l of ink) if (polyHitsRect(l, R)) return false;
      for (const hp of inkHeads) { if (polyHitsRect([...hp, hp[0]], R)) return false; }
      for (const p of paths) { const c = p.l[0], r = FIG.dotRing; if (segHitsRect([c[0] - r, c[1]], [c[0] + r, c[1]], R) || segHitsRect([c[0], c[1] - r], [c[0], c[1] + r], R)) return false; }
      return true;
    };
    // distance from a box centre to its edge along u
    const ext = (it, u) => Math.min((it.w / 2 + PAD) / Math.max(Math.abs(u[0]), 1e-9), ((it.h + it.d) / 2 + PAD) / Math.max(Math.abs(u[1]), 1e-9));
    const dirs = Array.from({ length: 24 }, (_, k) => [Math.cos(k * Math.PI / 12), Math.sin(k * Math.PI / 12)]);
    const ang = (u, v) => Math.acos(Math.max(-1, Math.min(1, u[0] * v[0] + u[1] * v[1])));
    const placeZ = (p) => {
      const a = p.l[0];
      // the outward normal of X at z: the mean of the directions that leave X
      const out = dirs.filter((u) => !ex.X.inside(Pinv([a[0] + 4 * u[0], a[1] + 4 * u[1]])));
      let n;
      if (out.length && out.length < dirs.length) { n = out.reduce((s2, u) => [s2[0] + u[0], s2[1] + u[1]], [0, 0]); const k = Math.hypot(...n) || 1; n = [n[0] / k, n[1] / k]; }
      else { const a2 = p.l[Math.min(p.l.length - 1, 4)], k = dist(a, a2) || 1; n = [(a[0] - a2[0]) / k, (a[1] - a2[1]) / k]; }
      const order = dirs.filter((u) => ang(u, n) <= 75 * Math.PI / 180).sort((u, v) => ang(u, n) - ang(v, n));
      let best = null;
      for (const u of order) {
        const g = FIG.dotRing + 1.2 + ext(lz, u), c = [a[0] + g * u[0], a[1] + g * u[1]];
        if (p.sp.kind !== 'node' && ex.X.inside(Pinv(c))) continue;
        const R = rectOf(lz, c), r = room(R);
        if (r >= 0 && (!best || r > best.r)) best = { c, R, r };
      }
      return best;
    };
    const placeF = (p, Rz) => {
      const e = p.l[p.l.length - 1], ue = p.head.u;
      const order = dirs.filter((u) => ang(u, ue) <= 100 * Math.PI / 180).sort((u, v) => ang(u, ue) - ang(v, ue));
      let best = null;
      for (const u of order) {
        const g = 1.5 + ext(lf, u), c = [e[0] + g * u[0], e[1] + g * u[1]];
        const R = rectOf(lf, c);
        if (Rz && !(R.x1 < Rz.x0 || Rz.x1 < R.x0 || R.y1 < Rz.y0 || Rz.y1 < R.y0)) continue;
        const r = room(R);
        if (r >= 0 && (!best || r > best.r)) best = { c, R, r };
      }
      return best;
    };
    const order = paths.filter((p) => p.sp.kind !== 'node').sort((x, y) => y.len - x.len);
    // the labelled path: the one whose two labels have the most room; ties go to the longer path
    let pick = null;
    for (const p of order) {
      const zp = placeZ(p); if (!zp) continue;
      const fp = placeF(p, zp.R); if (!fp) continue;
      const r = Math.min(zp.r, fp.r);
      if (!pick || r > pick.r) pick = { p, zp, fp, r };
    }
    if (pick) {
      labelled = pick.p;
      const put = (it, c) => texAt(it, c[0] - it.w / 2, c[1] + (it.h - it.d) / 2, 'start', true, TOK.ink);
      s += put(lz, pick.zp.c) + put(lf, pick.fp.c);
    }
  }
  return { svg: s, step, minor, P, paths, h, log, labelled, H, halfway };
}

// ---------------------------------------------------------------- the caption, generated (morph-figure.md 5)
function caption(ex, dm) {
  const nodes = dm.paths.filter((p) => p.sp.kind === 'node').length;
  const which = nodes ? `boundary points and ${nodes === 1 ? 'one interior point' : 'two interior points'}` : 'boundary points';
  let clause = '';
  if (ex.circular) {
    const kinds = new Set(dm.paths.map((p) => pathShape(dm.H, p.sp.z)));
    if (kinds.has('other')) throw new Error(ex.id + ': a Möbius path is neither an arc nor a segment');
    clause = kinds.size === 2 ? '; each is an arc of a circle or a segment' : kinds.has('arc') ? '; each is an arc of a circle' : '; each is a segment';
  }
  const parts = [
    `${ex.setTex} (grey) and its image under ${ex.mapTex} (checkerboard), joined by ${ex.homTex()}.`,
    `Arrows are the paths $t\\mapsto H_t(z)$ of ${which}, from $z$ (dot) to $F(z)$${clause}.`,
  ];
  if (dm.halfway) parts.push('The dotted curve is the boundary at $t=1/2$.');
  if (dm.paths.some((p) => p.meet)) parts.push('Arrows that meet show points with the same image.');
  parts.push(`The checkerboard has cells of side $${ex.cell}$ in the $z$-plane, carried by $F$.`);
  if (ex.X.open) parts.push('Dashed boundaries do not belong to the sets.');
  return parts.join(' ');
}

// ---------------------------------------------------------------- the figure: frame, ticks, numbers, axis titles, caption
function figure(ex, widthIn = 3.4, opt = {}) {
  const W = widthIn * 96;
  const mL = 40, mR = 6, mT = 6, mB = 30;
  const pw = W - mL - mR, ph = pw * (ex.win.y1 - ex.win.y0) / (ex.win.x1 - ex.win.x0);
  const box = { x: mL, y: mT, w: pw, h: ph };
  const dm = deformation(ex, box, Object.assign({ widthIn }, opt));
  const win = ex.win, P = dm.P, step = dm.step, minor = dm.minor;
  let s = dm.svg;
  let d = '';
  const tick = (len, st) => {
    for (let i = Math.ceil(win.x0 / st); i <= Math.floor(win.x1 / st); i++) { const x = P(C(i * st, 0))[0]; d += `M${f2(x)} ${f2(box.y + box.h)}v${-len}M${f2(x)} ${f2(box.y)}v${len}`; }
    for (let j = Math.ceil(win.y0 / st); j <= Math.floor(win.y1 / st); j++) { const y = P(C(0, j * st))[1]; d += `M${f2(box.x)} ${f2(y)}h${len}M${f2(box.x + box.w)} ${f2(y)}h${-len}`; }
  };
  tick(FIG.tickMajor, step); tick(FIG.tickMinor, minor);
  s += `<path d="${d}" stroke="#000" stroke-width="${FIG.tickW}" fill="none"/>`;
  s += `<rect x="${f2(box.x)}" y="${f2(box.y)}" width="${f2(box.w)}" height="${f2(box.h)}" fill="none" stroke="#000" stroke-width="${FIG.frameW}"/>`;
  const tickTex = (v) => { if (Math.abs(v) < step * 1e-9) return '0'; const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9)); let t = v.toFixed(dec); if (t.includes('.')) t = t.replace(/\.?0+$/, ''); return t; };
  for (let i = Math.ceil(win.x0 / step); i <= Math.floor(win.x1 / step); i++) s += texAt(T(`$${tickTex(i * step)}$`, 8), P(C(i * step, 0))[0], box.y + box.h + 4 + 8 * PT * 0.95, 'middle');
  for (let j = Math.ceil(win.y0 / step); j <= Math.floor(win.y1 / step); j++) s += texAt(T(`$${tickTex(j * step)}$`, 8), box.x - 4, P(C(0, j * step))[1] + 8 * PT * 0.33, 'end');
  s += texAt(T('$\\operatorname{Re}$', 9), box.x + box.w / 2, box.y + box.h + 4 + 8 * PT + 4 + 9 * PT * 0.9, 'middle');
  const it = T('$\\operatorname{Im}$', 9), cx = box.x - 30, cy = box.y + box.h / 2;
  s += `<g transform="rotate(-90 ${f2(cx)} ${f2(cy)})">${texAt(it, cx, cy + 9 * PT * 0.32, 'middle')}</g>`;
  let Hh = box.y + box.h + mB + 6;
  const capText = caption(ex, dm);
  const cap = T(capText, 9, +(W * 0.75).toFixed(2));
  s += texAt(cap, 0, Hh + 4 + cap.h, 'start');
  Hh += 4 + cap.h + cap.d + 6;
  Hh = Math.ceil(Hh);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${(W / 96).toFixed(3)}in" height="${(Hh / 96).toFixed(3)}in" viewBox="0 0 ${f2(W)} ${Hh}"><rect width="${f2(W)}" height="${Hh}" fill="#FFFFFF"/>${s}</svg>`, dm, capText };
}

// ---------------------------------------------------------------- the on-screen form: the right plane at t, with the transport
function screen(ex, t) {
  const W = 640, Hp = Math.round(W * (ex.win.y1 - ex.win.y0) / (ex.win.x1 - ex.win.x0));
  const box = { x: 0, y: 0, w: W, h: Hp };
  const dm = deformation(ex, box, { t, screen: true });
  const font = 'font-family="Archivo, Helvetica Neue, Arial, sans-serif"';
  const mono = 'font-family="B612 Mono, SF Mono, Menlo, monospace"';
  const ty = Hp - 44, tx = 8, tw = W - 56;
  let tr = `<g ${font} font-size="12">`;
  tr += `<rect x="${tx}" y="${ty}" width="${tw}" height="36" rx="4" fill="#FFFFFF" fill-opacity="0.92" stroke="#B3BEC4"/>`;
  tr += `<rect x="${tx + 4}" y="${ty + 4}" width="28" height="28" rx="3" fill="#F1F4F5" stroke="#D2DADE"/><path d="M${tx + 14} ${ty + 12}v12M${tx + 21} ${ty + 12}v12" stroke="#121A20" stroke-width="2"/>`;
  const sx0 = tx + 44, sx1 = tx + 300, sy = ty + 18;
  tr += `<line x1="${sx0}" y1="${sy}" x2="${sx1}" y2="${sy}" stroke="#B3BEC4" stroke-width="2"/><line x1="${sx0}" y1="${sy}" x2="${sx0 + (sx1 - sx0) * t}" y2="${sy}" stroke="#0A6A87" stroke-width="2"/>`;
  tr += `<line x1="${sx0}" y1="${sy - 4}" x2="${sx0}" y2="${sy + 4}" stroke="#3E4C56"/><line x1="${sx1}" y1="${sy - 4}" x2="${sx1}" y2="${sy + 4}" stroke="#3E4C56"/>`;
  tr += `<rect x="${sx0 + (sx1 - sx0) * t - 4}" y="${sy - 7}" width="8" height="14" rx="2" fill="#FFFFFF" stroke="#3E4C56"/>`;
  tr += `<text x="${(sx0 + sx1) / 2}" y="${ty + 32}" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="11" fill="#3E4C56" text-anchor="middle">f</text>`;
  tr += `<text x="${sx1 + 12}" y="${sy + 4}" ${mono} font-size="11.5" fill="#121A20">t = ${t.toFixed(2)} / 1</text>`;
  tr += `<text x="${sx1 + 110}" y="${sy + 4}" fill="#3E4C56">1×</text><text x="${sx1 + 140}" y="${sy + 4}" fill="#3E4C56">Natural path ▾</text>`;
  tr += `<text x="${sx1 + 240}" y="${sy + 4}" fill="#121A20">Paths ✓</text>`;
  tr += '</g>';
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${Hp}" viewBox="0 0 ${W} ${Hp}">${dm.svg}${tr}</svg>`, dm };
}

// ---------------------------------------------------------------- main
const fmtZ = (z) => `${f2(z.re)}${z.im < 0 ? '−' : '+'}${f2(Math.abs(z.im))}i`;
function buildAll() { return EXAMPLES.map((ex) => ({ ex, fig: figure(ex) })); }
let res = buildAll();
if (runTeX()) res = buildAll();
const report = [];
for (const { ex, fig } of res) {
  fs.writeFileSync(path.join(OUT, `morph-${ex.id}.svg`), fig.svg);
  const dm = fig.dm;
  report.push(`${ex.id}: ${dm.paths.length} paths kept (budget ${Math.floor(FIG.perInch * 3.4)}), sample step ${dm.h}, labels on ${dm.labelled ? fmtZ(dm.labelled.sp.z) : 'none'}`);
  report.push('  kept: ' + dm.paths.map((p) => `${fmtZ(p.sp.z)}${p.sp.kind === 'node' ? ' (interior)' : ''}`).join(', '));
  for (const [c, why] of dm.log) report.push(`  dropped ${fmtZ(c.sp.z)}: ${why}`);
  report.push('  caption: ' + fig.capText);
}
for (const [ex, name] of [[EXAMPLES[0], 'screen-cayley-t055.svg'], [EXAMPLES[1], 'screen-square-t055.svg']]) {
  const sc = screen(ex, 0.55);
  fs.writeFileSync(path.join(OUT, name), sc.svg);
  report.push(`${name}: ${sc.dm.paths.length} paths`);
}
fs.writeFileSync(path.join(OUT, 'selection-log.txt'), report.join('\n') + '\n');
console.log(report.join('\n'));
