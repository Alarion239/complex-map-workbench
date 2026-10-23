// Export-design prototype, round 2: the figure composer (notes/export-design/DESIGN.md).
// Runs in the app page (MathJax loaded). Units are PostScript points (bp, 1/72 in): the SVG viewBox is in bp, so a label
// set at 8 pt is 8 pt on paper when the figure is placed at natural size.
// Round-2 changes (review-editor.md): one flat glyph <defs> per figure with namespaced ids (B7); opaque PNGs written by
// our own encoder: grey, RGB or indexed, never RGBA, so the PDF has no SMask (A1, A2, B9); no stroke state on glyphs
// (A1: no /CA 0); a thin halo drawn only over fills (A6); a label placer that avoids curves, labels and texture
// (A5, P1-8, C); uniform tick decimals, right-aligned mirrored labels (B5); ragged-right captions (A9); exact height (B12).
(() => {
  const XD = (window.XD = {});
  const f2 = (v) => (Math.round(v * 100) / 100).toString();
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36).slice(0, 5); };
  let uid = 0;
  // one figure at a time: its id namespace, its glyph table, the boxes of everything typeset (for collision checks)
  XD.begin = (name) => { XD.name = name; XD.ns = 'cmw' + hash(name); XD.glyphs = new Map(); XD.boxes = []; uid = 0; };
  XD.begin('figure');

  // ---------- typography ----------
  // TeX -> {inner (markup in glyph units), glyphs [[key, d]], w, a, d (pt)}; MathJax's viewBox gives exact metrics
  const cache = new Map();
  XD.tex = (tex, pt, color = '#000') => {
    const key = `${pt}|${color}|${tex}`;
    if (cache.has(key)) return cache.get(key);
    const node = MathJax.tex2svg(tex, { display: false });
    const svg = node.querySelector('svg');
    const vb = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const glyphs = [];
    svg.querySelectorAll('defs path[id]').forEach((p) => glyphs.push([p.id.replace(/^MJX-\d+-/, ''), p.getAttribute('d')]));
    svg.querySelectorAll('defs').forEach((d) => d.remove());
    const ser = new XMLSerializer();
    let inner = [...svg.childNodes].map((n) => ser.serializeToString(n)).join('');
    inner = inner
      .replace(/\sxmlns(:xlink)?="[^"]*"/g, '')
      .replace(/\sdata-[a-z-]+="[^"]*"/g, '')
      .replace(/\s(xlink:)?href="#MJX-\d+-([^"]+)"/g, ' xlink:href="#@NS@-$2"')
      .replace(/\sstroke="[^"]*"/g, '').replace(/\sstroke-width="[^"]*"/g, '')
      .replace(/currentColor/g, color);
    const k = pt / 1000;
    const out = { inner, glyphs, w: vb[2] * k, a: -vb[1] * k, d: (vb[3] + vb[1]) * k, vb0: vb[0], k, tex, pt, color };
    cache.set(key, out);
    return out;
  };
  // the box a placement would occupy: {x0, y0, x1, y1, left, base}
  XD.boxOf = (it, x, y, ax = 'start', ay = 'base') => {
    const left = ax === 'middle' ? x - it.w / 2 : ax === 'end' ? x - it.w : x;
    const base = ay === 'top' ? y + it.a : ay === 'bottom' ? y - it.d : ay === 'mid' ? y + it.a / 2 - it.d / 2 : y;
    return { x0: left, x1: left + it.w, y0: base - it.a, y1: base + it.d, left, base };
  };
  XD.rec = null; XD.textOff = false;
  // place a typeset item; ax: start|middle|end, ay: base|mid|top|bottom. kind tags the box for the preflight
  XD.at = (it, x, y, ax = 'start', ay = 'base', kind = 'label', halo = 0) => {
    const b = XD.boxOf(it, x, y, ax, ay);
    if (XD.rec) XD.rec.push({ tex: it.tex, pt: it.pt, color: it.color, x, y, ax, ay, halo });
    XD.boxes.push({ kind, tex: it.tex, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
    if (XD.textOff) return '';
    for (const [k, d] of it.glyphs) XD.glyphs.set(`${XD.ns}-${k}`, d);
    const inner = it.inner.split('@NS@').join(XD.ns);
    const g = `<g transform="translate(${f2(b.left - it.vb0 * it.k)} ${f2(b.base)}) scale(${+it.k.toFixed(6)})">`;
    let m = g + inner + '</g>';
    if (halo > 0) {
      // A6: 0.35-0.45 pt of white OUTSIDE the glyph (a stroke of twice that, centred on the outline, under the label)
      const sw = (2 * halo * 1000 / it.pt).toFixed(0);
      m = g + inner.split(`fill="${it.color}"`).join(`fill="#ffffff" stroke="#ffffff" stroke-width="${sw}" stroke-linejoin="round"`) + '</g>' + m;
    }
    return m;
  };

  // ---------- numbers ----------
  const niceStep = (span, n) => { const raw = span / n, e = Math.floor(Math.log10(raw)), b = raw / 10 ** e; return (b < 1.5 ? 1 : b < 3.5 ? 2 : b < 7.5 ? 5 : 10) * 10 ** e; };
  // B5: one precision per axis, the fewest decimals that represent every tick on it (0.90, 0.95, 1.00); a true minus
  XD.decimals = (step) => { for (let d = 0; d < 7; d++) if (Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) < 1e-9) return d; return 6; };
  XD.tickTex = (v, dec) => { const t = (Math.abs(v) < 1e-12 ? 0 : v).toFixed(dec); return t.replace('-', '-'); };
  XD.ticks = (a, b, step) => { const out = []; for (let i = Math.ceil(a / step - 1e-9); i <= Math.floor(b / step + 1e-9); i++) out.push(i * step); return out; };
  XD.sample = (f, t0, t1, n = 256, tol = 0.002) => {
    const out = [[]];
    const P = (t) => { const p = f(t); return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) < 1e6 && Math.abs(p[1]) < 1e6 ? p : null; };
    const rec = (ta, pa, tb, pb, depth) => {
      const tm = (ta + tb) / 2, pm = P(tm);
      if (!pa || !pb || !pm) { if (depth < 14 && pm) { rec(ta, pa, tm, pm, depth + 1); rec(tm, pm, tb, pb, depth + 1); } return; }
      const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
      const dev = Math.hypot(pm[0] - mx, pm[1] - my), len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (depth < 16 && (dev > tol || len > 0.2 * (1 + Math.hypot(pa[0], pa[1])))) { rec(ta, pa, tm, pm, depth + 1); rec(tm, pm, tb, pb, depth + 1); return; }
      out[out.length - 1].push(pb);
    };
    let prev = P(t0), tp = t0;
    if (prev) out[0].push(prev);
    for (let i = 1; i <= n; i++) {
      const t = t0 + (t1 - t0) * i / n, p = P(t);
      if (prev && p) rec(tp, prev, t, p, 0); else if (p) out.push([p]);
      prev = p; tp = t;
    }
    return out.filter((s) => s.length > 1);
  };

  // ---------- rasters: our own PNG encoder (opaque grey / RGB / indexed + pHYs + iTXt) ----------
  const crcT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = crcT[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const out = new Uint8Array(12 + data.length), dv = new DataView(out.buffer);
    dv.setUint32(0, data.length); for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
    out.set(data, 8); dv.setUint32(8 + data.length, crc(out.subarray(4, 8 + data.length)));
    return out;
  };
  const deflate = async (u8) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  // px: {w, h, type: 0 grey (1 byte/px) | 2 RGB (3) | 3 indexed (1 + palette [[r,g,b]])}
  XD.encodePNG = async (px, o = {}) => {
    const { w, h, type } = px, bpp = type === 2 ? 3 : 1, row = w * bpp, raw = new Uint8Array((row + 1) * h), d = px.data;
    for (let y = 0; y < h; y++) {
      const o0 = y * (row + 1), s0 = y * row;
      if (type === 3) { raw[o0] = 0; raw.set(d.subarray(s0, s0 + row), o0 + 1); continue; }
      raw[o0] = 2; // Up filter: flat fills compress to almost nothing
      if (y === 0) raw.set(d.subarray(0, row), 1);
      else for (let i = 0; i < row; i++) raw[o0 + 1 + i] = (d[s0 + i] - d[s0 - row + i]) & 255;
    }
    const ih = new Uint8Array(13), dv = new DataView(ih.buffer);
    dv.setUint32(0, w); dv.setUint32(4, h); ih[8] = 8; ih[9] = type; ih[10] = 0; ih[11] = 0; ih[12] = 0;
    const parts = [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih)];
    if (type === 3) { const pl = new Uint8Array(px.palette.length * 3); px.palette.forEach((c, i) => pl.set(c, i * 3)); parts.push(chunk('PLTE', pl)); }
    if (o.dpi) { const ppm = Math.round(o.dpi / 0.0254), ph = new Uint8Array(9), pv = new DataView(ph.buffer); pv.setUint32(0, ppm); pv.setUint32(4, ppm); ph[8] = 1; parts.push(chunk('pHYs', ph)); }
    if (o.meta) { const enc = new TextEncoder(), kw = enc.encode('cmw:scene'), txt = enc.encode(JSON.stringify(o.meta)), dd = new Uint8Array(kw.length + 5 + txt.length); dd.set(kw, 0); dd.set(txt, kw.length + 5); parts.push(chunk('iTXt', dd)); }
    parts.push(chunk('IDAT', await deflate(raw)), chunk('IEND', new Uint8Array(0)));
    const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
    let off = 0; for (const p of parts) { all.set(p, off); off += p.length; }
    return all;
  };
  // decode any image URL to opaque RGB on white
  XD.decode = async (url) => {
    const img = new Image(); img.src = url; await img.decode();
    const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
    const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0);
    const id = ctx.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height, rgb = new Uint8Array(n * 3);
    for (let i = 0; i < n; i++) { rgb[3 * i] = id[4 * i]; rgb[3 * i + 1] = id[4 * i + 1]; rgb[3 * i + 2] = id[4 * i + 2]; }
    return { w: c.width, h: c.height, rgb };
  };
  // B2/B9: flat-tone art as indexed colour (<= 256 entries; two tones + their anti-aliasing ramps need ~40)
  const toIndexed = (rgb, n) => {
    const hist = new Map();
    for (let i = 0; i < n; i++) { const k = ((rgb[3 * i] >> 2) << 12) | ((rgb[3 * i + 1] >> 2) << 6) | (rgb[3 * i + 2] >> 2); hist.set(k, (hist.get(k) || 0) + 1); }
    const keys = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 256).map((e) => e[0]);
    const pal = keys.map((k) => [((k >> 12) & 63) * 4 + 2, ((k >> 6) & 63) * 4 + 2, (k & 63) * 4 + 2].map((v) => Math.min(255, v)));
    const map = new Map(keys.map((k, i) => [k, i])), idx = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const k = ((rgb[3 * i] >> 2) << 12) | ((rgb[3 * i + 1] >> 2) << 6) | (rgb[3 * i + 2] >> 2);
      let j = map.get(k);
      if (j == null) { let best = 1e9; pal.forEach((c, q) => { const e = (c[0] - rgb[3 * i]) ** 2 + (c[1] - rgb[3 * i + 1]) ** 2 + (c[2] - rgb[3 * i + 2]) ** 2; if (e < best) { best = e; j = q; } }); map.set(k, j); }
      idx[i] = j;
    }
    return { idx, pal, colours: hist.size };
  };
  // the art raster of a panel: flattened, optionally faded to white on unbounded sides (B6, baked in: no SMask),
  // encoded as grey (B/W), indexed (flat tones) or RGB (continuous tone). Returns {url, box, lum, w, h, enc, bytes}
  XD.art = async (url, box, o = {}) => {
    const r = await XD.decode(url), { w, h, rgb } = r, n = w * h;
    if (o.fade) {
      const f = o.fade, ppt = w / o.wpt; // pixels per pt
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        let k = 1;
        const dd = [[f.l, x], [f.r, w - 1 - x], [f.t, y], [f.b, h - 1 - y]];
        for (const [pt, dist] of dd) if (pt) { const u = Math.min(1, dist / (pt * ppt)); k = Math.min(k, u * u * (3 - 2 * u)); }
        if (k < 1) { const i = 3 * (y * w + x); for (let c = 0; c < 3; c++) rgb[i + c] = 255 - (255 - rgb[i + c]) * k; }
      }
    }
    if (o.fill) { // a hole the renderer left (an unresolved sample): paint it with the mean tone (B3)
      const { x, y, rad, tone } = o.fill;
      for (let yy = Math.max(0, y - rad); yy < Math.min(h, y + rad); yy++) for (let xx = Math.max(0, x - rad); xx < Math.min(w, x + rad); xx++) {
        const i = 3 * (yy * w + xx); if ((xx - x) ** 2 + (yy - y) ** 2 < rad * rad && rgb[i] > 250 && rgb[i + 1] > 250) rgb.set(tone, i);
      }
    }
    const lum = new Uint8Array(n);
    for (let i = 0; i < n; i++) lum[i] = Math.round(0.2126 * rgb[3 * i] + 0.7152 * rgb[3 * i + 1] + 0.0722 * rgb[3 * i + 2]);
    let px;
    if (o.mode === 'grey') px = { w, h, type: 0, data: lum };
    else if (o.mode === 'indexed') { const q = toIndexed(rgb, n); px = { w, h, type: 3, data: q.idx, palette: q.pal }; }
    else px = { w, h, type: 2, data: rgb };
    const png = await XD.encodePNG(px);
    return { url: 'data:image/png;base64,' + b64(png), box, lum, w, h, enc: ['grey', '', 'rgb', 'indexed'][px.type], bytes: png.length };
  };

  // ---------- the figure ----------
  XD.svg = (spec) => {
    const meta = spec.meta ? `<metadata id="${XD.ns}-meta"><![CDATA[${JSON.stringify(spec.meta)}]]></metadata>` : '';
    const glyphs = [...XD.glyphs.entries()].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('');
    const W = f2(spec.W), H = f2(spec.H);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}pt" height="${H}pt" viewBox="0 0 ${W} ${H}">${meta}<defs>${glyphs}${spec.defs || ''}</defs><rect width="${W}" height="${H}" fill="#ffffff"/>${spec.items.join('')}</svg>`;
    return { svg, W: +W, H: +H, meta: spec.meta || null, boxes: XD.boxes.slice(), lines: spec.lines || [], glyphs: Object.fromEntries(XD.glyphs) };
  };

  // point markers (A5: shape carries identity in grey): dot | square | tri | diamond | ring | cross
  XD.marker = (kind, px, py, r, fill, stroke, sw) => {
    const P = (pts) => `<path d="M${pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    if (kind === 'ring') return `<circle cx="${f2(px)}" cy="${f2(py)}" r="${f2(r)}" fill="#fff" stroke="${stroke}" stroke-width="${sw}"/>`;
    if (kind === 'cross') return `<path d="M${f2(px - r)} ${f2(py - r)}l${f2(2 * r)} ${f2(2 * r)}M${f2(px - r)} ${f2(py + r)}l${f2(2 * r)} ${f2(-2 * r)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
    if (kind === 'square') { const s = r * 0.9; return P([[px - s, py - s], [px + s, py - s], [px + s, py + s], [px - s, py + s]]); }
    if (kind === 'tri') { const s = r * 1.25; return P([[px, py - s], [px + s * 0.866, py + s * 0.5], [px - s * 0.866, py + s * 0.5]]); }
    if (kind === 'diamond') { const s = r * 1.2; return P([[px, py - s], [px + s, py], [px, py + s], [px - s, py]]); }
    return `<circle cx="${f2(px)}" cy="${f2(py)}" r="${f2(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  };
  // an open chevron (orientation mark, B6) with its tip at (x, y) along angle th
  XD.chevron = (x, y, th, L = 3.4, color = '#000', lw = 0.8) => {
    const c = Math.cos(th), s = Math.sin(th), W = L * 0.62;
    const P = (u, v) => `${f2(x + u * c - v * s)} ${f2(y + u * s + v * c)}`;
    return `<path d="M${P(-L, W)}L${P(0, 0)}L${P(-L, -W)}" fill="none" stroke="${color}" stroke-width="${lw}" stroke-linejoin="miter" stroke-linecap="butt"/>`;
  };
  XD.arrowHead = (x, y, th, L = 4, color = '#000') => {
    const c = Math.cos(th), s = Math.sin(th), W = L * 0.36;
    const P = (u, v) => `${f2(x + u * c - v * s)} ${f2(y + u * s + v * c)}`;
    return `<path d="M${P(0, 0)}L${P(-L, W)}L${P(-L * 0.72, 0)}L${P(-L, -W)}Z" fill="${color}" stroke="none"/>`;
  };
  XD.mapArrow = (x0, x1, y, labelTex, pt = 9, lw = 0.5, color = '#000') => {
    const L = 4.2;
    let m = `<path d="M${f2(x0)} ${f2(y)}H${f2(x1 - L * 0.6)}" stroke="${color}" stroke-width="${lw}" fill="none"/>` + XD.arrowHead(x1, y, 0, L, color);
    if (labelTex) m += XD.at(XD.tex(labelTex, pt, color), (x0 + x1) / 2, y - 2.6, 'middle', 'bottom', 'arrow');
    return m;
  };

  // a plane panel. o: {x, y, w, h, box, art: [XD.art results], curves: [{pts, w, color, dash, cap, casing}], points,
  // axes: 'box'|'cross'|'none', step, tickPt, labelPt, ylab: 'left'|'right'|'none', xlab, ink, lw, axisTitles, over}
  XD.panel = (o) => {
    const id = `${XD.ns}-c${++uid}`;
    const { x, y, w, h, box } = o;
    const sx = w / (box.x1 - box.x0), sy = h / (box.y1 - box.y0);
    const X = (re) => x + (re - box.x0) * sx, Y = (im) => y + (box.y1 - im) * sy;
    const ink = o.ink || '#000';
    const lw = Object.assign({ frame: 0.5, tick: 0.5, axis: 0.6 }, o.lw || {});
    const tp = o.tickPt || 8, lp = o.labelPt || 9;
    const defs = `<clipPath id="${id}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}"/></clipPath>`;
    let g = '';
    for (const a of o.art || []) g += `<image x="${f2(X(a.box.x0))}" y="${f2(Y(a.box.y1))}" width="${f2((a.box.x1 - a.box.x0) * sx)}" height="${f2((a.box.y1 - a.box.y0) * sy)}" preserveAspectRatio="none" xlink:href="${a.url}"/>`;
    // obstacles for the placer: every curve, densified to 1 pt steps, in pt
    const obst = [];
    const dens = (seg) => { for (let i = 1; i < seg.length; i++) { const ax = X(seg[i - 1][0]), ay = Y(seg[i - 1][1]), bx = X(seg[i][0]), by = Y(seg[i][1]); const n = Math.min(400, Math.ceil(Math.hypot(bx - ax, by - ay))); for (let k = 0; k <= n; k++) obst.push([ax + (bx - ax) * k / Math.max(1, n), ay + (by - ay) * k / Math.max(1, n)]); } };
    for (const c of o.curves || []) {
      let d = '';
      for (const seg of c.pts) { d += 'M' + seg.map((p) => `${f2(X(p[0]))} ${f2(Y(p[1]))}`).join('L'); dens(seg); }
      const attrs = `fill="none" stroke-linejoin="round" stroke-linecap="${c.cap || 'round'}"${c.dash ? ` stroke-dasharray="${c.dash}"` : ''}`;
      if (c.casing) g += `<path d="${d}" ${attrs.replace(/ stroke-dasharray="[^"]*"/, '')} stroke="#ffffff" stroke-width="${f2((c.w || 0.6) + 2 * c.casing)}"/>`;
      g += `<path d="${d}" ${attrs} stroke="${c.color || ink}" stroke-width="${c.w || 0.6}"/>`;
    }
    if (o.under) g += o.under(X, Y);
    const body = `<g clip-path="url(#${id})">${g}</g>`;
    // the luminance of the art under a pt rectangle: [mean, std, min]
    const under = (b) => {
      let s = 0, s2 = 0, n = 0, mn = 255;
      for (const a of o.art || []) {
        const ax = X(a.box.x0), ay = Y(a.box.y1), kx = a.w / ((a.box.x1 - a.box.x0) * sx), ky = a.h / ((a.box.y1 - a.box.y0) * sy);
        const i0 = Math.max(0, Math.floor((b.x0 - ax) * kx)), i1 = Math.min(a.w - 1, Math.ceil((b.x1 - ax) * kx));
        const j0 = Math.max(0, Math.floor((b.y0 - ay) * ky)), j1 = Math.min(a.h - 1, Math.ceil((b.y1 - ay) * ky));
        const st = Math.max(1, Math.floor((i1 - i0) / 24));
        for (let j = j0; j <= j1; j += st) for (let i = i0; i <= i1; i += st) { const v = a.lum[j * a.w + i]; s += v; s2 += v * v; n++; if (v < mn) mn = v; }
      }
      if (!n) return [255, 0, 255];
      const m = s / n; return [m, Math.sqrt(Math.max(0, s2 / n - m * m)), mn];
    };
    const hits = (b, pad = 0.6) => { let k = 0; for (const p of obst) if (p[0] > b.x0 - pad && p[0] < b.x1 + pad && p[1] > b.y0 - pad && p[1] < b.y1 + pad) k++; return k; };
    const overlaps = (b) => XD.boxes.some((q) => q.x0 < b.x1 + 0.8 && q.x1 > b.x0 - 0.8 && q.y0 < b.y1 + 0.8 && q.y1 > b.y0 - 0.8);
    // axes
    const step = o.step || niceStep(Math.max(box.x1 - box.x0, box.y1 - box.y0), 4);
    const dec = XD.decimals(step);
    const xt = XD.ticks(box.x0, box.x1, step), yt = XD.ticks(box.y0, box.y1, step);
    const lines = [];
    let out = '';
    if (o.axes === 'box') {
      const L = o.tickLen == null ? 2.5 : o.tickLen;
      let d = '';
      if (L > 0) {
        for (const t of xt) { const px = X(t); if (px < x + 0.5 || px > x + w - 0.5) continue; d += `M${f2(px)} ${f2(y + h)}v${-L}M${f2(px)} ${f2(y)}v${L}`; }
        for (const t of yt) { const py = Y(t); if (py < y + 0.5 || py > y + h - 0.5) continue; d += `M${f2(x)} ${f2(py)}h${L}M${f2(x + w)} ${f2(py)}h${-L}`; }
        out += `<path d="${d}" stroke="${ink}" stroke-width="${lw.tick}" fill="none"/>`;
      }
      out += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="none" stroke="${ink}" stroke-width="${lw.frame}"/>`;
      lines.push({ x0: x, y0: y, x1: x + w, y1: y + h, kind: 'frame' });
      if (o.xlab !== 'none') for (const t of xt) out += XD.at(XD.tex(XD.tickTex(t, dec), tp, ink), X(t), y + h + 3.2, 'middle', 'top', 'tick');
      if (o.ylab === 'left') for (const t of yt) out += XD.at(XD.tex(XD.tickTex(t, dec), tp, ink), x - 2.5, Y(t), 'end', 'mid', 'tick');
      if (o.ylab === 'right') {
        // B5: right-aligned in a column, so units digits line up and the minus hangs left
        const its = yt.map((t) => XD.tex(XD.tickTex(t, dec), tp, ink)), mw = Math.max(...its.map((i) => i.w));
        yt.forEach((t, i) => { out += XD.at(its[i], x + w + 2.5 + mw, Y(t), 'end', 'mid', 'tick'); });
      }
    } else if (o.axes === 'cross') {
      // textbook axes: through 0, arrowheads at the positive ends, names beyond the tips (B6)
      const L = 1.8, ah = o.arrowLen || 4.6;
      const ox = Math.min(Math.max(X(0), x), x + w), oy = Math.min(Math.max(Y(0), y), y + h);
      const tipX = x + w + ah * 0.3, tipY = y - ah * 0.3;
      let d = `M${f2(x)} ${f2(oy)}H${f2(tipX - ah * 0.6)}M${f2(ox)} ${f2(y + h)}V${f2(tipY + ah * 0.6)}`;
      for (const t of xt) { if (Math.abs(t) < 1e-12) continue; const px = X(t); if (px > tipX - ah - 1) continue; d += `M${f2(px)} ${f2(oy - L)}v${2 * L}`; }
      for (const t of yt) { if (Math.abs(t) < 1e-12) continue; const py = Y(t); if (py < tipY + ah + 1) continue; d += `M${f2(ox - L)} ${f2(py)}h${2 * L}`; }
      out += `<path d="${d}" stroke="${ink}" stroke-width="${lw.axis}" fill="none"/>`;
      out += XD.arrowHead(tipX, oy, 0, ah, ink) + XD.arrowHead(ox, tipY, -Math.PI / 2, ah, ink);
      for (let k = 0; k <= 60; k++) { obst.push([x + (tipX - x) * k / 60, oy]); obst.push([ox, y + h + (tipY - y - h) * k / 60]); }
      if (o.axisTitles) {
        out += XD.at(XD.tex(o.axisTitles[0], lp, ink), tipX + 2, oy, 'start', 'mid', 'axis-name');
        out += XD.at(XD.tex(o.axisTitles[1], lp, ink), ox, tipY - 2, 'middle', 'bottom', 'axis-name');
      }
      // tick labels in the textbook places; a label that would sit on a drawn curve moves diagonally, away from it
      for (const t of xt) {
        if (Math.abs(t) < 1e-12) continue; const px = X(t); if (px > tipX - ah - 1) continue;
        const it = XD.tex(XD.tickTex(t, dec), tp, ink);
        const cands = [[px, oy + L + 1.2, 'middle', 'top'], [px + 1.2, oy + L + 0.8, 'start', 'top'], [px - 1.2, oy + L + 0.8, 'end', 'top'], [px + 1.2, oy - L - 0.8, 'start', 'bottom']];
        const c = cands.find((q) => !hits(XD.boxOf(it, ...q), 0.4)) || cands[0];
        out += XD.at(it, ...c, 'tick');
      }
      for (const t of yt) {
        if (Math.abs(t) < 1e-12) continue; const py = Y(t); if (py < tipY + ah + 1) continue;
        const it = XD.tex(XD.tickTex(t, dec), tp, ink);
        const cands = [[ox - L - 1.2, py, 'end', 'mid'], [ox - L - 0.8, py - 1.2, 'end', 'bottom'], [ox - L - 0.8, py + 1.2, 'end', 'top'], [ox + L + 1.2, py, 'start', 'mid']];
        const c = cands.find((q) => !hits(XD.boxOf(it, ...q), 0.4)) || cands[0];
        out += XD.at(it, ...c, 'tick');
      }
    }
    // points, then their labels by the placer: inside the panel, off curves and other labels, on one flat tone
    const DIRS = ['ne', 'nw', 'se', 'sw', 'e', 'w', 'n', 's'];
    for (const p of o.points || []) {
      const px = X(p.z[0]), py = Y(p.z[1]), r = p.r || 1.5;
      out += XD.marker(p.kind || 'dot', px, py, r, p.fill || ink, p.stroke || (p.kind === 'ring' || p.kind === 'cross' ? ink : '#fff'), p.sw == null ? (p.kind === 'ring' ? 0.6 : p.kind === 'cross' ? 0.6 : 0.4) : p.sw);
      for (let k = 0; k <= 24; k++) obst.push([px + (r + 0.3) * Math.cos(k * Math.PI / 12), py + (r + 0.3) * Math.sin(k * Math.PI / 12)]);
    }
    for (const p of o.points || []) {
      if (!p.label) continue;
      const px = X(p.z[0]), py = Y(p.z[1]), r = p.r || 1.5, it = XD.tex(p.label, p.lpt || lp, p.lcolor || ink), gap = r + 1.4;
      const place = (at) => {
        const dx = /e/.test(at) ? gap : /w/.test(at) ? -gap : 0, dy = /n/.test(at) ? -gap : /s/.test(at) ? gap : 0;
        const ax = dx > 0 ? 'start' : dx < 0 ? 'end' : 'middle', ay = dy < 0 ? 'bottom' : dy > 0 ? 'top' : 'mid';
        return [px + dx * (dy ? 0.75 : 1), py + dy * (dx ? 0.75 : 1), ax, ay];
      };
      const list = p.at && p.at !== 'auto' ? [p.at] : DIRS;
      let best = null;
      list.forEach((at, i) => {
        const q = place(at), b = XD.boxOf(it, ...q);
        const inside = b.x0 >= x + 1 && b.x1 <= x + w - 1 && b.y0 >= y + 1 && b.y1 <= y + h - 1;
        const [m, sd] = under(b);
        const score = (inside || o.axes !== 'box' ? 0 : 1000) + (overlaps(b) ? 500 : 0) + 40 * Math.min(10, hits(b)) + sd * 1.5 + (255 - m) * 0.04 + i * 0.6;
        if (!best || score < best.score) best = { score, q, b };
      });
      const [, , mn] = under(best.b);
      const halo = p.halo === false ? 0 : mn < 240 ? 0.4 : 0; // A6: only where the box overlaps a fill
      out += XD.at(it, ...best.q, 'point-label', halo);
    }
    if (o.over) out += o.over(X, Y, { hits, under, overlaps });
    return { markup: body + out, defs, X, Y, step, xt, yt, lines, hits, under };
  };

  XD.bp = (texpt) => texpt * 72 / 72.27;
  // A9: captions inside images are set flush left, ragged right (no stretched spaces, no rivers)
  XD.caption = (segs, x0, y0, W, pt, color = '#000') => {
    const words = []; let cur = [];
    const sp = pt * 0.333;
    for (const s of segs) {
      if (s.m != null) { cur.push(XD.tex(s.m, pt, color)); continue; }
      const text = s.b != null ? s.b : s.t;
      for (const p of text.split(/(\s+)/)) {
        if (!p) continue;
        if (/^\s+$/.test(p)) { if (cur.length) { words.push(cur); cur = []; } continue; }
        const esc = p.replace(/([#$%&_{}])/g, '\\$1');
        cur.push(XD.tex(s.b != null ? `\\textbf{${esc}}` : `\\text{${esc}}`, pt, color));
      }
    }
    if (cur.length) words.push(cur);
    const lines = []; let line = [], lw = 0;
    for (const wd of words) {
      const ww = wd.reduce((a, it) => a + it.w, 0);
      if (line.length && lw + sp + ww > W) { lines.push(line); line = []; lw = 0; }
      line.push(wd); lw += (line.length > 1 ? sp : 0) + ww;
    }
    if (line.length) lines.push(line);
    const lh = pt * 1.2;
    let m = '', y = y0 + pt * 0.75;
    for (const ln of lines) { let x = x0; for (const wd of ln) { for (const it of wd) { m += XD.at(it, x, y, 'start', 'base', 'caption'); x += it.w; } x += sp; } y += lh; }
    return { markup: m, h: lines.length ? (lines.length - 1) * lh + pt * 1.05 : 0, lines: lines.length };
  };

  // ---------- formats ----------
  const load = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = rej; document.head.append(s); });
  XD.pdf = async (fig, meta) => {
    if (!(window.jspdf && window.jspdf.jsPDF)) await load('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
    if (!(window.svg2pdf && window.svg2pdf.svg2pdf)) await load('https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js');
    const doc = new window.jspdf.jsPDF({ unit: 'pt', format: [fig.W, fig.H], orientation: fig.W > fig.H ? 'landscape' : 'portrait', compress: true, putOnlyUsedFonts: true });
    doc.setProperties({ title: (meta && meta.title) || 'Figure', creator: 'Complex Map Workbench', subject: (meta && meta.subject) || '' });
    if (meta && doc.addMetadata) {
      const json = JSON.stringify(meta).replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
      doc.addMetadata(`<cmw:scene>${json}</cmw:scene>`, 'https://complex-map-workbench/ns/1.0/');
    }
    // A1: svg2pdf draws a <use> under an ExtGState with /CA 0 (PDF 1.4 transparency). The SVG keeps one shared glyph
    // table (B7); for the PDF every <use> is inlined as the glyph's own path, so the file has no transparency at all.
    const src = fig.svg.replace(/<use([^>]*?)\sxlink:href="#([^"]+)"([^>]*?)\/>/g, (m, a, id, b) => {
      const at = a + b, x = /\sx="([^"]*)"/.exec(at), y = /\sy="([^"]*)"/.exec(at), rest = at.replace(/\s[xy]="[^"]*"/g, '');
      const path = `<path${rest} d="${(fig.glyphs || {})[id] || ''}"/>`;
      return x || y ? `<g transform="translate(${x ? x[1] : 0} ${y ? y[1] : 0})">${path}</g>` : path;
    });
    const el = new DOMParser().parseFromString(src, 'image/svg+xml').documentElement;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden';
    host.append(el); document.body.append(host);
    try { await window.svg2pdf.svg2pdf(el, doc, { x: 0, y: 0, width: fig.W, height: fig.H }); } finally { host.remove(); }
    return doc.output('datauristring');
  };
  // PNG of the whole figure at dpi: opaque (RGB, or grey for B/W), pHYs, the scene in iTXt
  XD.png = async (fig, dpi = 300, meta, grey = false) => {
    const img = new Image();
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(fig.svg);
    await img.decode();
    const k = dpi / 72, c = document.createElement('canvas');
    c.width = Math.round(fig.W * k); c.height = Math.round(fig.H * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    const id = ctx.getImageData(0, 0, c.width, c.height).data, n = c.width * c.height;
    let px;
    if (grey) { const g = new Uint8Array(n); for (let i = 0; i < n; i++) g[i] = Math.round(0.2126 * id[4 * i] + 0.7152 * id[4 * i + 1] + 0.0722 * id[4 * i + 2]); px = { w: c.width, h: c.height, type: 0, data: g }; }
    else { const rgb = new Uint8Array(n * 3); for (let i = 0; i < n; i++) { rgb[3 * i] = id[4 * i]; rgb[3 * i + 1] = id[4 * i + 1]; rgb[3 * i + 2] = id[4 * i + 2]; } px = { w: c.width, h: c.height, type: 2, data: rgb }; }
    const png = await XD.encodePNG(px, { dpi, meta });
    return { url: 'data:image/png;base64,' + b64(png), w: c.width, h: c.height };
  };
  // a grey proof (M3): what a laser printer or a grey conversion shows, as an 8-bit grey PNG at dpi
  XD.greyProof = (fig, dpi = 200) => XD.png(fig, dpi, null, true);
})();
