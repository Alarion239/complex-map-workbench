// The figure export (notes/export-design, round 2, as built: AS-BUILT.md). A composer that sets every label in
// Computer Modern outlines at its printed size, the presets (Article, Homework, Slides), the views (X -> Y, Phase in
// colour and black and white, Landscape, the deformation's filmstrip and paths), the formats (PDF without fonts or
// transparency, our own opaque PNG with pHYs, SVG, the LaTeX snippet) and the Export figure dialog.
// The app attaches its renderer and state with Figure.attach (app.js). Units are PostScript points (bp): the SVG
// viewBox is in bp, so a label set at 8 pt prints at 8 pt when the figure is included at natural size.
const Figure = (() => {
  let A = null; // the app bridge
  // the language (src/i18n.js, notes/i18n/DESIGN.md 5): the dialog speaks the interface language; a figure keeps its
  // caption language (o.lang: the dialog's caption-language switch, else the interface's). Its words, panel letters,
  // tick labels (0{,}5), notation (tg, sh, ln) and LaTeX comments follow it. English output is unchanged.
  const I18 = typeof I18N !== 'undefined' ? I18N : null;
  const $t = I18 ? I18.t : (s, p) => (p ? s.replace(/%\{(\w+)\}|\{(\w+)\}/g, (m, a, b) => { const k = a || (!/[$\\]/.test(s) && b); return k && k in p ? String(p[k]) : m; }) : s);
  const $tx = I18 ? I18.tx : (c, s, p) => $t(s, p);
  const $tn = I18 ? I18.tn : (one, many, n, p) => $t(n === 1 ? one : many, Object.assign({ n }, p));
  const using = (l, fn) => (I18 && l ? I18.using(l, fn) : fn());
  const uiLang = () => (I18 ? I18.lang : 'en');
  // a number in TeX in the current language (0{,}5 in Russian); English: as it is
  const tnum = (x) => (I18 ? I18.texNum(x) : String(x));
  const RU_LETTERS = 'абвгдежзиклм';
  // the sound cues (notes/sound/DESIGN.md): "export ready" after a copy; a save cues in A.saveFile itself
  const cueDone = () => { if (A && A.soundDone) A.soundDone(); };
  const cueError = () => { if (A && A.soundError) A.soundError(); };
  // =====================================================================================================
  // 1. The composer (from notes/export-design/proto/compose.js)
  // =====================================================================================================
  const XD = {};
  const f2 = (v) => (Math.round(v * 100) / 100).toString();
  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h * 33) ^ s.charCodeAt(i)) >>> 0; return h.toString(36).slice(0, 5); };
  let uid = 0;
  // one figure at a time: its id namespace, its glyph table, the boxes of everything typeset (for collision checks)
  XD.begin = (name, lang = 'en') => { XD.name = name; XD.lang = lang; XD.ns = 'cmw' + hash(name + ':' + Date.now()); XD.glyphs = new Map(); XD.boxes = []; uid = 0; };
  XD.begin('figure');
  XD.ready = () => !!(window.MathJax && typeof window.MathJax.tex2svg === 'function');

  // ---------- typography ----------
  // TeX -> {inner (markup in glyph units), glyphs [[key, d]], w, a, d (pt)}; MathJax's viewBox gives exact metrics
  const texCache = new Map();
  // a Russian figure: Russian notation (tg, sh, ln), and words with Cyrillic set from the CMU outlines of src/cyr.js
  // (MathJax's fonts have none: it would write <text> in a system font); the math stays MathJax's
  XD.tex = (tex, pt, color = '#000') => {
    if (XD.lang === 'ru' && I18) tex = I18.notation(tex, 'ru');
    if (typeof CYR === 'undefined' || !CYR.hasCyr(tex)) return mjTex(tex, pt, color);
    const key = `cyr|${pt}|${color}|${tex}`;
    if (texCache.has(key)) return texCache.get(key);
    const out = CYR.typeset(tex, pt, color, mjTex);
    texCache.set(key, out);
    return out;
  };
  const mjTex = (tex, pt, color = '#000') => {
    const key = `${pt}|${color}|${tex}`;
    if (texCache.has(key)) return texCache.get(key);
    let out;
    try {
      const node = window.MathJax.tex2svg(tex, { display: false });
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
      out = { inner, glyphs, w: vb[2] * k, a: -vb[1] * k, d: (vb[3] + vb[1]) * k, vb0: vb[0], k, tex, pt, color };
    } catch (e) {
      out = { inner: '', glyphs: [], w: 0, a: 0, d: 0, vb0: 0, k: pt / 1000, tex, pt, color };
    }
    if (texCache.size > 4000) texCache.clear();
    texCache.set(key, out);
    return out;
  };
  // the box a placement would occupy: {x0, y0, x1, y1, left, base}
  XD.boxOf = (it, x, y, ax = 'start', ay = 'base') => {
    const left = ax === 'middle' ? x - it.w / 2 : ax === 'end' ? x - it.w : x;
    const base = ay === 'top' ? y + it.a : ay === 'bottom' ? y - it.d : ay === 'mid' ? y + it.a / 2 - it.d / 2 : y;
    return { x0: left, x1: left + it.w, y0: base - it.a, y1: base + it.d, left, base };
  };
  XD.rec = null;
  // place a typeset item; ax: start|middle|end, ay: base|mid|top|bottom. kind tags the box for the preflight
  XD.at = (it, x, y, ax = 'start', ay = 'base', kind = 'label', halo = 0) => {
    const b = XD.boxOf(it, x, y, ax, ay);
    if (XD.rec) XD.rec.push({ tex: it.tex, pt: it.pt, color: it.color, x, y, ax, ay, halo });
    XD.boxes.push({ kind, tex: it.tex, x0: b.x0, y0: b.y0, x1: b.x1, y1: b.y1 });
    for (const [k, d] of it.glyphs) XD.glyphs.set(`${XD.ns}-${k}`, d);
    const inner = it.inner.split('@NS@').join(XD.ns);
    const g = `<g transform="translate(${f2(b.left - it.vb0 * it.k)} ${f2(b.base)}) scale(${+it.k.toFixed(6)})">`;
    let m = g + inner + '</g>';
    if (halo > 0) {
      // 0.4 pt of white OUTSIDE the glyph (a stroke of twice that, centred on the outline, under the label)
      const sw = (2 * halo * 1000 / it.pt).toFixed(0);
      const own = inner.indexOf(' stroke-linejoin="miter"') >= 0 ? inner.replace(/ stroke="[^"]*" stroke-width="[^"]*" stroke-linejoin="miter"/g, '') : inner;
      m = g + own.split(`fill="${it.color}"`).join(`fill="#ffffff" stroke="#ffffff" stroke-width="${sw}" stroke-linejoin="round"`) + '</g>' + m;
    }
    return m;
  };

  // ---------- numbers ----------
  const niceStep = (span, n) => { const raw = span / n, e = Math.floor(Math.log10(raw)), b = raw / 10 ** e; return (b < 1.5 ? 1 : b < 3.5 ? 2 : b < 7.5 ? 5 : 10) * 10 ** e; };
  XD.niceStep = niceStep;
  // one precision per axis, the fewest decimals that represent every tick on it (0.90, 0.95, 1.00); a true minus
  XD.decimals = (step) => { for (let d = 0; d < 7; d++) if (Math.abs(step * 10 ** d - Math.round(step * 10 ** d)) < 1e-9) return d; return 6; };
  XD.tickTex = (v, dec) => { const t = (Math.abs(v) < 1e-12 ? 0 : v).toFixed(dec); return XD.lang === 'ru' && I18 ? I18.texNum(t, 'ru') : t; };
  XD.ticks = (a, b, step) => { const out = []; for (let i = Math.ceil(a / step - 1e-9); i <= Math.floor(b / step + 1e-9); i++) out.push(i * step); return out; };
  // each axis keeps at least two labelled (non-zero) ticks: a narrow panel's short axis gets a finer step of its own
  XD.axisSteps = (box, step) => {
    // (labelled: not 0, and not on the frame's edges, where cross axes leave them out)
    const n = (a0, a1, st) => XD.ticks(a0, a1, st).filter((t) => Math.abs(t) > 1e-9 * st && t > a0 + 0.06 * (a1 - a0) && t < a1 - 0.06 * (a1 - a0)).length;
    const fine = (a0, a1) => { let st = step; for (let k = 0; k < 6 && n(a0, a1, st) < 2; k++) st = niceStep(st * 0.45, 1); return st; };
    return [fine(box.x0, box.x1), fine(box.y0, box.y1)];
  };
  // adaptive samples of a parametric curve f(t) -> [x, y] | null; polylines break where f is not finite or jumps
  XD.sample = (f, t0, t1, n = 256, tol = 0.002, jump = Infinity) => {
    const out = [[]];
    const P = (t) => { const p = f(t); return p && Number.isFinite(p[0]) && Number.isFinite(p[1]) && Math.abs(p[0]) < 1e6 && Math.abs(p[1]) < 1e6 ? p : null; };
    const rec = (ta, pa, tb, pb, depth) => {
      const tm = (ta + tb) / 2, pm = P(tm);
      if (!pa || !pb || !pm) { if (depth < 14 && pm) { rec(ta, pa, tm, pm, depth + 1); rec(tm, pm, tb, pb, depth + 1); } return; }
      const mx = (pa[0] + pb[0]) / 2, my = (pa[1] + pb[1]) / 2;
      const dev = Math.hypot(pm[0] - mx, pm[1] - my), len = Math.hypot(pb[0] - pa[0], pb[1] - pa[1]);
      if (depth < 16 && (dev > tol || len > 0.2 * (1 + Math.hypot(pa[0], pa[1])))) { rec(ta, pa, tm, pm, depth + 1); rec(tm, pm, tb, pb, depth + 1); return; }
      if (len > jump) { out.push([pb]); return; }
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
  // a yield between the steps of a large raster, so input and frames run between them (scheduler.postTask has no
  // clamp, unlike a nested setTimeout(0))
  const breathe = () => (typeof scheduler !== 'undefined' && scheduler && typeof scheduler.postTask === 'function'
    ? scheduler.postTask(() => {}) : new Promise((r) => setTimeout(r, 0)));
  // a loop over many pixels in slices: after each 64 K pixels, a yield once 8 ms have passed (a run of the dialog
  // measured one 60 ms palette pass among the usual 10 ms ones)
  const SLICE = 1 << 16;
  const sliced = async (n, body) => {
    let t0 = performance.now();
    for (let i0 = 0; i0 < n; i0 += SLICE) {
      body(i0, Math.min(n, i0 + SLICE));
      if (performance.now() - t0 > 8 && i0 + SLICE < n) { await breathe(); t0 = performance.now(); }
    }
  };
  // flat-tone art as indexed colour (<= 256 entries; two tones + their anti-aliasing ramps need ~40)
  // The histogram and the lookup are typed arrays over the 2^18 keys (6 bits a channel). With Maps this took 30–40 ms
  // on a 1–2.5 Mpx panel, and the export dialog's preview held the main thread over 50 ms. The output is the same:
  // the keys are kept in order of first appearance, and the sort is stable, so ties keep that order as before.
  const toIndexed = async (rgb, n) => {
    const cnt = new Uint32Array(1 << 18), seen = [];
    await sliced(n, (i0, i1) => { for (let i = i0; i < i1; i++) { const k = ((rgb[3 * i] >> 2) << 12) | ((rgb[3 * i + 1] >> 2) << 6) | (rgb[3 * i + 2] >> 2); if (cnt[k]++ === 0) seen.push(k); } });
    const keys = seen.slice().sort((a, b) => cnt[b] - cnt[a]).slice(0, 256);
    const pal = keys.map((k) => [((k >> 12) & 63) * 4 + 2, ((k >> 6) & 63) * 4 + 2, (k & 63) * 4 + 2].map((v) => Math.min(255, v)));
    // pure white and black stay exact
    keys.forEach((k, i) => { if (k === 0x3ffff) pal[i] = [255, 255, 255]; if (k === 0) pal[i] = [0, 0, 0]; });
    // slot[k]: the palette entry of key k, -1 until known (a key outside the palette gets its nearest entry, found once)
    const slot = new Int16Array(1 << 18).fill(-1), idx = new Uint8Array(n);
    keys.forEach((k, i) => { slot[k] = i; });
    await sliced(n, (i0, i1) => {
      for (let i = i0; i < i1; i++) {
        const k = ((rgb[3 * i] >> 2) << 12) | ((rgb[3 * i + 1] >> 2) << 6) | (rgb[3 * i + 2] >> 2);
        let j = slot[k];
        if (j < 0) { let best = 1e9; pal.forEach((c, q) => { const e = (c[0] - rgb[3 * i]) ** 2 + (c[1] - rgb[3 * i + 1]) ** 2 + (c[2] - rgb[3 * i + 2]) ** 2; if (e < best) { best = e; j = q; } }); slot[k] = j; }
        idx[i] = j;
      }
    });
    return { idx, pal, colours: seen.length };
  };
  // the art raster of a panel {w, h, rgb} -> flattened, optionally faded to white on unbounded sides (baked in: no
  // SMask), encoded as grey (B/W), indexed (flat tones, when they fit) or RGB (continuous tone)
  // (A panel at 600 dpi has 1 to 4 Mpx. Each step below runs in its own task, so none holds the main thread near 50 ms
  // while the dialog's preview is made.)
  XD.art = async (r, box, o = {}) => {
    const { w, h } = r, rgb = r.rgb, n = w * h;
    await breathe();
    if (o.fade) {
      // k = the smallest smoothstep over the faded sides. A column's sides (l, r) and a row's (t, b) are found once, so
      // k = min(column's, row's): the same numbers as taking all four per pixel
      const f = o.fade, ppt = w / o.wpt;
      const ramp = (pt, dist) => { const u = Math.min(1, dist / (pt * ppt)); return u * u * (3 - 2 * u); };
      const kx = new Float64Array(w), ky = new Float64Array(h);
      for (let x = 0; x < w; x++) { let k = 1; if (f.l) k = Math.min(k, ramp(f.l, x)); if (f.r) k = Math.min(k, ramp(f.r, w - 1 - x)); kx[x] = k; }
      for (let y = 0; y < h; y++) { let k = 1; if (f.t) k = Math.min(k, ramp(f.t, y)); if (f.b) k = Math.min(k, ramp(f.b, h - 1 - y)); ky[y] = k; }
      for (let y = 0; y < h; y++) {
        const kr = ky[y];
        for (let x = 0; x < w; x++) {
          const k = Math.min(kx[x], kr);
          if (k < 1) { const i = 3 * (y * w + x); rgb[i] = 255 - (255 - rgb[i]) * k; rgb[i + 1] = 255 - (255 - rgb[i + 1]) * k; rgb[i + 2] = 255 - (255 - rgb[i + 2]) * k; }
        }
      }
      await breathe();
    }
    const lum = new Uint8Array(n);
    for (let i = 0; i < n; i++) lum[i] = Math.round(0.2126 * rgb[3 * i] + 0.7152 * rgb[3 * i + 1] + 0.0722 * rgb[3 * i + 2]);
    let px, mode = o.mode;
    if (mode === 'indexed') {
      await breathe();
      const q = await toIndexed(rgb, n);
      if (q.colours > 600) mode = 'rgb'; else px = { w, h, type: 3, data: q.idx, palette: q.pal };
    }
    if (mode === 'grey') px = { w, h, type: 0, data: lum };
    else if (mode !== 'indexed') px = { w, h, type: 2, data: rgb };
    await breathe();
    const png = await XD.encodePNG(px);
    return { url: 'data:image/png;base64,' + b64(png), box, lum, w, h, enc: ['grey', '', 'rgb', 'indexed'][px.type], bytes: png.length };
  };

  // ---------- the figure ----------
  XD.svg = (spec) => {
    const meta = spec.meta ? `<metadata id="${XD.ns}-meta"><![CDATA[${JSON.stringify(spec.meta)}]]></metadata>` : '';
    const glyphs = [...XD.glyphs.entries()].map(([id, d]) => `<path id="${id}" d="${d}"/>`).join('');
    const W = f2(spec.W), H = f2(Math.ceil(spec.H * 100) / 100);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}pt" height="${H}pt" viewBox="0 0 ${W} ${H}">${meta}<defs>${glyphs}${spec.defs || ''}</defs><rect width="${W}" height="${H}" fill="#ffffff"/>${spec.items.join('')}</svg>`;
    return { svg, W: +W, H: +H, meta: spec.meta || null, boxes: XD.boxes.slice(), lines: spec.lines || [], glyphs: Object.fromEntries(XD.glyphs) };
  };
  // point markers (shape carries identity in grey): dot | square | tri | diamond | ring | cross
  XD.marker = (kind, px, py, r, fill, stroke, sw) => {
    const P = (pts) => `<path d="M${pts.map((p) => `${f2(p[0])} ${f2(p[1])}`).join('L')}Z" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>`;
    if (kind === 'ring') return `<circle cx="${f2(px)}" cy="${f2(py)}" r="${f2(r)}" fill="#ffffff" stroke="${stroke}" stroke-width="${sw}"/>`;
    if (kind === 'cross') return `<path d="M${f2(px - r)} ${f2(py - r)}l${f2(2 * r)} ${f2(2 * r)}M${f2(px - r)} ${f2(py + r)}l${f2(2 * r)} ${f2(-2 * r)}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round"/>`;
    if (kind === 'square') { const s = r * 0.9; return P([[px - s, py - s], [px + s, py - s], [px + s, py + s], [px - s, py + s]]); }
    if (kind === 'tri') { const s = r * 1.25; return P([[px, py - s], [px + s * 0.866, py + s * 0.5], [px - s * 0.866, py + s * 0.5]]); }
    if (kind === 'diamond') { const s = r * 1.2; return P([[px, py - s], [px + s, py], [px, py + s], [px - s, py]]); }
    return `<circle cx="${f2(px)}" cy="${f2(py)}" r="${f2(r)}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  };
  // an open chevron (orientation mark) with its tip at (x, y) along angle th
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
    const inPanel = (px, py) => px > x - 2 && px < x + w + 2 && py > y - 2 && py < y + h + 2;
    const dens = (seg) => { for (let i = 1; i < seg.length; i++) { const ax = X(seg[i - 1][0]), ay = Y(seg[i - 1][1]), bx = X(seg[i][0]), by = Y(seg[i][1]); if (!inPanel(ax, ay) && !inPanel(bx, by)) continue; const n = Math.min(400, Math.ceil(Math.hypot(bx - ax, by - ay))); for (let k = 0; k <= n; k++) obst.push([ax + (bx - ax) * k / Math.max(1, n), ay + (by - ay) * k / Math.max(1, n)]); } };
    // a polyline in pt, clipped loosely to the panel (points far outside are dropped so files stay small)
    const far = 4 * Math.max(w, h);
    const pathOf = (seg) => {
      let d = '', pen = false;
      for (const p of seg) {
        const px = X(p[0]), py = Y(p[1]);
        if (!(Math.abs(px - x - w / 2) < far && Math.abs(py - y - h / 2) < far)) { pen = false; continue; }
        d += (pen ? 'L' : 'M') + `${f2(px)} ${f2(py)}`; pen = true;
      }
      return d;
    };
    // (cross axes: a piece of a curve that lies along an axis is drawn again above it, so the axis never hides data)
    const axX = o.axes === 'cross' ? Math.min(Math.max(X(0), x), x + w) : null, axY = o.axes === 'cross' ? Math.min(Math.max(Y(0), y), y + h) : null;
    const alongAxis = (seg) => {
      if (axX == null || seg.length < 2) return false;
      let nx = 0, ny = 0, m = 0;
      for (const p of seg) { const px = X(p[0]), py = Y(p[1]); if (!inPanel(px, py)) continue; m++; if (Math.abs(px - axX) < 0.6) nx++; if (Math.abs(py - axY) < 0.6) ny++; }
      return m > 1 && (nx === m || ny === m);
    };
    let onAxis = '';
    for (const c of o.curves || []) {
      let d = '', da = '';
      for (const seg of c.pts) { const q = pathOf(seg); d += q; if (alongAxis(seg)) da += q; if (!c.noObst) dens(seg); }
      if (!d) continue;
      const attrs = `fill="none" stroke-linejoin="round" stroke-linecap="${c.cap || 'round'}"${c.dash ? ` stroke-dasharray="${c.dash}"` : ''}`;
      if (c.casing) g += `<path d="${d}" ${attrs.replace(/ stroke-dasharray="[^"]*"/, '')} stroke="#ffffff" stroke-width="${f2((c.w || 0.6) + 2 * c.casing)}"/>`;
      g += `<path d="${d}" ${attrs} stroke="${c.color || ink}" stroke-width="${c.w || 0.6}"/>`;
      if (da) onAxis += `<path d="${da}" fill="none" stroke="#ffffff" stroke-width="${f2((c.w || 0.6) + 0.5)}"/><path d="${da}" ${attrs} stroke="${c.color || ink}" stroke-width="${c.w || 0.6}"/>`;
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
    const [stX, stY] = XD.axisSteps(box, step);
    const decX = XD.decimals(stX), decY = XD.decimals(stY);
    const xt = XD.ticks(box.x0, box.x1, stX), yt = XD.ticks(box.y0, box.y1, stY);
    const lines = [];
    let out = '';
    if (o.axes === 'box') {
      const L = o.tickLen == null ? 2.5 : o.tickLen;
      let d = '';
      if (L > 0) {
        for (const t of xt) { const px = X(t); if (px < x + 0.5 || px > x + w - 0.5) continue; d += `M${f2(px)} ${f2(y + h)}v${-L}M${f2(px)} ${f2(y)}v${L}`; }
        for (const t of yt) { const py = Y(t); if (py < y + 0.5 || py > y + h - 0.5) continue; d += `M${f2(x)} ${f2(py)}h${L}M${f2(x + w)} ${f2(py)}h${-L}`; }
        if (d) out += `<path d="${d}" stroke="${ink}" stroke-width="${lw.tick}" fill="none"/>`;
      }
      out += `<rect x="${f2(x)}" y="${f2(y)}" width="${f2(w)}" height="${f2(h)}" fill="none" stroke="${ink}" stroke-width="${lw.frame}"/>`;
      lines.push({ x0: x, y0: y, x1: x + w, y1: y + h, kind: 'frame' });
      if (o.xlab !== 'none') {
        // labels that would touch their neighbours are thinned (every other one)
        const its = xt.map((t) => XD.tex(XD.tickTex(t, decX), tp, ink));
        const gapOk = (k) => { for (let i = k; i < xt.length; i += k) { const a = XD.boxOf(its[i - k], X(xt[i - k]), 0, 'middle'), b = XD.boxOf(its[i], X(xt[i]), 0, 'middle'); if (b.x0 - a.x1 < 2.5) return false; } return true; };
        const every = gapOk(1) ? 1 : 2;
        const tr = o.xtrim || {};
        xt.forEach((t, i) => {
          if (!(i % every === 0 || every === 1)) return;
          const b = XD.boxOf(its[i], X(t), 0, 'middle');
          if ((tr.l && b.x0 < x - 0.5) || (tr.r && b.x1 > x + w + 0.5)) return;
          out += XD.at(its[i], X(t), y + h + 3.2, 'middle', 'top', 'tick');
        });
      }
      if (o.ylab === 'left') for (const t of yt) { const it = XD.tex(XD.tickTex(t, decY), tp, ink); if (!overlaps(XD.boxOf(it, x - 2.5, Y(t), 'end', 'mid'))) out += XD.at(it, x - 2.5, Y(t), 'end', 'mid', 'tick'); }
      if (o.ylab === 'right') {
        // right-aligned in a column, so units digits line up and the minus hangs left
        const its = yt.map((t) => XD.tex(XD.tickTex(t, decY), tp, ink)), mw = Math.max(0, ...its.map((i) => i.w));
        yt.forEach((t, i) => { if (!overlaps(XD.boxOf(its[i], x + w + 2.5 + mw, Y(t), 'end', 'mid'))) out += XD.at(its[i], x + w + 2.5 + mw, Y(t), 'end', 'mid', 'tick'); });
      }
    } else if (o.axes === 'cross') {
      // textbook axes: through 0, arrowheads at the positive ends, names beyond the tips
      const L = 1.8, ah = o.arrowLen || 4.6;
      const ox = Math.min(Math.max(X(0), x), x + w), oy = Math.min(Math.max(Y(0), y), y + h);
      const tipX = x + w + ah * 0.3, tipY = y - ah * 0.3;
      let d = `M${f2(x)} ${f2(oy)}H${f2(tipX - ah * 0.6)}M${f2(ox)} ${f2(y + h)}V${f2(tipY + ah * 0.6)}`;
      for (const t of xt) { if (Math.abs(t) < 1e-12) continue; const px = X(t); if (px > tipX - ah - 1 || px < x + 1) continue; d += `M${f2(px)} ${f2(oy - L)}v${2 * L}`; }
      for (const t of yt) { if (Math.abs(t) < 1e-12) continue; const py = Y(t); if (py < tipY + ah + 1 || py > y + h - 1) continue; d += `M${f2(ox - L)} ${f2(py)}h${2 * L}`; }
      out += `<path d="${d}" stroke="${ink}" stroke-width="${lw.axis}" fill="none"/>`;
      out += XD.arrowHead(tipX, oy, 0, ah, ink) + XD.arrowHead(ox, tipY, -Math.PI / 2, ah, ink);
      for (let k = 0; k <= 60; k++) { obst.push([x + (tipX - x) * k / 60, oy]); obst.push([ox, y + h + (tipY - y - h) * k / 60]); }
      if (o.axisTitles) {
        out += XD.at(XD.tex(o.axisTitles[0], lp, ink), tipX + 2, oy, 'start', 'mid', 'axis-name');
        out += XD.at(XD.tex(o.axisTitles[1], lp, ink), ox, tipY - 2, 'middle', 'bottom', 'axis-name');
      }
      // tick labels in the textbook places; a label that would sit on a drawn curve moves diagonally, away from it;
      // failing that, it slides along its axis to the middle of the widest clear run (between two close lines)
      const clean = (it, q, pad) => !hits(XD.boxOf(it, ...q), pad) && !overlaps(XD.boxOf(it, ...q));
      const slide = (it, sl) => {
        for (const pad of [1.6, 1.2, 0.8, 0.4]) {
          let best = null, run = [];
          for (const q of sl.concat([null])) { if (q && clean(it, q, pad)) { run.push(q); continue; } if (run.length && (!best || run.length > best.length)) best = run; run = []; }
          if (best) return best[best.length >> 1];
        }
        return null;
      };
      const minor = o.minimal ? (t) => Math.abs(t) > 1 + 1e-9 || Math.abs(Math.abs(t) - 1) > 1e-9 : () => false;
      for (const t of xt) {
        if (Math.abs(t) < 1e-12 || minor(t)) continue; const px = X(t); if (px > tipX - ah - 1 || px < x + 1) continue;
        const it = XD.tex(XD.tickTex(t, decX), tp, ink);
        const cands = [[px, oy + L + 1.2, 'middle', 'top'], [px + 1.2, oy + L + 0.8, 'start', 'top'], [px - 1.2, oy + L + 0.8, 'end', 'top'], [px + 1.2, oy - L - 0.8, 'start', 'bottom']];
        // (then slid along the axis, at most half its width, so it still covers its tick: between two close lines)
        const sl = [];
        for (let d = -it.w / 2; d <= it.w / 2; d += 0.25) sl.push([px + d, oy + L + 1.2, 'middle', 'top']);
        const c = cands.find((q) => clean(it, q, 0.4)) || slide(it, sl) || cands[0];
        out += XD.at(it, ...c, 'tick', under(XD.boxOf(it, ...c))[2] < 240 ? 0.4 : 0);
      }
      for (const t of yt) {
        if (Math.abs(t) < 1e-12 || minor(t)) continue; const py = Y(t); if (py < tipY + ah + 1 || py > y + h - 1) continue;
        const it = XD.tex(XD.tickTex(t, decY), tp, ink);
        const cands = [[ox - L - 1.2, py, 'end', 'mid'], [ox - L - 0.8, py - 1.2, 'end', 'bottom'], [ox - L - 0.8, py + 1.2, 'end', 'top'], [ox + L + 1.2, py, 'start', 'mid']];
        const sl = [];
        for (let d = -(it.a + it.d) / 2; d <= (it.a + it.d) / 2; d += 0.25) sl.push([ox - L - 1.2, py + d, 'end', 'mid']);
        const c = cands.find((q) => clean(it, q, 0.4)) || slide(it, sl) || cands[0];
        out += XD.at(it, ...c, 'tick', under(XD.boxOf(it, ...c))[2] < 240 ? 0.4 : 0);
      }
    }
    if (onAxis) out += `<g clip-path="url(#${id})">${onAxis}</g>`;
    // points, then their labels by the placer: inside the panel, off curves and other labels, on one flat tone
    const DIRS = ['ne', 'nw', 'se', 'sw', 'e', 'w', 'n', 's'];
    const pts = (o.points || []).filter((p) => { const px = X(p.z[0]), py = Y(p.z[1]); return px >= x - 0.5 && px <= x + w + 0.5 && py >= y - 0.5 && py <= y + h + 0.5; });
    for (const p of pts) {
      const px = X(p.z[0]), py = Y(p.z[1]), r = p.r || 1.5;
      out += XD.marker(p.kind || 'dot', px, py, r, p.fill || ink, p.stroke || (p.kind === 'ring' || p.kind === 'cross' ? ink : '#ffffff'), p.sw == null ? (p.kind === 'ring' || p.kind === 'cross' ? 0.6 : 0.4) : p.sw);
      for (let k = 0; k <= 24; k++) obst.push([px + (r + 0.3) * Math.cos(k * Math.PI / 12), py + (r + 0.3) * Math.sin(k * Math.PI / 12)]);
    }
    for (const p of pts) {
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
      const halo = p.halo === false ? 0 : mn < 240 ? 0.4 : 0; // only where the box overlaps a fill
      out += XD.at(it, ...best.q, 'point-label', halo);
    }
    if (o.over) out += o.over(X, Y, { hits, under, overlaps });
    return { markup: body + out, defs, X, Y, step, xt, yt, lines, hits, under };
  };

  XD.bp = (texpt) => texpt * 72 / 72.27;
  // captions inside images are set flush left, ragged right (no stretched spaces, no rivers)
  XD.caption = (segs, x0, y0, W, pt, color = '#000') => {
    const words = []; let cur = [];
    const sp = pt * 0.333;
    for (const s of segs) {
      if (s.m != null) { cur.push(XD.tex(s.m, pt, color)); continue; }
      const text = s.b != null ? s.b : s.i != null ? s.i : s.t;
      for (const p of String(text).split(XD.lang === 'ru' ? /([ \t\r\n]+)/ : /(\s+)/)) {
        if (!p) continue;
        if (XD.lang === 'ru' ? /^[ \t\r\n]+$/.test(p) : /^\s+$/.test(p)) { if (cur.length) { words.push(cur); cur = []; } continue; }
        const esc = p.replace(/\\/g, '').replace(/([#$%&_{}])/g, '\\$1');
        cur.push(XD.tex(s.b != null ? `\\textbf{${esc}}` : s.i != null ? `\\textit{${esc}}` : `\\text{${esc}}`, pt, color));
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
  const loadScript = (src) => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.append(s); });
  let pdfLibs = null;
  const pdfLib = () => {
    if (!pdfLibs) pdfLibs = (async () => {
      if (!(window.jspdf && window.jspdf.jsPDF)) await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      if (!(window.svg2pdf && window.svg2pdf.svg2pdf)) await loadScript('https://cdn.jsdelivr.net/npm/svg2pdf.js@2.2.3/dist/svg2pdf.umd.min.js');
      return window.jspdf && window.svg2pdf ? { jsPDF: window.jspdf.jsPDF, svg2pdf: window.svg2pdf.svg2pdf } : null;
    })().catch(() => { pdfLibs = null; return null; });
    return pdfLibs;
  };
  // the PDF: vector, no fonts (putOnlyUsedFonts; glyphs are paths), no transparency, page = figure size in bp
  XD.pdf = async (fig) => {
    const lib = await pdfLib();
    if (!lib) throw new Error('The PDF library could not be loaded');
    const doc = new lib.jsPDF({ unit: 'pt', format: [fig.W, fig.H], orientation: fig.W > fig.H ? 'landscape' : 'portrait', compress: true, putOnlyUsedFonts: true });
    const info = (v) => (fig.lang === 'ru' && I18 ? I18.pdfText(v) : v);
    doc.setProperties({ title: fig.name || 'Figure', creator: 'Complex Map Workbench', subject: fig.captionTex ? info(fig.captionTex.slice(0, 400)) : '' });
    if (fig.meta && doc.addMetadata) {
      const json = JSON.stringify(fig.meta).replace(/[<&]/g, (c) => (c === '<' ? '&lt;' : '&amp;'));
      try { doc.addMetadata(`<cmw:scene>${json}</cmw:scene>`, 'https://complex-map-workbench/ns/1.0/'); } catch (e) { /* metadata is optional */ }
    }
    // svg2pdf draws a <use> under an ExtGState with /CA 0: the SVG keeps one shared glyph table, and for the PDF every
    // <use> is inlined as the glyph's own path, so the file has no transparency at all
    const src = fig.svg.replace(/<use([^>]*?)\sxlink:href="#([^"]+)"([^>]*?)\/>/g, (m, a, id, b) => {
      const at = a + b, x = /\sx="([^"]*)"/.exec(at), y = /\sy="([^"]*)"/.exec(at), rest = at.replace(/\s[xy]="[^"]*"/g, '');
      const path = `<path${rest} d="${(fig.glyphs || {})[id] || ''}"/>`;
      return x || y ? `<g transform="translate(${x ? x[1] : 0} ${y ? y[1] : 0})">${path}</g>` : path;
    }).replace(/<metadata[\s\S]*?<\/metadata>/, '');
    const el = new DOMParser().parseFromString(src, 'image/svg+xml').documentElement;
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;overflow:hidden';
    host.append(el); document.body.append(host);
    try { await lib.svg2pdf(el, doc, { x: 0, y: 0, width: fig.W, height: fig.H }); } finally { host.remove(); }
    return doc.output('blob');
  };
  // PNG of the whole figure at dpi: opaque (RGB, or grey for B/W), pHYs, the scene in iTXt
  XD.pngBytes = async (fig, dpi = 300, grey = false) => {
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
    return { bytes: await XD.encodePNG(px, { dpi, meta: fig.meta }), w: c.width, h: c.height };
  };
  XD.b64 = b64;

  // =====================================================================================================
  // 2. Presets, sizes, palettes
  // =====================================================================================================
  // Sizes are TeX points (the width of a real layout); the file is in bp (1 pt = 72/72.27 bp).
  // Article: One column (amsart 360 pt, the default) or Two column (the column of a two-column journal; full width for
  // figure*). Homework: 1 in margins on Letter (469.75 pt) by default; the snippet only ever shrinks the figure.
  const SIZES = {
    article1: [
      { id: 'amsart', label: 'amsart', pt: 360, note: 'One column · the default' },
      { id: 'art10', label: 'article · 10 pt', pt: 345 },
      { id: 'art11', label: 'article · 11 pt', pt: 360 },
      { id: 'art12', label: 'article · 12 pt', pt: 390 },
    ],
    article2: [
      { id: 'revtex', label: 'REVTeX column', pt: 246, note: 'Two column · the default' },
      { id: 'ieee', label: 'IEEE column', pt: 252 },
      { id: 'revtexW', label: 'REVTeX full width', pt: 510, star: true, note: 'figure* across both columns' },
      { id: 'ieeeW', label: 'IEEE full width', pt: 516, star: true, note: 'figure* across both columns' },
    ],
    homework: [
      { id: 'letter1in', label: '1 in margins · Letter', pt: 469.75, note: 'the default' },
      { id: 'a4', label: '2.5 cm margins · A4', pt: 455.24 },
      { id: 'ol11', label: 'Overleaf article · 11 pt', pt: 360 },
      { id: 'ol10', label: 'Overleaf article · 10 pt', pt: 345 },
      { id: 'ol12', label: 'Overleaf article · 12 pt', pt: 390 },
    ],
    slides: [
      { id: 'beamer169', label: 'Beamer 16:9', pt: 398.34, note: 'the default' },
      { id: 'beamer43', label: 'Beamer 4:3', pt: 307.29 },
    ],
  };
  const sizeList = (o) => (o.for === 'article' ? SIZES[o.cols === 2 ? 'article2' : 'article1'] : SIZES[o.for]);
  const sizeOf = (o) => {
    if (o.sizeId === 'custom' && o.customPt > 50) return { id: 'custom', label: 'Your \\linewidth', pt: o.customPt };  // (shown through $t)
    const l = sizeList(o);
    return l.find((s) => s.id === o.sizeId) || l[0];
  };
  // type sizes (pt) at each document size: ticks, labels, caption
  const TYPE = {
    article: { 10: [8, 9, 9], 11: [9, 10, 10], 12: [10, 10.95, 10.95] },
    homework: { 10: [9, 10, 10], 11: [10, 10.95, 10.95], 12: [10.95, 12, 12] },
    slides: { 10: [9, 11, 11], 11: [9, 11, 11], 12: [10, 12, 12] },
  };
  const PRESET = {
    article: { axes: 'box', lw: { frame: 0.5, tick: 0.5, edge: 0.6, curve: 0.7, grid: 0.35, arrow: 0.5, axis: 0.6 }, dashOpen: false, named: false, chevrons: false, fade: false, float: 'tbp' },
    homework: { axes: 'cross', lw: { frame: 0.6, tick: 0.6, edge: 0.9, curve: 1.0, grid: 0.5, arrow: 0.6, axis: 0.6 }, dashOpen: true, named: true, chevrons: true, fade: true, float: 'H' },
    slides: { axes: 'cross', minimal: true, lw: { frame: 0.6, tick: 0.6, edge: 1.0, curve: 1.2, grid: 0.5, arrow: 0.7, axis: 0.7 }, dashOpen: false, named: false, chevrons: false, fade: true, float: 'H' },
  };
  // ---- colour (OKLab): the print tones of each shape at fixed lightness, so they survive grey and colour-blind readers
  const sRGBlin = (c) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const hexRGB = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const toOklab = (hex) => {
    const [r, g, b] = hexRGB(hex).map(sRGBlin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
  };
  const oklch = (L, Cc, hh) => {
    const conv = (C2) => {
      const a = C2 * Math.cos(hh), b = C2 * Math.sin(hh);
      const l_ = L + 0.3963377774 * a + 0.2158037573 * b, m_ = L - 0.1055613458 * a - 0.0638541728 * b, s_ = L - 0.0894841775 * a - 1.2914855480 * b;
      const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
      return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
    };
    let lo = 0, hi = Cc;
    if (conv(Cc).some((x) => x < 0 || x > 1)) { for (let i = 0; i < 20; i++) { const mid = (lo + hi) / 2; if (conv(mid).some((x) => x < 0 || x > 1)) hi = mid; else lo = mid; } Cc = lo; }
    return '#' + conv(Cc).map((c) => { c = Math.min(1, Math.max(0, c)); const s = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(s * 255).toString(16).padStart(2, '0'); }).join('');
  };
  const DEF_C = ['#3B6FD4', '#CD821A', '#12938F', '#BC4E98', '#31983D', '#7F56C4', '#888D22', '#607183'];
  const baseHex = (s) => (s.color && /^#[0-9a-f]{6}$/i.test(s.color) ? s.color : DEF_C[(s.ci || 0) % 8]);
  // the tones of a shape: dark / light checker cells and the boundary
  const TONES = { article: [0.70, 0.085, 0.895, 0.03, 0.40, 0.09], homework: [0.66, 0.095, 0.89, 0.035, 0.36, 0.09], slides: [0.66, 0.11, 0.88, 0.045, 0.38, 0.1] };
  function tonesOf(s, o) {
    if (o.ink === 'bw') return { dark: '#8C8C8C', light: '#DBDBDB', edge: '#000000' };
    const [, a, b] = toOklab(baseHex(s)), hh = Math.atan2(b, a), t = TONES[o.for] || TONES.article;
    return { dark: oklch(t[0], t[1], hh), light: oklch(t[2], t[3], hh), edge: oklch(t[4], t[5], hh) };
  }
  // the renderer blends fills at alpha over white: a tone is pre-compensated so the blend lands on it
  const comp = (h, a) => '#' + [1, 3, 5].map((i) => Math.max(0, Math.min(255, Math.round(255 - (255 - parseInt(h.slice(i, i + 2), 16)) / a))).toString(16).padStart(2, '0')).join('');
  const printInkFor = (o, alpha) => (s) => { const t = tonesOf(s, o); return { c0: comp(t.dark, alpha), alt: comp(t.light, alpha), edge: t.edge }; };
  // named points: Okabe-Ito hues, identity carried by the marker's shape; letters always black
  const PTS = [['dot', '#D55E00'], ['square', '#009E73'], ['tri', '#CC79A7'], ['diamond', '#E69F00']];
  const BW_DASH = [null, '3 2', '0 1.8'];

  // =====================================================================================================
  // 3. The views
  // =====================================================================================================
  const aspect = (b) => (b.x1 - b.x0) / (b.y1 - b.y0);
  const maxW = (texs, pt) => Math.max(0, ...texs.map((t) => XD.tex(t, pt).w));
  const tickW = (b, step, tp) => { const sy = XD.axisSteps(b, step)[1], d = XD.decimals(sy); return maxW(XD.ticks(b.y0, b.y1, sy).map((v) => XD.tickTex(v, d)), tp); };
  // the room the last x tick label needs right of the frame (when the frame ends on that tick)
  const overR = (b, step, tp) => { const sx = XD.axisSteps(b, step)[0], t = XD.ticks(b.x0, b.x1, sx).pop(); return t != null && Math.abs(b.x1 - t) < 1e-9 * Math.max(1, Math.abs(t)) ? XD.tex(XD.tickTex(t, XD.decimals(sx)), tp).w / 2 + 1 : 0; };
  const head = (x0, x1, y, letter, tag, pt) => (letter ? XD.at(XD.tex(XD.lang === 'ru' ? `\\textit{${letter}}` : `\\text{${letter}}`, pt), x0, y, 'start', 'base', 'panel-letter') : '') + (tag ? XD.at(XD.tex(tag, pt), x1, y, 'end', 'base', 'panel-letter') : '');
  // the i-th panel letter in the figure's language: (a) (b) ... ; а б ... (set in italic by head)
  const panelLetter = (i) => (XD.lang === 'ru' ? RU_LETTERS[i] : `(${String.fromCharCode(97 + i)})`);
  const expandBox = (b, f) => { const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, w = (b.x1 - b.x0) * f / 2, h = (b.y1 - b.y0) * f / 2; return { x0: cx - w, x1: cx + w, y0: cy - h, y1: cy + h }; };
  const stepFor = (box, wpt) => niceStep(Math.max(box.x1 - box.x0, box.y1 - box.y0), Math.max(2, Math.min(5, Math.round(wpt / 42))));
  // a polyline set [[x, y], ...] from Region.mapCurve's flat arrays
  const unflat = (fl) => { const o = []; for (let i = 0; i + 1 < fl.length; i += 2) o.push([fl[i], fl[i + 1]]); return o; };
  // the curves of a shape mapped by F, sampled for a panel box at wpt (0.1 pt deviation)
  // the boundary of an area without boundary curves of its own (a formula: |Im z| < pi/2, 0 < arg z < pi/3 and ...):
  // the zero set of its level function by marching squares on a 720 x 720 grid of the window, joined by edge ids
  // into polylines, as curves {f, n0, closed} that mapCurve refines through F (so the images stay smooth)
  const lvlCache = new Map();
  function levelBoundary(s, win) {
    const key = JSON.stringify([s.kind, s.expr, !!s.complement, win.x0, win.x1, win.y0, win.y1]);
    if (lvlCache.has(key)) return lvlCache.get(key);
    let L;
    try { L = Region.levelOf(s); } catch (e) { return []; }
    const n = 720, dx = (win.x1 - win.x0) / n, dy = (win.y1 - win.y0) / n, N = n + 1, G = new Float64Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { let v; try { v = L(C(win.x0 + i * dx, win.y0 + j * dy)); } catch (e) { v = NaN; } G[j * N + i] = Number.isFinite(v) ? v : NaN; }
    // edge e: horizontal (i, j)-(i+1, j) = 2 (j N + i), vertical (i, j)-(i, j+1) = 2 (j N + i) + 1; its crossing point
    const pt = new Map();
    const cross = (e) => {
      if (pt.has(e)) return pt.get(e);
      const v = e >> 1, i = v % N, j = (v - i) / N, a = G[v], b = e & 1 ? G[v + N] : G[v + 1], t = a / (a - b);
      const q = e & 1 ? [win.x0 + i * dx, win.y0 + (j + t) * dy] : [win.x0 + (i + t) * dx, win.y0 + j * dy];
      pt.set(e, q); return q;
    };
    const adj = new Map(), link = (a, b) => { for (const [x, y] of [[a, b], [b, a]]) { if (!adj.has(x)) adj.set(x, []); adj.get(x).push(y); } };
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const v = j * N + i, a = G[v], b = G[v + 1], c = G[v + N + 1], d = G[v + N];
      if (!(Number.isFinite(a) && Number.isFinite(b) && Number.isFinite(c) && Number.isFinite(d))) continue;
      const code = (a > 0 ? 1 : 0) | (b > 0 ? 2 : 0) | (c > 0 ? 4 : 0) | (d > 0 ? 8 : 0);
      if (code === 0 || code === 15) continue;
      const eB = 2 * v, eR = 2 * (v + 1) + 1, eT = 2 * (v + N), eL = 2 * v + 1; // bottom, right, top, left
      const es = [];
      if ((a > 0) !== (b > 0)) es.push(eB);
      if ((b > 0) !== (c > 0)) es.push(eR);
      if ((c > 0) !== (d > 0)) es.push(eT);
      if ((d > 0) !== (a > 0)) es.push(eL);
      if (es.length === 2) link(es[0], es[1]);
      else if (es.length === 4) { // a saddle: the centre's sign decides the pairing
        const m = (a + b + c + d) / 4 > 0;
        if (m === (a > 0)) { link(eB, eR); link(eT, eL); } else { link(eB, eL); link(eR, eT); }
      }
    }
    const used = new Set(), lines = [];
    for (const e0 of adj.keys()) {
      if (used.has(e0)) continue;
      const line = [e0]; used.add(e0);
      for (const dir of [1, 0]) for (;;) {
        const tip = dir ? line[line.length - 1] : line[0], nb = (adj.get(tip) || []).find((x) => !used.has(x));
        if (nb == null) break;
        used.add(nb); if (dir) line.push(nb); else line.unshift(nb);
      }
      const closed = line.length > 2 && (adj.get(line[0]) || []).includes(line[line.length - 1]);
      const P = line.map(cross);
      if (closed) P.push(P[0]);
      if (P.length > 1) lines.push(P);
    }
    for (const P of lines) {
      const k = P.length >> 1, a = P[Math.max(0, k - 1)], b = P[Math.min(P.length - 1, k + 1)], dxl = b[0] - a[0], dyl = b[1] - a[1], l = Math.hypot(dxl, dyl);
      if (!(l > 0)) continue;
      const e = 0.25 * Math.min(dx, dy), m = P[k];
      let inL = NaN;
      try { inL = L(C(m[0] - dyl / l * e, m[1] + dxl / l * e)); } catch (err) { inL = NaN; }
      if (inL < 0) P.reverse();
    }
    const out = lines.map((P) => ({ n0: Math.min(400, Math.max(16, P.length >> 2)), closed: false, f: (t) => { const u = Math.max(0, Math.min(1, t)) * (P.length - 1), k = Math.min(P.length - 2, Math.floor(u)), r = u - k; return C(P[k][0] + (P[k + 1][0] - P[k][0]) * r, P[k][1] + (P[k + 1][1] - P[k][1]) * r); } }));
    if (lvlCache.size > 12) lvlCache.clear();
    lvlCache.set(key, out);
    return out;
  }
  function shapeCurves(s, F, box, wpt, srcWin) {
    let cs = [];
    try { cs = Region.curvesOf(s, srcWin) || []; } catch (e) { cs = []; }
    if (!cs.length && kindType(s) === 'area' && !(Region.KINDS[s.kind] && Region.KINDS[s.kind].boundary)) cs = levelBoundary(s, srcWin);
    return { pts: mapCurves(cs, F, box, wpt), cs };
  }
  // source curves (Region.curvesOf) mapped by F and sampled for a panel box at wpt
  function mapCurves(cs, F, box, wpt) {
    const k = 4 * wpt / (box.x1 - box.x0);
    const view = { cx: (box.x0 + box.x1) / 2, cy: (box.y0 + box.y1) / 2, s: k, w: (box.x1 - box.x0) * k, h: (box.y1 - box.y0) * k };
    const out = [];
    for (const c of cs) {
      try {
        if (c && typeof c.f === 'function') { for (const fl of Region.mapCurve(c, F, view, { budget: 80000, maxDepth: 15 })) out.push(unflat(fl)); }
        else if (c && c.pts) { const seg = []; for (const p of c.pts) { const w = F(p.re != null ? p : C(p[0], p[1])); if (Number.isFinite(w.re) && Number.isFinite(w.im)) seg.push([w.re, w.im]); } if (seg.length > 1) out.push(seg); }
      } catch (e) { /* a curve that cannot be mapped is left out */ }
    }
    return out;
  }
  // a boundary piece that a drawn curve covers (the Joukowski circle on the edge of the disc's complement): the
  // curve is part of the figure, so that piece is not shown as an excluded (dashed) boundary
  function srcPoly(c, n) {
    const out = [];
    try {
      if (c && typeof c.f === 'function') for (let i = 0; i <= n; i++) { const z = c.f(i / n); if (fin(z)) out.push([z.re, z.im]); }
      else if (c && c.pts) for (const p of c.pts) { const z = p.re != null ? p : C(p[0], p[1]); if (fin(z)) out.push([z.re, z.im]); }
    } catch (e) { /* */ }
    return out;
  }
  function coveredBy(c, polys, tol) {
    const pts = srcPoly(c, 32);
    if (pts.length < 2 || !polys.length) return false;
    const d2 = (p, a, b) => { const vx = b[0] - a[0], vy = b[1] - a[1], L = vx * vx + vy * vy, u = L > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / L)) : 0, x = a[0] + u * vx - p[0], y = a[1] + u * vy - p[1]; return x * x + y * y; };
    return pts.every((p) => polys.some((q) => { for (let i = 1; i < q.length; i++) if (d2(p, q[i - 1], q[i]) <= tol * tol) return true; return false; }));
  }
  // B/W: curves told apart by their dash; in Homework the dash 3 2 means "boundary not included", so it is never used
  // for anything else there (dotted and dash-dot instead)
  const bwDash = (P, k) => (P.dashOpen ? [null, '0 1.8', '4 2.2 0 2.2'] : BW_DASH)[k % 3];
  const C = (re, im = 0) => ({ re, im });
  const kindType = (s) => (Region.KINDS[s.kind] ? Region.KINDS[s.kind].type : 'area');
  const fin = (w) => w && Number.isFinite(w.re) && Number.isFinite(w.im) && Math.abs(w.re) < 1e9 && Math.abs(w.im) < 1e9;
  // the content box of an art raster (non-white pixels) in world coordinates, or null
  function contentBox(r, box) {
    const { w, h, rgb } = r;
    let i0 = w, i1 = -1, j0 = h, j1 = -1;
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) { const q = 3 * (j * w + i); if (rgb[q] < 248 || rgb[q + 1] < 248 || rgb[q + 2] < 248) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
    if (i1 < 0) return null;
    const X = (i) => box.x0 + i / w * (box.x1 - box.x0), Y = (j) => box.y1 - j / h * (box.y1 - box.y0);
    return { x0: X(i0), x1: X(i1 + 1), y0: Y(j1 + 1), y1: Y(j0), touch: { l: i0 <= 1, r: i1 >= w - 2, t: j0 <= 1, b: j1 >= h - 2 } };
  }
  const unionBox = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), x1: Math.max(a.x1, b.x1), y0: Math.min(a.y0, b.y0), y1: Math.max(a.y1, b.y1), touch: { l: (a.touch && a.touch.l) || (b.touch && b.touch.l), r: (a.touch && a.touch.r) || (b.touch && b.touch.r), t: (a.touch && a.touch.t) || (b.touch && b.touch.t), b: (a.touch && a.touch.b) || (b.touch && b.touch.b) } });
  const ptsBox = (polys, win) => {
    let b = null;
    for (const seg of polys) for (const p of seg) { if (p[0] < win.x0 || p[0] > win.x1 || p[1] < win.y0 || p[1] > win.y1) continue; b = unionBox(b, { x0: p[0], x1: p[0], y0: p[1], y1: p[1] }); }
    return b;
  };
  // Fit: the content plus 8 %, snapped outward to half a tick step; a side the content runs off (an unbounded set)
  // keeps the screen window's edge there. Equal aspect is kept by the panel (one unit, one length).
  function fitBox(content, screen, wpt) {
    if (!content) return screen;
    const sw = screen.x1 - screen.x0, sh = screen.y1 - screen.y0;
    let b = { x0: content.x0, x1: content.x1, y0: content.y0, y1: content.y1 };
    const span0 = Math.max(b.x1 - b.x0, b.y1 - b.y0, 1e-9 * Math.max(sw, sh));
    // 8 % of each side's own span (at least 2 % of the long side), so a wide strip is not framed as a square
    const px = 0.08 * Math.max(b.x1 - b.x0, 0.25 * span0), py = 0.08 * Math.max(b.y1 - b.y0, 0.25 * span0);
    const t = content.touch || {};
    b = { x0: t.l ? screen.x0 : b.x0 - px, x1: t.r ? screen.x1 : b.x1 + px, y0: t.b ? screen.y0 : b.y0 - py, y1: t.t ? screen.y1 : b.y1 + py };
    // a set that runs off both opposite sides (a strip): its length comes from the scene, not from the pane's shape, so
    // the figure is the same from a phone or a wide window (3:2 around the view's centre; a vertical strip is square)
    if (t.l && t.r && !(t.t && t.b)) { const c = (screen.x0 + screen.x1) / 2, hw = 0.75 * (b.y1 - b.y0); b.x0 = c - hw; b.x1 = c + hw; }
    else if (t.t && t.b && !(t.l && t.r)) { const c = (screen.y0 + screen.y1) / 2, hh = 0.5 * (b.x1 - b.x0); b.y0 = c - hh; b.y1 = c + hh; }
    // a sliver at least a quarter of the long side: a segment on the real axis is not a hairline panel
    const minSpan = 0.25 * Math.max(b.x1 - b.x0, b.y1 - b.y0);
    if (b.x1 - b.x0 < minSpan) { const c = (b.x0 + b.x1) / 2; b.x0 = c - minSpan / 2; b.x1 = c + minSpan / 2; }
    if (b.y1 - b.y0 < minSpan) { const c = (b.y0 + b.y1) / 2; b.y0 = c - minSpan / 2; b.y1 = c + minSpan / 2; }
    const st = stepFor(b, wpt) / 2;
    const snap = (v, up) => (up ? Math.ceil(v / st - 1e-9) : Math.floor(v / st + 1e-9)) * st;
    b = { x0: t.l ? snap(b.x0, true) : snap(b.x0, false), x1: t.r ? snap(b.x1, false) : snap(b.x1, true), y0: t.b ? snap(b.y0, true) : snap(b.y0, false), y1: t.t ? snap(b.y1, false) : snap(b.y1, true) };
    if (!(b.x1 > b.x0 && b.y1 > b.y0)) return screen;
    return b;
  }
  const snapScreen = (b, wpt) => { const st = stepFor(b, wpt) / 2; const r = { x0: Math.ceil(b.x0 / st - 1e-9) * st, x1: Math.floor(b.x1 / st + 1e-9) * st, y0: Math.ceil(b.y0 / st - 1e-9) * st, y1: Math.floor(b.y1 / st + 1e-9) * st }; return r.x1 > r.x0 && r.y1 > r.y0 ? r : b; };
  // the art of a panel: the app's renderer in art mode (fills only) for an exact window, then flattened and encoded
  async function artPanel(side, box, wpt, o, extra = {}) {
    const flat = o.ink === 'bw' ? 'grey' : extra.mode || 'indexed';
    const dpi = extra.dpi || (flat === 'rgb' ? 300 : 600);
    const r = await A.art(side, { box, wpt, dpi, ink: printInkFor(o, A.state().alpha), T: extra.T, alive: o.alive });
    if (!r) return null;
    const a = await XD.art(r, box, { mode: flat, wpt, fade: extra.fade });
    a.dpi = dpi; a.raw = r;
    return a;
  }
  // an example's word label is stored in English (app.js exLabel, review math-5): it is set in the figure's language
  const EX_LABELS = new Set(['trailing edge']);
  const texLabel = (s, i) => {
    if (s.label) {
      const l = EX_LABELS.has(String(s.label)) && I18 ? I18.at(XD.lang || 'en').t(String(s.label)) : String(s.label);
      if (/[A-Za-z]{2}|\s/.test(l) || /[\u0400-\u04ff]/.test(l)) return `\\text{${l.replace(/[\\{}$&#%_^~]/g, '')}}`;
      return l.replace(/₀/g, '_0').replace(/₁/g, '_1').replace(/₂/g, '_2').replace(/₃/g, '_3').replace(/′/g, "'");
    }
    return null;
  };
  const cxTex = (z) => (typeof CX !== 'undefined' && CX.tex ? CX.tex(z, 3) : `${+z.re.toFixed(3)}${z.im >= 0 ? '+' : '-'}${Math.abs(+z.im.toFixed(3))}i`);
  // the vector layers of one plane panel: boundaries and curves (mapped by F), points (and their names)
  function planeLayers(o, P, side, F, box, wpt, shapes, srcWin, primeName) {
    const curves = [], points = [], chev = [];
    let bwI = 0, dashed = 0;
    // the drawn curves (source plane), for the open boundaries they cover
    let solids = null;
    const solidPolys = () => solids || (solids = shapes.filter((s) => kindType(s) === 'curve').flatMap((s) => { try { return (Region.curvesOf(s, srcWin) || []).map((c) => srcPoly(c, 720)); } catch (e) { return []; } }).filter((q) => q.length > 1));
    const tol = 2e-4 * Math.hypot(srcWin.x1 - srcWin.x0, srcWin.y1 - srcWin.y0);
    shapes.forEach((s, si) => {
      const t = kindType(s);
      if (t === 'point') return;
      const tn = tonesOf(s, o);
      const grid = s.kind === 'cgrid' || s.kind === 'pgrid';
      const open = t === 'area' && Region.isOpen && Region.isOpen(s);
      let { pts, cs } = shapeCurves(s, F, box, wpt, srcWin);
      let dash = open && P.dashOpen ? '3 2' : null;
      if (dash && cs.length) {
        // pieces of an open boundary that a drawn curve lies on are the curve's: they are left to it
        const cov = cs.map((c) => coveredBy(c, solidPolys(), tol));
        if (cov.some(Boolean)) pts = mapCurves(cs.filter((c, i) => !cov[i]), F, box, wpt);
      }
      if (o.ink === 'bw' && !grid && !dash) dash = bwDash(P, bwI++);
      const color = o.ink === 'bw' ? (grid ? '#666666' : '#000000') : (o.for === 'article' || grid ? tn.edge : t === 'area' ? tn.edge : tn.edge);
      if (dash === '3 2' && pts.some((q) => q.some((p) => p[0] >= box.x0 && p[0] <= box.x1 && p[1] >= box.y0 && p[1] <= box.y1))) dashed++;
      curves.push({ pts, w: grid ? P.lw.grid : t === 'area' ? P.lw.edge : P.lw.curve, color, dash, cap: dash && dash.indexOf('0 ') === 0 || dash === '4 2.2 0 2.2' ? 'round' : 'butt', open });
      // orientation chevrons (Homework): one on each piece of an area's boundary, at a point that shows in both panels
      if (P.chevrons && t === 'area') for (const c of cs.slice(0, 6)) if (c && typeof c.f === 'function') chev.push({ c, color, s });
    });
    let pi = 0;
    shapes.forEach((s) => {
      if (kindType(s) !== 'point' || !s.p) return;
      const z = C(s.p[0], s.p[1]), w = F(z);
      const k = pi++;
      if (!fin(w)) return;
      let label = null;
      if (P.named) label = String.fromCharCode(65 + (k % 26)) + (primeName ? "'" : '');
      else { const l = texLabel(s, k); label = l ? (primeName ? `${primeName}(${l})` : l) : null; }
      if (P.named || o.ink === 'bw') points.push({ z: [w.re, w.im], r: P.named ? 2.0 : 1.6, kind: P.named ? PTS[k % 4][0] : 'dot', fill: o.ink === 'bw' ? '#000000' : P.named ? PTS[k % 4][1] : '#000000', label, at: 'auto' });
      else points.push({ z: [w.re, w.im], r: 1.5, kind: 'dot', fill: '#000000', label, at: 'auto' });
    });
    return { curves, points, chev, dashed };
  }
  // where a boundary's orientation is shown: the parameter whose point and image both sit well inside their panels,
  // clear of the cross axes, of their crossing and of their tick labels in both panels (a piece that lies on an axis,
  // the real axis of a half-plane or the rays of a quarter plane, gets its mark between two ticks, away from 0); then
  // the middle of the piece's visible part. A long piece (a line or a ray, clipped far outside the window) is also
  // sampled densely where it crosses the source window. pn = {L: {box, st: [sx, sy]}, R: ...}
  function clipSeg(a, b, w) {
    let t0 = 0, t1 = 1;
    const dx = b.re - a.re, dy = b.im - a.im;
    for (const [p, q] of [[-dx, a.re - w.x0], [dx, w.x1 - a.re], [-dy, a.im - w.y0], [dy, w.y1 - a.im]]) {
      if (p === 0) { if (q < 0) return null; continue; }
      const r = q / p;
      if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return t1 > t0 ? [t0, t1] : null;
  }
  function chevronAt(c, FL, FR, pL, pR, srcWin) {
    const inside = (w, b, m) => fin(w) && w.re > b.x0 + m * (b.x1 - b.x0) && w.re < b.x1 - m * (b.x1 - b.x0) && w.im > b.y0 + m * (b.y1 - b.y0) && w.im < b.y1 - m * (b.y1 - b.y0);
    // the clearance of a mark at w in a panel (fractions of the panel): from the nearer axis (enough at 12 %), from
    // the axes' crossing (enough at 24 %), and, on an axis, from its labelled ticks (best half way between two)
    const clear = (w, p) => {
      const b = p.box, W = b.x1 - b.x0, H = b.y1 - b.y0;
      const hasX = b.y0 < 0 && b.y1 > 0, hasY = b.x0 < 0 && b.x1 > 0;
      const dX = hasX ? Math.abs(w.im) / H : 1, dY = hasY ? Math.abs(w.re) / W : 1;
      const ox = Math.min(Math.max(0, b.x0), b.x1), oy = Math.min(Math.max(0, b.y0), b.y1);
      const dO = Math.hypot((w.re - ox) / W, (w.im - oy) / H);
      const half = (v, st) => (st > 0 ? 2 * Math.abs(v / st - Math.round(v / st)) : 1);
      const q = Math.min(dX < 0.04 ? half(w.re, p.st[0]) : 1, dY < 0.04 ? half(w.im, p.st[1]) : 1);
      return Math.min(0.12, dX, dY) + Math.min(0.12, 0.5 * dO) + 0.03 * q;
    };
    const ss = [];
    for (let i = 1; i < 240; i++) ss.push(i / 240);
    if (c.long && c.a && c.b && srcWin) { const iv = clipSeg(c.a, c.b, srcWin); if (iv) for (let i = 1; i < 240; i++) ss.push(iv[0] + (iv[1] - iv[0]) * i / 240); }
    const ok = [];
    for (const s of ss) {
      const z = c.f(s), a = FL(z), b = FR ? FR(z) : a;
      if (!inside(a, pL.box, 0.05) || (FR && !inside(b, pR.box, 0.05))) continue;
      ok.push({ s, cl: Math.min(clear(a, pL), FR ? clear(b, pR) : 1) });
    }
    if (!ok.length) return null;
    const s0 = Math.min(...ok.map((q) => q.s)), s1 = Math.max(...ok.map((q) => q.s)), mid = (s0 + s1) / 2, span = s1 - s0 || 1;
    let best = null;
    for (const q of ok) { const sc = 0.2 * Math.abs(q.s - mid) / span - q.cl; if (!best || sc < best.sc) best = { sc, s: q.s }; }
    return best.s;
  }
  // the sense of a boundary piece at s: +1 when its set lies on the left of increasing s, -1 on the right (an inner
  // boundary, the circle of a complement, the second ray of a sector). The arrowheads say "the set stays on the left"
  // (DESIGN.md), so a piece of sense -1 is marked against its parameter. L: the shape's level function (> 0 inside).
  function senseAt(c, L, s, win) {
    if (typeof L !== 'function') return 1;
    const z = c.f(s), za = c.f(Math.max(0, s - 1e-4)), zb = c.f(Math.min(1, s + 1e-4));
    if (!fin(z) || !fin(za) || !fin(zb)) return 1;
    const dx = zb.re - za.re, dy = zb.im - za.im, l = Math.hypot(dx, dy);
    if (!(l > 0)) return 1;
    const span = win ? Math.hypot(win.x1 - win.x0, win.y1 - win.y0) : 1 + Math.hypot(z.re, z.im);
    let v = 0;
    for (const k of [1e-4, 1e-3, 1e-2]) {
      const e = k * span, nx = -dy / l * e, ny = dx / l * e;
      let a = NaN, b = NaN;
      try { a = L(C(z.re + nx, z.im + ny)); b = L(C(z.re - nx, z.im - ny)); } catch (err) { /* */ }
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) v += a > b ? 1 : -1;
    }
    return v < 0 ? -1 : 1;
  }
  const chevMark = (X, Y, c, F, s, color, lw, sense = 1) => {
    const z = c.f(s), a = F(z);
    if (!fin(a)) return '';
    const ax = X(a.re), ay = Y(a.im);
    // the direction of travel at s in the panel, from a step short enough to follow a curved image (< 0.5 pt)
    let bx = NaN, by = NaN;
    for (let h = 1e-3, k = 0; k < 24; k++, h /= 4) {
      const b = F(c.f(Math.max(0, Math.min(1, s + sense * h))));
      if (!fin(b)) continue;
      bx = X(b.re); by = Y(b.im);
      if (Math.hypot(bx - ax, by - ay) < 0.5) break;
    }
    if (!Number.isFinite(bx) || Math.hypot(bx - ax, by - ay) < 1e-9) return '';
    return XD.chevron(ax, ay, Math.atan2(by - ay, bx - ax), 3.8, color, lw);
  };

  // the export window of a view without its pane: a reference pane of 480 x 360 CSS px at the view's centre and scale
  const REF_PANE = [480, 360];
  const sceneWin = (v) => ({ x0: v.cx - REF_PANE[0] / 2 / v.s, x1: v.cx + REF_PANE[0] / 2 / v.s, y0: v.cy - REF_PANE[1] / 2 / v.s, y1: v.cy + REF_PANE[1] / 2 / v.s });
  // Y's window: the box of the image under FR of what X's panel shows (the areas, curves and points whose FL lies in
  // boxL), 0.5 % trimmed at each end (a pole), plus 8 % of each side; null when nothing shows
  function imageWin(FL, FR, boxL, srcWin, shapes) {
    const xs = [], ys = [];
    const inL = (a) => fin(a) && a.re >= boxL.x0 && a.re <= boxL.x1 && a.im >= boxL.y0 && a.im <= boxL.y1;
    const keep = (z) => { let a, b; try { a = FL(z); if (!inL(a)) return; b = FR(z); } catch (e) { return; } if (fin(b)) { xs.push(b.re); ys.push(b.im); } };
    const lv = [];
    for (const s of shapes) {
      const t = kindType(s);
      if (t === 'area') { try { lv.push(Region.levelOf(s)); } catch (e) { /* */ } }
      else if (t === 'point') { if (s.p) keep(C(s.p[0], s.p[1])); }
      else { try { for (const c of Region.curvesOf(s, srcWin) || []) for (const p of srcPoly(c, 720)) keep(C(p[0], p[1])); } catch (e) { /* */ } }
    }
    if (lv.length) {
      const n = 160, dx = (srcWin.x1 - srcWin.x0) / n, dy = (srcWin.y1 - srcWin.y0) / n;
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const z = C(srcWin.x0 + (i + 0.5) * dx, srcWin.y0 + (j + 0.5) * dy);
        if (lv.some((L) => { try { return L(z) >= 0; } catch (e) { return false; } })) keep(z);
      }
    }
    if (xs.length < 8) return null;
    xs.sort((a, b) => a - b); ys.sort((a, b) => a - b);
    const k = Math.floor(0.005 * xs.length), b = { x0: xs[k], x1: xs[xs.length - 1 - k], y0: ys[k], y1: ys[ys.length - 1 - k] };
    const span = Math.max(b.x1 - b.x0, b.y1 - b.y0);
    if (!(span > 0)) return null;
    const px = 0.08 * Math.max(b.x1 - b.x0, 0.25 * span), py = 0.08 * Math.max(b.y1 - b.y0, 0.25 * span);
    return { x0: b.x0 - px, x1: b.x1 + px, y0: b.y0 - py, y1: b.y1 + py };
  }

  // ---------- (1) X -> Y: two plane panels and the F arrow (or one of them) ----------
  async function figXY(o, P, W, T) {
    const st = A.state();
    const panels = o.panels === 'L' ? ['L'] : o.panels === 'R' ? ['R'] : ['L', 'R'];
    const [tp, lp] = T;
    const shapes = A.shapes();
    const planeOf = (side) => (side === 'L' ? st.lFlat : st.rImage);
    const Fs = { L: A.F('L'), R: A.F('R') };
    const vars = { L: A.panelVar('L'), R: A.panelVar('R') };
    // windows: Fit (content, from a quick render and the curves) or As on screen. Fit does not depend on the panes'
    // sizes (a phone, a tablet, a wide window give one figure): X's window comes from its view (centre, scale) and a
    // fixed reference pane (sceneWin); Y's from the image of what X's panel shows (imageWin). A set that runs off a
    // side keeps that window's edge there.
    const scene = o.crop !== 'screen' && A.viewOf;
    const srcWin = scene ? expandBox(sceneWin(A.viewOf('L0')), 3) : expandBox(A.screenBox('L0'), 3);
    const boxes = {}, touches = {};
    const roughW = W / panels.length;
    for (const side of panels) {
      if (!planeOf(side)) continue;
      if (!scene) { boxes[side] = snapScreen(A.screenBox(side), roughW); continue; }
      let ref = null;
      if (side === 'R') {
        // (only Y shown: the image of X's reference window, in the source plane)
        const bL = boxes.L || (st.lFlat ? null : sceneWin(A.viewOf('L0')));
        ref = imageWin(boxes.L ? Fs.L : (z) => z, Fs.R, bL || sceneWin(A.viewOf('L0')), srcWin, shapes);
      }
      if (!ref) ref = sceneWin(A.viewOf(side));
      // the quick render looks twice as far as the window, so a bounded set is framed whole and an unbounded one is
      // told by touching this larger window's edges
      const big = expandBox(ref, 2);
      const q = await A.art(side, { box: big, wpt: 300, dpi: 72, ink: printInkFor(o, st.alpha), alive: o.alive });
      if (!q) return null;
      let cb = contentBox(q, big);
      for (const s of shapes) {
        if (kindType(s) === 'area') continue;
        if (kindType(s) === 'point') { const w = Fs[side](C(s.p[0], s.p[1])); if (fin(w) && w.re >= big.x0 && w.re <= big.x1 && w.im >= big.y0 && w.im <= big.y1) cb = unionBox(cb, { x0: w.re, x1: w.re, y0: w.im, y1: w.im }); continue; }
        const b = ptsBox(shapeCurves(s, Fs[side], big, 300, srcWin).pts, big);
        if (b) {
          const ex = 0.01;
          b.touch = { l: b.x0 <= big.x0 + ex * (big.x1 - big.x0), r: b.x1 >= big.x1 - ex * (big.x1 - big.x0), b: b.y0 <= big.y0 + ex * (big.y1 - big.y0), t: b.y1 >= big.y1 - ex * (big.y1 - big.y0) };
          cb = unionBox(cb, b);
        }
      }
      boxes[side] = fitBox(cb, ref, roughW);
      touches[side] = cb && cb.touch;
    }
    const box = P.axes === 'box' && o.axes !== 'cross' && o.axes !== 'none' ? 'box' : (o.axes || P.axes);
    const axes = o.axes || P.axes;
    const two = panels.length === 2;
    const mirror = two && axes === 'box' && W < 300;
    const steps = {};
    for (const side of panels) if (boxes[side]) steps[side] = stepFor(boxes[side], two ? W / 2 : W);
    // the F arrow's label: F (Article), w = formula (Homework, when it is short)
    const Fname = st.focus === 0 ? 'F' : `f_{${st.focus}}`;
    let arrowTex = two ? Fname : null;
    if (two && o.for !== 'article') {
      // w = \dfrac{..}{..} when the formula is one fraction (narrow), else the inline formula when it is short
      const raw = A.formulaRaw ? A.formulaRaw() : null, f = A.formulaTex();
      const cands = [];
      // (named by the image panel's variable, w or w_k, as its axes are)
      if (raw && /^\\frac\{/.test(raw) && raw.length < 90) cands.push(`${vars.R}=${raw.replace(/^\\frac/, '\\dfrac')}`);
      if (f && f.length < 60) cands.push(`${vars.R}=${f}`);
      for (const c of cands) if (XD.tex(c, lp).w < W * 0.2) { arrowTex = c; break; }
    }
    const arrowLab = arrowTex ? XD.tex(arrowTex, lp) : null;
    const arrowSpan = two ? Math.max(axes === 'box' ? 22 : 26, arrowLab ? arrowLab.w + 12 : 0) : 0;
    const titles = (side) => [`\\operatorname{Re} ${vars[side]}`, `\\operatorname{Im} ${vars[side]}`];
    const ah = 4.6;
    const asp = (side) => (boxes[side] ? aspect(boxes[side]) : A.paneAspect(side));
    let mL, gut, mR, top, bottom;
    if (axes === 'box') {
      mL = boxes[panels[0]] ? tickW(boxes[panels[0]], steps[panels[0]], tp) + 3 : 2;
      const bL = two && !mirror && boxes.R ? tickW(boxes.R, steps.R, tp) + 3 : 0;
      gut = two ? arrowSpan + 10 + bL : 0;
      const last = panels[panels.length - 1];
      mR = mirror && boxes.R ? tickW(boxes.R, steps.R, tp) + 3 : Math.max(2, boxes[last] ? overR(boxes[last], steps[last], tp) : 0);
      top = lp * 1.15 + 3; bottom = tp * 1.05 + 4.2;
    } else {
      const nA = XD.tex(titles(panels[0])[0], lp).w, nB = two ? XD.tex(titles('R')[0], lp).w : 0;
      mL = 3; gut = two ? ah * 0.3 + 2 + nA + 8 + arrowSpan + 8 : 0; mR = ah * 0.3 + 2 + (two ? nB : nA) + 2;
      const t1 = XD.tex(titles(panels[0])[1], lp);
      top = t1.a + t1.d + ah + 5; bottom = 3;
    }
    let h = (W - mL - gut - mR) / panels.reduce((a, s) => a + asp(s), 0);
    h = Math.min(h, W * (two ? 0.62 : 0.8), P.maxH - top - bottom);
    const used = mL + gut + mR + h * panels.reduce((a, s) => a + asp(s), 0);
    const x0 = (W - used) / 2;
    const items = [], lines = [];
    let defs = '';
    const xs = {}; let xc = x0 + mL;
    for (const side of panels) { xs[side] = xc; xc += h * asp(side) + gut; }
    const y = top;
    const panelOut = {};
    let chevDrawn = 0;
    for (const [i, side] of panels.entries()) {
      const wpt = h * asp(side), x = xs[side];
      if (!boxes[side]) {
        // a globe: the picture as on screen, no axes
        const r = await A.art(side, { wpt, hpt: h, dpi: 300, ink: printInkFor(o, st.alpha), alive: o.alive });
        if (!r) return null;
        const bx = { x0: 0, x1: 1, y0: 0, y1: h / wpt };
        const a = await XD.art(r, bx, { mode: o.ink === 'bw' ? 'grey' : 'rgb', wpt });
        items.push(`<image x="${f2(x)}" y="${f2(y)}" width="${f2(wpt)}" height="${f2(h)}" preserveAspectRatio="none" xlink:href="${a.url}"/>`);
        if (two && axes === 'box') items.push(head(x, x + wpt, y - 3, panelLetter(i), vars[side], lp));
        continue;
      }
      const bx = boxes[side];
      const tch = touches[side] || {};
      const fade = P.fade && axes !== 'box' && tch ? { l: tch.l ? 8 : 0, r: tch.r ? 8 : 0, t: tch.t ? 8 : 0, b: tch.b ? 8 : 0 } : null;
      const art = await artPanel(side, bx, wpt, o, { fade: fade && (fade.l || fade.r || fade.t || fade.b) ? fade : null });
      if (!art) return null;
      const lay = planeLayers(o, P, side, Fs[side], bx, wpt, shapes, srcWin, side === 'R' && two ? (P.named ? "'" : Fname) : null);
      panelOut[side] = { lay, art };
      const over = (X, Y) => {
        let m = '';
        if (P.chevrons) for (const c of lay.chev) {
          const pn = (sd) => ({ box: boxes[sd] || bx, st: XD.axisSteps(boxes[sd] || bx, steps[sd] || steps[side]) });
          const s0 = chevronAt(c.c, two ? Fs.L : Fs[side], two ? Fs.R : null, two ? pn('L') : pn(side), pn('R'), srcWin);
          let L = null;
          try { L = Region.levelOf(c.s); } catch (e) { L = null; }
          const cm = s0 != null ? chevMark(X, Y, c.c, Fs[side], s0, c.color, 0.8, senseAt(c.c, L, s0, srcWin)) : '';
          if (cm) { m += cm; chevDrawn++; }
        }
        return m;
      };
      const p = XD.panel({ x, y, w: wpt, h, box: bx, step: steps[side], art: [art], curves: lay.curves, points: lay.points, axes, minimal: P.minimal, ylab: side === 'R' && mirror ? 'right' : 'left', tickPt: tp, labelPt: lp, ink: '#000000', lw: P.lw, axisTitles: titles(side), over });
      items.push(p.markup); defs += p.defs; lines.push(...p.lines);
      if (axes === 'box') items.push(head(x, x + wpt, y - 3, two ? panelLetter(i) : '', vars[side], lp));
      else if (axes === 'none') items.push(head(x, x + wpt, y - 3, '', vars[side], lp));
    }
    if (two) {
      // (cross axes: the arrow keeps clear of both real axes, so it never reads as their continuation)
      const oys = axes === 'box' ? [] : panels.filter((sd) => boxes[sd]).map((sd) => { const b = boxes[sd]; return Math.min(y + h, Math.max(y, y + (b.y1 / (b.y1 - b.y0)) * h)); });
      const lab = arrowLab ? arrowLab.a + arrowLab.d + 3 : 0;
      const ay = [0.5, 0.36, 0.64, 0.24, 0.76, 0.14, 0.86].map((f) => y + f * h).find((v) => oys.every((oy) => v - oy > lab + 6 || oy - v > 6)) || y + h / 2;
      let a0, a1;
      if (axes === 'box') { a0 = xs.L + h * asp('L') + 5; a1 = a0 + arrowSpan; }
      else { a0 = xs.L + h * asp('L') + ah * 0.3 + 2 + XD.tex(titles('L')[0], lp).w + 8; a1 = xs.R - 8; }
      items.push(XD.mapArrow(a0, a1, ay, arrowTex, lp, P.lw.arrow, '#000000'));
    }
    const H = y + h + bottom;
    // the caption's "Dashed" note: only when a dashed (open) boundary is actually drawn
    const open = Object.values(panelOut).some((q) => q.lay.dashed > 0);
    return { items, defs, lines, H, info: { boxes, open, named: P.named && shapes.some((s) => kindType(s) === 'point'), chevrons: P.chevrons && chevDrawn > 0, panels } };
  }

  // ---------- (2) Phase: colour (hue wheel, level lines, a ring key) and black and white (a contour portrait) ----------
  // level sets arg f = k pi/6 by marching squares on an n x n grid (branch jumps of arg excluded)
  function argLevels(F, box, n, ks) {
    const G = [], dx = (box.x1 - box.x0) / n, dy = (box.y1 - box.y0) / n;
    for (let j = 0; j <= n; j++) { const r = new Float64Array(n + 1); for (let i = 0; i <= n; i++) { const w = F(C(box.x0 + i * dx, box.y0 + j * dy)); r[i] = fin(w) ? Math.atan2(w.im, w.re) : NaN; } G.push(r); }
    const out = {};
    for (const k of ks) {
      const th = k * Math.PI / 6, segs = [];
      const g = (v) => { let d = v - th; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI; return d; };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => [a, b, g(G[b][a])]);
        if (c.some((q) => !Number.isFinite(q[2]))) continue;
        const pts = [];
        for (let e = 0; e < 4; e++) {
          const P1 = c[e], P2 = c[(e + 1) % 4];
          if ((P1[2] < 0) !== (P2[2] < 0) && Math.abs(P1[2] - P2[2]) < Math.PI) { const s = P1[2] / (P1[2] - P2[2]); pts.push([box.x0 + (P1[0] + s * (P2[0] - P1[0])) * dx, box.y0 + (P1[1] + s * (P2[1] - P1[1])) * dy]); }
        }
        if (pts.length >= 2) segs.push([pts[0], pts[1]]);
        if (pts.length === 4) segs.push([pts[2], pts[3]]);
      }
      out[k] = joinSegs(segs);
    }
    return out;
  }
  // chain the cell segments into polylines, so dash patterns run along a whole level line
  function joinSegs(segs) {
    const key = (p) => `${p[0].toFixed(9)},${p[1].toFixed(9)}`, ends = new Map(), used = new Uint8Array(segs.length);
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
  }
  // grey modulus bands for B/W: floor(log2|f|) even -> grey 12 %, odd -> white
  async function bandsArt(F, box, wpt, dpi) {
    const w = Math.round(wpt * dpi / 72), h = Math.round(w * (box.y1 - box.y0) / (box.x1 - box.x0)), lum = new Uint8Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const f = F(C(box.x0 + (i + 0.5) / w * (box.x1 - box.x0), box.y1 - (j + 0.5) / h * (box.y1 - box.y0))), m = Math.log2(Math.hypot(f.re, f.im));
      lum[j * w + i] = Number.isFinite(m) && (Math.floor(m) & 1) === 0 ? 0xE0 : 0xFF;
    }
    const png = await XD.encodePNG({ w, h, type: 0, data: lum });
    return { url: 'data:image/png;base64,' + b64(png), box, lum, w, h, enc: 'grey', bytes: png.length, dpi };
  }
  // the ring key: the app's hue wheel on an annulus, as an RGB raster at dpi
  async function ringKey(Rpt, dpi) {
    const n = Math.round(2 * Rpt * dpi / 72), rgb = new Uint8Array(n * n * 3).fill(255);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = (i + 0.5) / n * 2 - 1, v = 1 - (j + 0.5) / n * 2;
      const t = (Math.atan2(v, u) + Math.PI) / (2 * Math.PI), c = A.hue(t);
      rgb.set(c, 3 * (j * n + i));
    }
    const png = await XD.encodePNG({ w: n, h: n, type: 2, data: rgb });
    return 'data:image/png;base64,' + b64(png);
  }
  // zeros and poles of F in a box (Calc.zerosPoles), bounded in time
  function zerosPoles(F, box) {
    if (typeof Calc === 'undefined' || !Calc.zerosPoles) return [];
    try { return (Calc.zerosPoles(F, box, { target: null, max: 24, budget: 120000, grid: 24, deadline: performance.now() + 400 }) || []).filter((r) => r && r.z && fin(r.z)); } catch (e) { return []; }
  }
  async function figPhase(o, P, W, T) {
    const st = A.state();
    const [tp, lp] = T;
    const F = A.plotF();
    const scr = A.screenBox('L');
    const bw = o.ink === 'bw';
    // Fit: the zeros and poles with a margin of their spread (at least one unit), inside the screen window
    let zp = zerosPoles(F, scr), box = scr;
    if (o.crop !== 'screen' && zp.length) {
      let b = null; for (const r of zp) b = unionBox(b, { x0: r.z.re, x1: r.z.re, y0: r.z.im, y1: r.z.im });
      const span = Math.max(b.x1 - b.x0, b.y1 - b.y0, 1), m = 0.5 * span;
      const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2, half = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + m;
      box = { x0: Math.max(scr.x0, cx - half), x1: Math.min(scr.x1, cx + half), y0: Math.max(scr.y0, cy - half), y1: Math.min(scr.y1, cy + half) };
      const stp = stepFor(box, W) / 2;
      box = { x0: Math.floor(box.x0 / stp) * stp, x1: Math.ceil(box.x1 / stp) * stp, y0: Math.floor(box.y0 / stp) * stp, y1: Math.ceil(box.y1 / stp) * stp };
      zp = zerosPoles(F, box);
    } else box = snapScreen(scr, W);
    const dc0 = A.capParts().dc || 'enhanced', keyW = bw || dc0 === 'classic' || dc0 === 'cauchy' ? 0 : Math.min(64, W * 0.2);
    const step = stepFor(box, W - keyW);
    const mL = tickW(box, step, tp) + 3, top = lp * 1.15 + 3, bottom = tp * 1.05 + 4.2;
    let w = W - mL - Math.max(4, keyW ? 4 : overR(box, step, tp)) - keyW, h = w / aspect(box);
    const hmax = Math.min(W * 0.95, P.maxH - top - bottom);
    if (h > hmax) { h = hmax; w = h * aspect(box); }
    const x = (W - keyW - w - mL - 4) / 2 + mL;
    let art;
    if (bw) art = await bandsArt(F, box, w, 300);
    else { art = await artPanel('L', box, w, Object.assign({}, o, { ink: 'colour' }), { mode: 'rgb', dpi: 300 }); if (!art) return null; }
    // the level lines, on a grid fine enough for 0.5 pt cells (bounded by the cost of F)
    const t0 = performance.now(); for (let i = 0; i < 50; i++) F(C(box.x0 + i * 0.013, box.y0 + i * 0.017)); const per = (performance.now() - t0) / 50;
    const n = Math.max(60, Math.min(240, Math.floor(Math.sqrt(400 / Math.max(per, 1e-4)))));
    const dc = (A.capParts().dc) || 'enhanced', ownLines = !bw && (dc === 'modulus' || dc === 'grid' || dc === 'classic' || dc === 'cauchy');
    const ks = ownLines ? [] : [...Array(12).keys()].map((k) => k - 5);
    const L = argLevels(F, box, n, ks);
    const curves = [];
    for (const k of ks) {
      const heavy = k === 0, pi = k === 6;
      if (bw) curves.push({ pts: L[k], w: heavy || pi ? 0.7 : 0.35, color: '#000000', dash: pi ? '3 2' : null, cap: 'butt', noObst: true });
      else curves.push({ pts: L[k], w: 0.35, color: '#1a1a1a', cap: 'butt', noObst: true });
    }
    const points = zp.map((r) => (r.kind === 'pole' ? { z: [r.z.re, r.z.im], kind: 'ring', r: 1.7, sw: 0.7 } : { z: [r.z.re, r.z.im], r: 1.6, fill: '#000000', stroke: '#ffffff', sw: 0.5 }));
    const p = XD.panel({ x, y: top, w, h, box, step, art: [art], curves, points, axes: o.axes === 'cross' ? 'cross' : 'box', ylab: 'left', tickPt: tp, labelPt: lp, ink: '#000000', lw: P.lw, axisTitles: [`\\operatorname{Re} ${A.panelVar('L')}`, `\\operatorname{Im} ${A.panelVar('L')}`] });
    const items = [p.markup, head(x, x + w, top - 3, '', A.panelVar('L'), lp)];
    if (keyW) {
      const kx = x + w + 6 + keyW / 2, ky = top + h / 2, R = keyW / 2 - 13, r0 = R * 0.55, kid = `${XD.ns}-key`;
      const url = await ringKey(R, 300);
      items.push(`<clipPath id="${kid}"><path d="M${f2(kx - R)} ${f2(ky)}a${f2(R)} ${f2(R)} 0 1 0 ${f2(2 * R)} 0a${f2(R)} ${f2(R)} 0 1 0 ${f2(-2 * R)} 0ZM${f2(kx - r0)} ${f2(ky)}a${f2(r0)} ${f2(r0)} 0 1 1 ${f2(2 * r0)} 0a${f2(r0)} ${f2(r0)} 0 1 1 ${f2(-2 * r0)} 0Z" clip-rule="evenodd"/></clipPath>`
        + `<image x="${f2(kx - R)}" y="${f2(ky - R)}" width="${f2(2 * R)}" height="${f2(2 * R)}" preserveAspectRatio="none" clip-path="url(#${kid})" xlink:href="${url}"/>`
        + `<circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(R)}" fill="none" stroke="#000000" stroke-width="0.5"/><circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(r0)}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
      items.push(XD.at(XD.tex('0', tp), kx + R + 1.5, ky, 'start', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\pi/2', tp), kx, ky - R - 1.5, 'middle', 'bottom', 'key'));
      items.push(XD.at(XD.tex('\\pm\\pi', tp), kx - R - 1.5, ky, 'end', 'mid', 'key'));
      items.push(XD.at(XD.tex('-\\pi/2', tp), kx, ky + R + 1.5, 'middle', 'top', 'key'));
      items.push(XD.at(XD.tex(`\\arg ${A.fname()}`, tp), kx, ky - R - 12, 'middle', 'bottom', 'key'));
    }
    return { items, defs: p.defs, lines: p.lines, H: top + h + bottom, info: { box, zp, bw, art } };
  }

  // ---------- (3) Landscape: one 3D panel, cropped to the relief, a clean frame and vector floor labels ----------
  async function figLand(o, P, W, T) {
    const [tp, lp] = T;
    const asp = A.paneAspect('L');
    let wpt = W - 8, hpt = wpt * Math.min(asp, 0.8);
    // the window: the screen's, with its edges rounded (to a step of about an eighth of each side), so the caption and
    // the floor labels read [-8, 8] x [-5, 5], not [-8.33, 8.33] x [-5.13, 5.13]
    let landBox = null;
    const lb = A.landBox ? A.landBox() : null;
    if (lb && [lb.x0, lb.x1, lb.y0, lb.y1].every(Number.isFinite)) {
      const rnd = (a0, a1) => { const st = niceStep(a1 - a0, 8), b0 = Math.round(a0 / st) * st, b1 = Math.round(a1 / st) * st; return b1 > b0 ? [b0, b1] : [a0, a1]; };
      const [x0, x1] = rnd(lb.x0, lb.x1), [y0, y1] = rnd(lb.y0, lb.y1);
      landBox = { x0, x1, y0, y1 };
    }
    // what is drawn (the relief and its block): the pixel bounds of the non-white
    const look = (r) => {
      let i0 = r.w, i1 = -1, j0 = r.h, j1 = -1;
      for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const q = 3 * (j * r.w + i); if (r.rgb[q] < 232 || r.rgb[q + 1] < 232 || r.rgb[q + 2] < 232) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
      return [i0, i1, j0, j1];
    };
    let r = await A.art('L', { wpt, hpt, dpi: 300, ink: printInkFor(o, A.state().alpha), alive: o.alive, landBox });
    if (!r) return null;
    {
      // the crop is enlarged to the panel (up to 1.6 x): rendered again at 300 dpi times that, so the printed image
      // stays at 300 ppi or more
      const [a0, a1] = look(r), kk = wpt / r.w, cwpt = a1 >= a0 ? (a1 - a0 + 36 / kk) * kk : wpt;
      const up = Math.min((W - 8) / cwpt, 1.6);
      if (up > 1.02) { const r2 = await A.art('L', { wpt, hpt, dpi: Math.ceil(300 * up), ink: printInkFor(o, A.state().alpha), alive: o.alive, landBox }); if (!r2) return null; r = r2; }
    }
    // crop to what is drawn, with a margin for the floor labels
    const unit = { x0: 0, x1: r.w, y0: 0, y1: r.h };
    let [i0, i1, j0, j1] = look(r);
    const L0 = r.land;
    if (L0 && L0.MVP && typeof GLR !== 'undefined' && GLR.M4) {
      // the block's floor corners: the floor labels sit just outside them
      const [ax0, ay0] = L0.aspect || [1, 1];
      for (const [cx0, cy0] of [[-ax0, -ay0], [ax0, -ay0], [ax0, ay0], [-ax0, ay0]]) {
        const c = GLR.M4.apply(L0.MVP, [cx0, cy0, L0.floorZ]);
        if (c[3] <= 1e-6) continue;
        const ii = (c[0] / c[3] * 0.5 + 0.5) * r.w, jj = (1 - (c[1] / c[3] * 0.5 + 0.5)) * r.h;
        i0 = Math.min(i0, ii); i1 = Math.max(i1, ii); j0 = Math.min(j0, jj); j1 = Math.max(j1, jj);
      }
    }
    if (i1 < 0) { i0 = 0; i1 = r.w - 1; j0 = 0; j1 = r.h - 1; }
    const k = wpt / r.w; // pt per pixel
    const pad = 18 / k;
    const c0 = Math.max(0, Math.floor(i0 - pad)), c1 = Math.min(r.w, Math.ceil(i1 + pad)), d0 = Math.max(0, Math.floor(j0 - pad * 0.4)), d1 = Math.min(r.h, Math.ceil(j1 + pad * 0.7));
    const cw = c1 - c0, ch = d1 - d0, rgb = new Uint8Array(cw * ch * 3);
    for (let j = 0; j < ch; j++) rgb.set(r.rgb.subarray(3 * ((j + d0) * r.w + c0), 3 * ((j + d0) * r.w + c0 + cw)), 3 * j * cw);
    const crop = { w: cw, h: ch, rgb };
    let scale = Math.min((W - 8) / (cw * k), 1.6);
    if (ch * k * scale > P.maxH - 8) scale = (P.maxH - 8) / (ch * k);
    const iw = cw * k * scale, ih = ch * k * scale;
    const x = (W - iw) / 2, top = 4;
    const art = await XD.art(crop, unit, { mode: o.ink === 'bw' ? 'grey' : 'rgb', wpt: iw });
    const items = [`<image x="${f2(x)}" y="${f2(top)}" width="${f2(iw)}" height="${f2(ih)}" preserveAspectRatio="none" xlink:href="${art.url}"/>`];
    items.push(`<rect x="${f2(x)}" y="${f2(top)}" width="${f2(iw)}" height="${f2(ih)}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
    const lines = [{ x0: x, y0: top, x1: x + iw, y1: top + ih, kind: 'frame' }];
    // floor labels: Re along the front edge, Im along the side edge, projected from the camera of the render
    const L = r.land;
    if (L && L.MVP && typeof GLR !== 'undefined' && GLR.M4) {
      const proj = (p) => { const c = GLR.M4.apply(L.MVP, p); if (c[3] <= 1e-6) return null; const px = (c[0] / c[3] * 0.5 + 0.5) * L.w, py = (1 - (c[1] / c[3] * 0.5 + 0.5)) * L.h; const ii = px * r.w / L.w, jj = py * r.h / L.h; return [x + (ii - c0) * k * scale, top + (jj - d0) * k * scale]; };
      const [ax, ay] = L.aspect || [1, 1], z0 = L.floorZ, eye = L.eye || [1, 1, 1], bx = L.box;
      const sx = eye[0] < 0 ? -1 : 1, sy = eye[1] < 0 ? -1 : 1;
      const Xw = (v) => ((v - bx.x0) / (bx.x1 - bx.x0) - 0.5) * 2 * ax, Yw = (v) => ((v - bx.y0) / (bx.y1 - bx.y0) - 0.5) * 2 * ay;
      let tk = '';
      const edge = (vals, at, out, name) => {
        const stp = vals.step, dec = XD.decimals(stp);
        let mid = null, dirm = null;
        // the floor's front edge as an axis line (it lies in front of the relief)
        const e0 = proj(at(vals.lo)), e1 = proj(at(vals.hi));
        if (e0 && e1) tk += `M${f2(e0[0])} ${f2(e0[1])}L${f2(e1[0])} ${f2(e1[1])}`;
        for (const v of vals.list) {
          const p = at(v), a = proj(p), b = proj([p[0] + out[0] * 0.08, p[1] + out[1] * 0.08, z0]);
          if (!a || !b) continue;
          const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, u = [dx / l, dy / l];
          tk += `M${f2(a[0])} ${f2(a[1])}l${f2(u[0] * 2.5)} ${f2(u[1] * 2.5)}`;
          const it = XD.tex(XD.tickTex(v, dec), tp);
          const cx = a[0] + u[0] * (4.5 + Math.abs(u[0]) * it.w / 2), cy = a[1] + u[1] * (4.5 + Math.abs(u[1]) * (it.a + it.d) / 2);
          const bb = XD.boxOf(it, cx, cy, 'middle', 'mid');
          if (XD.boxes.some((q) => q.x0 < bb.x1 + 1 && q.x1 > bb.x0 - 1 && q.y0 < bb.y1 + 1 && q.y1 > bb.y0 - 1) || bb.x0 < x + 1 || bb.x1 > x + iw - 1 || bb.y1 > top + ih - 1) continue;
          items.push(XD.at(it, cx, cy, 'middle', 'mid', 'tick'));
          mid = mid || []; mid.push([cx, cy]); dirm = u;
        }
        if (mid && mid.length) {
          const m = mid[Math.floor(mid.length / 2)], it = XD.tex(name, lp);
          const cx = m[0] + dirm[0] * (it.w / 2 + 9), cy = m[1] + dirm[1] * (lp + 3);
          const bb = XD.boxOf(it, cx, cy, 'middle', 'mid');
          if (!XD.boxes.some((q) => q.x0 < bb.x1 + 1 && q.x1 > bb.x0 - 1 && q.y0 < bb.y1 + 1 && q.y1 > bb.y0 - 1) && bb.x0 > x + 1 && bb.x1 < x + iw - 1 && bb.y1 < top + ih - 1) items.push(XD.at(it, cx, cy, 'middle', 'mid', 'axis-name'));
        }
      };
      const tks = (a0, a1) => { const s = niceStep(a1 - a0, 4); return { step: s, list: XD.ticks(a0, a1, s), lo: a0, hi: a1 }; };
      const v = A.panelVar('L');
      edge(tks(bx.x0, bx.x1), (t) => [Xw(t), sy * ay, z0], [0, sy], `\\operatorname{Re} ${v}`);
      edge(tks(bx.y0, bx.y1), (t) => [sx * ax, Yw(t), z0], [sx, 0], `\\operatorname{Im} ${v}`);
      if (tk) items.push(`<path d="${tk}" stroke="#000000" stroke-width="0.5" fill="none" stroke-linecap="round"/>`);
    }
    return { items, defs: '', lines, H: top + ih + 4, info: { box: L && L.box, art } };
  }

  // ---------- (4) The deformation: a filmstrip of H_t, or the one-plane paths figure ----------
  async function figFilm(o, P, W, T) {
    const st = A.state();
    const [tp, lp] = T;
    const m = A.morphLen(), n = 4;
    const ts = [...Array(n).keys()].map((i) => i * m / (n - 1));
    const fracTex = (t) => { const q = t / m * 3; if (m === 1) return ['0', '1/3', '2/3', '1'][Math.round(q)] || (XD.lang === 'ru' && I18 ? I18.texNum(CX.fmtNum(t, 2), 'ru') : CX.fmtNum(t, 2)); return Math.abs(t - Math.round(t)) < 1e-9 ? String(Math.round(t)) : `${Math.round(t * 3)}/3`; };
    const shapes = A.shapes(), srcWin = expandBox(A.screenBox('L0'), 3);
    const scr = A.screenBox('R');
    const cols = W >= 400 ? 4 : 2, rows = n / cols;
    const roughW = (W - 30) / cols;
    // the shared window: the union of the frames' content, inside the screen window
    let cb = null;
    if (o.crop !== 'screen') for (const t of ts) {
      const q = await A.art('R', { box: scr, wpt: 120, dpi: 72, ink: printInkFor(o, st.alpha), T: t, alive: o.alive });
      if (!q) return null;
      cb = unionBox(cb, contentBox(q, scr));
    }
    const box = o.crop === 'screen' || !cb ? snapScreen(scr, roughW) : fitBox(cb, scr, roughW);
    const step = stepFor(box, roughW);
    const mL = tickW(box, step, tp) + 3, gap = 8, mR = Math.max(2, XD.tex(XD.tickTex(XD.ticks(box.x0, box.x1, step).pop() || 0, XD.decimals(step)), tp).w / 2 + 1);
    let pw = (W - mL - gap * (cols - 1) - mR) / cols, ph = pw / aspect(box);
    const hmax = Math.min((W * 0.5) / rows, (P.maxH - rows * (lp * 1.4 + tp * 1.05 + 9)) / rows);
    if (ph > hmax) { ph = hmax; pw = ph * aspect(box); }
    const x0 = (W - (mL + cols * pw + (cols - 1) * gap + mR)) / 2;
    const titles = ts.map((t, i) => XD.tex(XD.lang === 'ru' ? `\\textit{${RU_LETTERS[i]}}\\enspace t=${fracTex(t)}` : `\\text{(${String.fromCharCode(97 + i)})}\\enspace t=${fracTex(t)}`, lp));
    const dmax = Math.max(...titles.map((it) => it.d)), amax = Math.max(...titles.map((it) => it.a));
    const rowH = amax + dmax + 4 + ph + tp * 1.05 + 4.2;
    const items = [], lines = []; let defs = '';
    // tracked points: the point shapes, else three points of the first boundary
    let tracked = shapes.filter((s) => kindType(s) === 'point' && s.p).slice(0, 4).map((s) => C(s.p[0], s.p[1]));
    if (!tracked.length) {
      const a = shapes.find((s) => kindType(s) !== 'point');
      if (a) { let cs = []; try { cs = Region.curvesOf(a, srcWin) || []; } catch (e) { cs = []; } const c = cs.find((q) => typeof q.f === 'function'); if (c) tracked = [0.3, 0.5, 0.7].map((s) => c.f(s)).filter((z) => fin(z) && z.re > box.x0 && z.re < box.x1 && z.im > box.y0 && z.im < box.y1); }
    }
    const Hs = new Map();
    const Hof = (t) => { const k = t.toFixed(6); if (!Hs.has(k)) Hs.set(k, A.homF(t)); return Hs.get(k); };
    const path = (z, a, b) => XD.sample((u) => { const w = Hof(u)(z); return fin(w) ? [w.re, w.im] : null; }, a, b, 48, 0.002 * (box.x1 - box.x0));
    for (const [i, t] of ts.entries()) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + mL + col * (pw + gap), yT = row * rowH + amax + dmax + 4;
      const art = await artPanel('R', box, pw, o, { T: t });
      if (!art) return null;
      const Ht = Hof(t);
      const curves = [];
      if (t > 0) for (const s of shapes) if (kindType(s) === 'area') curves.push({ pts: shapeCurves(s, (z) => z, box, pw, srcWin).pts, w: 0.5, color: '#666666', dash: '3 2', cap: 'butt' });
      shapes.forEach((s, si) => {
        if (kindType(s) === 'point') return;
        const tn = tonesOf(s, o);
        curves.push({ pts: shapeCurves(s, Ht, box, pw, srcWin).pts, w: P.lw.edge, color: o.ink === 'bw' ? '#000000' : tn.edge, cap: 'butt' });
      });
      const tolW = 1.4 * (box.x1 - box.x0) / pw;
      tracked.forEach((z, k) => {
        // (the dotted rest leaves out what is already drawn: where a path doubles back, its two dotted runs would
        // overlap out of phase and read as clustered dots)
        if (t < m) curves.push({ pts: unclutter(path(z, t, m), t > 0 ? path(z, 0, t) : [], tolW), w: 0.7, color: '#444444', dash: '0 1.8', cap: 'round' });
        if (t > 0) curves.push({ pts: path(z, 0, t), w: 0.6, color: o.ink === 'bw' ? '#000000' : PTS[k % 4][1], casing: 0.4, cap: 'round' });
      });
      const points = tracked.map((z, k) => { const w = Ht(z); return fin(w) ? { z: [w.re, w.im], r: 1.9, kind: PTS[k % 4][0], fill: o.ink === 'bw' ? '#000000' : PTS[k % 4][1], label: null } : null; }).filter(Boolean);
      const p = XD.panel({ x, y: yT, w: pw, h: ph, box, step, art: [art], curves, points, axes: 'box', ylab: col === 0 ? 'left' : 'none', xtrim: { l: col > 0, r: col < cols - 1 }, tickPt: tp, labelPt: lp, ink: '#000000', lw: { frame: 0.5, tick: 0.5 } });
      items.push(p.markup); defs += p.defs; lines.push(...p.lines);
      items.push(XD.at(titles[i], x, yT - 3 - dmax, 'start', 'base', 'title'));
    }
    return { items, defs, lines, H: rows * rowH, info: { box, ts, tracked, m, labs: ts.map(fracTex) } };
  }
  // polylines (world units) without the stretches within tol of the prior polylines or of their own earlier course
  function unclutter(segs, prior, tol) {
    const dense = (sg) => { const o = []; for (let i = 1; i < sg.length; i++) { const a = sg[i - 1], b = sg[i], n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / (tol / 3))); for (let k = i === 1 ? 0 : 1; k <= n; k++) o.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]); } return o; };
    const P = prior.flatMap((sg) => dense(sg)), own = [], out = [], t2 = tol * tol, lag = 12;
    const near = (p, list, upto) => { for (let i = 0; i < upto; i++) { const q = list[i]; const dx = q[0] - p[0], dy = q[1] - p[1]; if (dx * dx + dy * dy < t2) return true; } return false; };
    for (const sg of segs) {
      let cur = [];
      for (const p of dense(sg)) {
        if (near(p, P, P.length) || near(p, own, Math.max(0, own.length - lag))) { if (cur.length > 1) out.push(cur); cur = []; }
        else cur.push(p);
        own.push(p);
      }
      if (cur.length > 1) out.push(cur);
    }
    return out;
  }
  // the paths figure: one plane at t = end, the region's image over X's outline (dashed gray), and the paths
  // t -> H_t(z) of the points the app's morph figure keeps (its selection and its caption: buildFigure), drawn here
  // as 0.45 pt lines with 3 pt heads, from a dot at z to F(z)
  async function figPaths(o, P, W, T) {
    const st = A.state();
    const [tp, lp] = T;
    const leg = await A.legacyMorph({ widthIn: W / 72, alive: o.alive, lang: XD.lang });
    if (!leg || (o.alive && !o.alive())) return null;
    const m = A.morphLen(), shapes = A.shapes(), srcWin = expandBox(A.screenBox('L0'), 3), scr = A.screenBox('R');
    const kept = ((leg.morph && leg.morph.kept) || []).map((k) => C(k.z[0], k.z[1]));
    const Hs = new Map();
    const Hof = (t) => { const k = t.toFixed(6); if (!Hs.has(k)) Hs.set(k, A.homF(t)); return Hs.get(k); };
    const span = Math.max(scr.x1 - scr.x0, scr.y1 - scr.y0);
    const paths = kept.map((z) => XD.sample((u) => { const w = Hof(u)(z); return fin(w) ? [w.re, w.im] : null; }, 0, m, 64, 0.0015 * span));
    // the window: what is drawn at t = end, X's outline and the paths, inside the screen window
    let cb = null;
    if (o.crop !== 'screen') {
      const q = await A.art('R', { box: scr, wpt: 150, dpi: 72, ink: printInkFor(o, st.alpha), T: m, alive: o.alive });
      if (!q) return null;
      cb = contentBox(q, scr);
      for (const s of shapes) if (kindType(s) !== 'point') { const b = ptsBox(shapeCurves(s, (z) => z, scr, 150, srcWin).pts, scr); if (b) cb = unionBox(cb, b); }
      const pb = ptsBox(paths.flat(), scr); if (pb) cb = unionBox(cb, pb);
    }
    const mL0 = 24, box = o.crop === 'screen' || !cb ? snapScreen(scr, W - mL0) : fitBox(cb, scr, W - mL0);
    const step = stepFor(box, W - mL0);
    const mL = tickW(box, step, tp) + 3, top = lp * 1.15 + 3, bottom = tp * 1.05 + 4.2;
    let w = W - mL - Math.max(4, overR(box, step, tp)), h = w / aspect(box);
    const hmax = Math.min(W * 0.75, P.maxH - top - bottom);
    if (h > hmax) { h = hmax; w = h * aspect(box); }
    const x = (W - w - mL - 4) / 2 + mL;
    const art = await artPanel('R', box, w, o, { T: m });
    if (!art) return null;
    const Hm = Hof(m), curves = [];
    for (const s of shapes) if (kindType(s) !== 'point') curves.push({ pts: shapeCurves(s, (z) => z, box, w, srcWin).pts, w: 0.5, color: '#707070', dash: '3 2', cap: 'butt' });
    let bwI = 0;
    for (const s of shapes) {
      const t = kindType(s);
      if (t === 'point') continue;
      const tn = tonesOf(s, o), open = t === 'area' && Region.isOpen && Region.isOpen(s);
      let dash = open && P.dashOpen ? '3 2' : null;
      if (o.ink === 'bw' && !dash) dash = bwDash(P, bwI++);
      curves.push({ pts: shapeCurves(s, Hm, box, w, srcWin).pts, w: t === 'area' ? P.lw.edge : P.lw.curve, color: o.ink === 'bw' ? '#000000' : tn.edge, dash, cap: dash && (dash.indexOf('0 ') === 0 || dash === '4 2.2 0 2.2') ? 'round' : 'butt' });
    }
    const ink = '#1a1a1a';
    for (const pp of paths) curves.push({ pts: pp, w: 0.45, color: ink, casing: 0.35, cap: 'round', noObst: true });
    const over = (X, Y) => {
      let g = '';
      for (const pp of paths) {
        const seg = pp[pp.length - 1], first = pp[0] && pp[0][0];
        if (!seg || seg.length < 2 || !first) continue;
        const e = seg[seg.length - 1];
        let k = seg.length - 2; while (k > 0 && Math.hypot(X(seg[k][0]) - X(e[0]), Y(seg[k][1]) - Y(e[1])) < 2) k--;
        const th = Math.atan2(Y(e[1]) - Y(seg[k][1]), X(e[0]) - X(seg[k][0]));
        g += `<circle cx="${f2(X(first[0]))}" cy="${f2(Y(first[1]))}" r="1.05" fill="${ink}" stroke="#ffffff" stroke-width="0.35"/>`;
        g += XD.arrowHead(X(e[0]), Y(e[1]), th, 3.2, ink);
      }
      return g;
    };
    const p = XD.panel({ x, y: top, w, h, box, step, art: [art], curves, points: [], axes: o.axes === 'cross' ? 'cross' : 'box', ylab: 'left', tickPt: tp, labelPt: lp, ink: '#000000', lw: P.lw, axisTitles: [`\\operatorname{Re} ${A.panelVar('R')}`, `\\operatorname{Im} ${A.panelVar('R')}`], over });
    const items = [p.markup, head(x, x + w, top - 3, '', `${A.panelVar('L')},\\ ${A.panelVar('R')}`, lp)];
    let cap = leg.captionTex || '';
    if (!P.dashOpen) cap = cap.replace(/\s*Dashed boundaries do not belong to the sets\./, '');
    if (!P.dashOpen && XD.lang !== 'en') { const d = using(XD.lang, () => $t('Dashed boundaries do not belong to the sets.')); cap = cap.split(' ' + d).join('').split(d).join(''); }
    return { items, defs: p.defs, lines: p.lines, H: top + h + bottom, info: { box, kept: kept.length, m }, captionTex: cap };
  }
  // =====================================================================================================
  // 4. Captions (journal register, en-US), the build, the LaTeX snippet
  // =====================================================================================================
  const numTex = (v) => (+v.toPrecision(3)).toString();
  // captions are built inside using(lang): $t and I18N.lang give the caption's language
  const capRu = () => !!I18 && I18.lang === 'ru';
  // [x0,x1]x[y0,y1]; in Russian a semicolon inside a bracket pair when an endpoint is a decimal (GLOSSARY 2.3)
  const winTex = (b) => (!b ? '' : capRu() ? `${I18.texInterval(numTex(b.x0), numTex(b.x1))}\\times${I18.texInterval(numTex(b.y0), numTex(b.y1))}` : `[${numTex(b.x0)},${numTex(b.x1)}]\\times[${numTex(b.y0)},${numTex(b.y1)}]`);
  const us = (segs) => segs.map((s) => (s.t != null ? { t: s.t.replace(/colour/g, 'color').replace(/Colour/g, 'Color').replace(/grey/g, 'gray').replace(/ \(bar\)/g, '') } : s));
  // a point of the plane in a Russian caption: the decimal comma (a short number formula, never a snippet)
  const cxTexL = (z) => { const s = cxTex(z); return capRu() ? s.replace(/(\d)\.(\d)/g, '$1{,}$2') : s; };
  const listTex = (zs) => zs.map((r) => `$${cxTexL(r.z)}$${(r.mult || 1) > 1 ? $t(' (order {mult})', { mult: r.mult }) : ''}`);
  const joinWords = (a) => (a.length <= 1 ? a.join('') : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')}, and ${a[a.length - 1]}`);
  // Russian: «a, b и c», with «;» between decimals («$0{,}5$; $1$ и $2$»)
  const joinL = (a) => (!capRu() ? joinWords(a) : a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(a.some((x) => /\{,\}/.test(x)) ? '; ' : ', ')} и ${a[a.length - 1]}`);
  // one template per sentence (Russian word order, notes/i18n/GLOSSARY.md 1.11); called inside using(lang)
  function captionFor(o, view, body) {
    const ru = capRu();
    const c = A.capParts({ letters: !!PRESET[o.for].named });
    const map = c.mapTex ? `$${c.mapTex}$` : `$${c.Fname}$`;
    // Phase and Landscape of the deformation: the picture is H_t at the current t
    const hm = c.hm && (view === 'phase' || view === 'land' || view === 'xyL');
    const homDef = () => (hm && c.hom ? $t(' Shown at $t=%{t}$, where $H_t$ deforms the identity ($t=0$) into %{map} ($t=%{tEnd}$) along %{hom}.', { t: tnum(c.hom.T.toFixed(2)), map, tEnd: tnum(c.hom.m), hom: c.hom.tex }) : '');
    if (view === 'phase') {
      const f = hm ? 'H_t' : c.Fname, i = body.info, zs = i.zp.filter((r) => r.kind !== 'pole'), ps = i.zp.filter((r) => r.kind === 'pole');
      let s = $t('Phase portrait of %{map} on $%{box}$', { map: hm ? '$H_t$' : map, box: winTex(i.box) });
      if (i.bw) s += $t(', drawn as level sets of $\\arg %{f}$ at multiples of $\\pi/6$; heavy: $\\arg %{f}=0$, dashed: $\\arg %{f}=\\pi$. Bands: $\\lfloor\\log_2|%{f}|\\rfloor$ even (gray) or odd (white).', { f });
      else {
        const dc = c.dc || 'enhanced', lv = $t('the thin lines are the level sets $\\arg %{f}\\in\\frac{\\pi}{6}\\mathbb{Z}$', { f });
        if (dc === 'classic') s += $t(': brightness increases with $|%{f}|$, so zeros are black and poles white.', { f });
        else if (dc === 'cauchy') s += $t(': the Cauchy integral $\\frac{1}{2\\pi i}\\oint_\\gamma \\frac{F(\\zeta)}{\\zeta-z}\\,d\\zeta$ over the selected closed curve, which equals $F$ inside and $0$ outside.');
        else if (dc === 'modulus') s += $t(': the color shows $\\arg %{f}$ (key at right); the lines are level curves of $|%{f}|$ and of $\\arg %{f}$.', { f });
        else if (dc === 'grid') s += $t(': the color shows $\\arg %{f}$ (key at right); the lines are the preimages of the coordinate lines of the image plane.', { f });
        else if (dc === 'phase') s += $t(': the color shows $\\arg %{f}$ (key at right) and %{lv}.', { f, lv });
        // (the white line is |F| = 1: the renderer's unit level, on screen as in print)
        else { const n = c.sectors || 12; s += $t(': the color shows $\\arg %{f}$ (key at right), %{lv}, and the shading steps in $|%{f}|$ by factors of $e^{2\\pi/%{n}}\\approx %{x}$; the white line is $|%{f}|=1$.', { f, lv, n, x: tnum(+Math.exp(2 * Math.PI / n).toFixed(2)) }); }
      }
      if (zs.length) s += zs.length <= 4 ? $t(' Zeros (dots) at %{list}.', { list: joinL(listTex(zs)) }) : $tn(' {n} zeros (dots).', ' {n} zeros (dots).', zs.length);
      if (ps.length) s += ps.length <= 4 ? $t(' Poles (open circles) at %{list}.', { list: joinL(listTex(ps)) }) : $tn(' {n} poles (open circles).', ' {n} poles (open circles).', ps.length);
      return s + homDef();
    }
    if (view === 'land') {
      const f = hm ? 'H_t' : c.Fname, ht = { log: `\\log|${f}|`, abs: `|${f}|`, re: `\\operatorname{Re} ${f}`, im: `\\operatorname{Im} ${f}` }[c.height || 'log'];
      // (all sheets: the multivalued function, Ln in Russian: GLOSSARY 2.2, review math-8)
      let s = $t('Landscape of %{map}%{over}: the height is $%{ht}$', { map: hm ? '$H_t$' : c.sheets && I18 ? I18.notation(map, undefined, { multi: true }) : map, over: body.info.box ? $t(' over $%{box}$', { box: winTex(body.info.box) }) : '', ht });
      if (c.phase && o.ink !== 'bw') s += $t(' and the color shows $\\arg %{f}$', { f });
      s += c.sheets ? $t('; all sheets of the Riemann surface are shown.') : c.height === 'log' || c.height === 'abs' || !c.height ? $t('; zeros are pits and poles are peaks.') : '.';
      return s + homDef();
    }
    if (view === 'morph') {
      if (body.captionTex) return body.captionTex;
      const i = body.info, ts = i.ts.map((t, k) => $t('(%{letter}) $t=%{t}$', { letter: ru ? RU_LETTERS[k] : String.fromCharCode(97 + k), t: i.labs[k] }));
      let s = $t('The deformation $H_t$ from the identity ($t=0$) to %{map} ($t=%{m}$), at %{ts}.', { map, m: tnum(i.m), ts: joinL(ts) });
      if (i.tracked.length) s += $t(" Solid: the paths $t\\mapsto H_t(z)$ of the marked points up to the frame's $t$; dotted: the rest of each path; dashed: the boundary at $t=0$.");
      return s;
    }
    // the shape list in the genitive («образ круга»): the app gives it as shapeListGen; English has one form
    const genOf = () => (c.shapeListGen ? A.segsTex(us(c.shapeListGen)) : A.segsTex(us(c.shapeList)));
    // one merged panel: the deformation H_t (on the globe, or over a d/dz step), or Phase on the Riemann sphere
    const g = A.state();
    if (view === 'xyR' && c.hom) {
      const list0 = A.segsTex(us(c.shapeList));
      return $t('The deformation $H_t$%{choice}%{choice2} Shown at $t=%{t}$, where $H_t$ deforms the identity ($t=0$) into %{map} ($t=%{tEnd}$) along %{hom}.', {
        choice: g.rGlobe ? $t(' on the Riemann sphere, with $\\infty$ at the north pole') : '',
        choice2: list0 ? $t(': the image of %{list0} under $H_t$.', { list0: genOf() }) : '.',
        t: tnum(c.hom.T.toFixed(2)), map, tEnd: tnum(c.hom.m), hom: c.hom.tex });
    }
    if (view === 'xyL' && g.main === 'phase') return $t('Phase portrait of %{choice} on the Riemann sphere, with $\\infty$ at the north pole: the color shows $\\arg %{choice2}$.%{homDef}', { choice: c.hm ? '$H_t$' : map, choice2: c.hm ? 'H_t' : c.Fname, homDef: homDef() });
    // X -> Y
    const i = body.info, two = i.panels.length === 2;
    const list = A.segsTex(us(c.shapeList));
    const cap1 = list ? list.charAt(0).toUpperCase() + list.slice(1) : '';
    const many = c.nShapes > 1, lvar = c.lvar;
    if (o.for === 'homework' || o.for === 'slides') {
      if (o.for === 'slides') return '';
      const wmap = c.formula ? `$${A.panelVar('R')}=${c.formula}$` : map;
      let s = list ? (many ? $t('Left: %{list}. Right: their images under %{wmap}.', { list, wmap }) : $t('Left: %{list}. Right: its image under %{wmap}.', { list, wmap })) : $t('The map %{wmap}.', { wmap });
      if (!two) s = list ? (i.panels[0] === 'L' ? $t('%{cap1} in the $%{lvar}$-plane.', { cap1, lvar }) : many ? $t('The images of %{list} under %{map}.%{pat}', { list: genOf(), map: wmap, pat: '' }) : $t('The image of %{list} under %{map}.%{pat}', { list: genOf(), map: wmap, pat: '' })) : $t('The map %{wmap}.', { wmap });
      if (i.named && two) { const n = c.nPoints; const L = (k) => String.fromCharCode(65 + k); s += n === 1 ? $t(" The point $A$ goes to $A'$.") : $t(" The points $%{first}$--$%{n}$ go to $%{first}'$--$%{n}'$.", { first: L(0), n: L(n - 1) }); }
      if (i.open && PRESET[o.for].dashOpen) s += $t(' Dashed: boundary not included.');
      if (i.chevrons) s += $t(' Arrowheads: orientation.');
      return s;
    }
    const pat0 = A.segsTex(us(c.pattern)), pat = pat0 ? ' ' + pat0 : '';
    // (a) and (b): in Russian «а — круг …; б — образ …», the list in lower case after the dash
    const head = ru ? list : cap1;
    if (two) return list ? (many ? $t('(a) %{head} in the $%{lvar}$-plane. (b) Their images under %{map}.%{pat}', { head, lvar, map, pat }) : $t('(a) %{head} in the $%{lvar}$-plane. (b) Its image under %{map}.%{pat}', { head, lvar, map, pat })) : $t('(a) The %{lvar}-plane. (b) The image under %{map}.%{pat}', { lvar, map, pat });
    if (i.panels[0] === 'L') return list ? $t('%{cap1} in the $%{lvar}$-plane.', { cap1, lvar }) : $t('The $%{lvar}$-plane.', { lvar });
    return list ? (many ? $t('The images of %{list} under %{map}.%{pat}', { list: genOf(), map, pat }) : $t('The image of %{list} under %{map}.%{pat}', { list: genOf(), map, pat })) : $t('The image under %{map}.%{pat}', { map, pat });
  }
  // a Russian caption as LaTeX: Russian notation (tg, sh, ln), no-break spaces (GLOSSARY 3.6) written as ~
  const polish = (tex, lang) => (lang === 'ru' && I18 && tex ? I18.nbspTeX(I18.nbsp(I18.notation(tex, 'ru'), 'ru')).replace(/—/g, '---') : tex);
  // LaTeX caption -> typesetting segments ({t}, {m}, {b}; a Russian caption also {i}: the italic panel letters, and
  // ~ is a no-break space)
  function segsOf(tex, lang) {
    const out = [];
    const ru = (lang || XD.lang) === 'ru' || /[Ѐ-ӿ]/.test(String(tex || ''));
    for (const part of String(tex || '').split(/(\$[^$]*\$)/)) {
      if (!part) continue;
      if (part[0] === '$' && part.length > 1 && part[part.length - 1] === '$') { out.push({ m: part.slice(1, -1) }); continue; }
      for (const q of part.split(ru ? /(\\textbf\{[^}]*\}|\\textit\{[^}]*\})/ : /(\\textbf\{[^}]*\})/)) {
        if (!q) continue;
        const b = /^\\textbf\{([^}]*)\}$/.exec(q), it = ru ? /^\\textit\{([^}]*)\}$/.exec(q) : null;
        const un = (s) => s.replace(/---/g, '—').replace(/--/g, '–').replace(/\\"o/g, 'ö').replace(/\\"u/g, 'ü').replace(/\\"a/g, 'ä').replace(/\\([#$%&_{}])/g, '$1').replace(/~/g, ru ? ' ' : ' ').replace(/``|''/g, '"');
        out.push(b ? { b: un(b[1]) } : it ? { i: un(it[1]) } : { t: un(q) });
      }
    }
    return out;
  }
  const plainOf = (tex, lang) => segsOf(tex, lang).map((s) => (s.m != null ? s.m.replace(/\\(operatorname|mathrm|text)\{([^}]*)\}/g, '$2').replace(/\\[a-zA-Z]+/g, (m) => ({ '\\pi': 'π', '\\infty': '∞', '\\arg': 'arg', '\\log': 'log', '\\times': '×', '\\mapsto': '↦', '\\in': '∈', '\\le': '≤', '\\pm': '±' }[m] || '')).replace(/[{}]/g, '') : s.b != null ? s.b : s.i != null ? s.i : s.t)).join('');
  const defaults = () => ({ for: 'article', cols: 1, sizeId: null, text: null, ink: 'colour', crop: 'fit', axes: null, panels: 'both', deform: 'film' });
  // build(o): the figure for the current view. o: {for, cols, sizeId, customPt, text, ink, crop, axes, panels, deform,
  // name, captionTex (an edited caption), capInImage, view, alive}. -> {svg, W, H, boxes, lines, glyphs, meta,
  // captionTex, name, view, Wtex, ...} or null when cancelled
  async function build(opts) {
    if (!A) throw new Error('Figure is not attached');
    if (!XD.ready()) throw new Error('MathJax is still loading');
    const o = Object.assign(defaults(), opts || {});
    const P = Object.assign({}, PRESET[o.for] || PRESET.article);
    const size = sizeOf(o), Wtex = size.pt, W = XD.bp(Wtex);
    const tsz = o.text || (o.for === 'homework' || o.for === 'slides' ? 11 : 10);
    const T = TYPE[o.for][tsz] || TYPE.article[10];
    if (o.axes) P.axes = o.axes;
    // a slide's figure fits under the frame title (16:9: about half its width tall)
    P.maxH = o.for === 'slides' ? 0.5 * W : Infinity;
    const view = o.view || A.viewKind();
    const name = (o.name || A.sceneName() || 'figure').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'figure';
    // the caption language: o.lang ('en' | 'ru'), else the interface's
    const lang = o.lang === 'en' || o.lang === 'ru' ? o.lang : uiLang();
    XD.begin(name, lang);
    const t0 = performance.now();
    let body;
    if (view === 'phase') body = await figPhase(o, P, W, T);
    else if (view === 'land') body = await figLand(o, P, W, T);
    else if (view === 'morph') body = o.deform === 'paths' ? await figPaths(o, P, W, T) : await figFilm(o, P, W, T);
    else body = await figXY(view === 'xyL' || view === 'xyR' ? Object.assign({}, o, { panels: view === 'xyL' ? 'L' : 'R' }) : o, P, W, T);
    if (!body || (o.alive && !o.alive())) return null;
    const autoCap = polish(using(lang, () => captionFor(o, view, body)), lang);
    const cp = using(lang, () => A.capParts()), Fn = view === 'morph' || (cp.hm && (view === 'phase' || view === 'land')) ? 'H_t' : cp.Fname;
    const slideTitle = polish(using(lang, () => (view === 'phase' ? $t('Phase portrait of $%{Fn}$', { Fn }) : view === 'land' ? $t('Landscape of $%{Fn}$', { Fn }) : view === 'morph' ? $t('The deformation $H_t$') : cp.mapTex && cp.mapTex.length < 60 ? $t('The map $%{mapTex}$', { mapTex: cp.mapTex }) : $t('The map $%{Fn}$', { Fn }))), lang);
    const captionTex = o.captionTex != null ? o.captionTex : autoCap;
    let H = body.H;
    const items = body.items.slice();
    if (o.capInImage && captionTex) {
      const c = XD.caption([{ b: using(lang, () => $t('Figure 1.')) }, { t: ' ' }, ...segsOf(captionTex, lang)], 0, H + 7, W, T[2]);
      items.push(c.markup); H += 7 + c.h + 2;
    }
    const meta = { app: 'Complex Map Workbench', name, preset: o.for, ink: o.ink, view, width: `${Wtex}pt`, scene: A.sceneMeta() };
    const fig = XD.svg({ W, H, items, defs: body.defs, lines: body.lines, meta });
    return Object.assign(fig, { name, captionTex, autoCaption: autoCap, slideTitle, view, for: o.for, Wtex, size, T, star: !!size.star, cols: o.cols, ink: o.ink, ms: Math.round(performance.now() - t0), info: body.info, opts: o, lang });
  }
  // the caption typeset alone, as LaTeX would set it under the figure ("Figure 1." in bold), for the paper preview
  function captionSVG(tex, Wbp, pt, lang) {
    const keep = { name: XD.name, ns: XD.ns, glyphs: XD.glyphs, boxes: XD.boxes, lang: XD.lang };
    try {
      XD.begin('caption', lang || 'en');
      const c = XD.caption([{ b: using(lang, () => $t('Figure 1.')) }, { t: ' ' }, ...segsOf(tex, lang)], 0, 0, Wbp, pt);
      return XD.svg({ W: Wbp, H: c.h + pt * 0.3, items: [c.markup] });
    } finally { Object.assign(XD, keep); }
  }
  const layoutOf = (fig) => (fig.for === 'homework' ? '\\linewidth' : fig.star ? '\\textwidth' : fig.cols === 2 ? '\\columnwidth' : '\\linewidth');
  const latex = (fig, captionTex) => using(fig.lang, () => latexIn(fig, captionTex));
  function latexIn(fig, captionTex) {
    const cap0 = captionTex != null ? captionTex : fig.captionTex;
    const n = fig.name, w = +fig.Wtex.toFixed(2), size = $t(fig.size.label).replace(/^[А-ЯЁ]/, (c) => c.toLowerCase());
    // a Russian caption in a document whose main language is English (review i18n-21): one more comment line, and the
    // caption is already inside \foreignlanguage{russian}{...}, which a Russian-main document reads the same (math-14)
    const engMain = fig.lang === 'ru' ? [$t('% English main document: \\usepackage[T2A,T1]{fontenc}\\usepackage[russian,english]{babel}')] : [];
    const cap = fig.lang === 'ru' && cap0 ? `\\foreignlanguage{russian}{${cap0}}` : cap0;
    if (fig.for === 'homework') return [
      $t('% %{n}.pdf is made for \\linewidth = %{w}pt (%{size}); natural size wherever it fits, shrunk only on a narrower page.', { n, w, size }),
      $t('% Preamble: \\usepackage{graphicx,amsmath,amssymb,float}'),
      ...engMain,
      '\\begin{figure}[H]',
      '  \\centering',
      `  \\includegraphics[width=\\ifdim\\linewidth<${w}pt \\linewidth\\else ${w}pt\\fi]{${n}}`,
      `  \\caption{${cap}}`,
      `  \\label{fig:${n}}`,
      '\\end{figure}', ''].join('\n');
    if (fig.for === 'slides') return [
      $t('% %{n}.pdf is made for \\textwidth = %{w}pt (%{size}); shrunk only on a narrower frame. Preamble: \\usepackage{graphicx}', { n, w, size }),
      `\\begin{frame}{${fig.slideTitle || n}}`,
      '  \\centering',
      `  \\includegraphics[width=\\ifdim\\linewidth<${w}pt \\linewidth\\else ${w}pt\\fi]{${n}}`,
      '\\end{frame}', ''].join('\n');
    const L = layoutOf(fig), env = fig.star ? 'figure*' : 'figure';
    return [
      $t('% %{n}.pdf is made for %{L} = %{w}pt (%{size}); include it unscaled so its labels match your text.', { n, L, w, size }),
      $t('% If your %{L} is narrower, use [width=%{L}] (the labels will shrink). Preamble: \\usepackage{graphicx,amsmath,amssymb}', { L }),
      ...engMain,
      `\\begin{${env}}[tbp]`,
      '  \\centering',
      `  \\includegraphics{${n}}`,
      `  \\caption{${cap}}`,
      `  \\label{fig:${n}}`,
      `\\end{${env}}`, ''].join('\n');
  }
  const pdf = (fig) => XD.pdf(fig);
  async function png(fig, dpi = 300) { const r = await XD.pngBytes(fig, dpi, fig.ink === 'bw'); return new Blob([r.bytes], { type: 'image/png' }); }
  const svgBlob = (fig) => new Blob([fig.svg], { type: 'image/svg+xml' });
  async function greyProof(fig, dpi = 150) { const r = await XD.pngBytes(fig, dpi, true); return new Blob([r.bytes], { type: 'image/png' }); }
  // For Docs: image/png + text/html (an <img> at its printed width, the caption as its alt text); else a selection
  // copy of the image; else false (the caller saves the PNG)
  async function copyImage(fig) {
    const blob = await png(fig, 300);
    const url = 'data:image/png;base64,' + b64(new Uint8Array(await blob.arrayBuffer()));
    const wpx = Math.round(fig.W / 72 * 96);
    const alt = plainOf(fig.captionTex || '', fig.lang).replace(/"/g, '&quot;');
    const html = `<img src="${url}" width="${wpx}" style="width:${(fig.W / 72).toFixed(2)}in" alt="${alt}">`;
    try {
      if (navigator.clipboard && navigator.clipboard.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob, 'text/html': new Blob([html], { type: 'text/html' }) })]);
        return 'clipboard';
      }
    } catch (e) { /* fall through to a selection copy */ }
    try {
      const host = document.createElement('div');
      host.contentEditable = 'true';
      host.style.cssText = 'position:fixed;left:-10000px;top:0;opacity:0';
      host.innerHTML = html;
      document.body.append(host);
      const r = document.createRange(); r.selectNodeContents(host);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
      const ok = document.execCommand && document.execCommand('copy');
      sel.removeAllRanges(); host.remove();
      if (ok) return 'selection';
    } catch (e) { /* fall through */ }
    return false;
  }

  // =====================================================================================================
  // 5. Remembered settings and the dialog
  // =====================================================================================================
  const LS = () => (A && A.lsk ? A.lsk('cmw-figure-v1') : 'cmw-figure-v1');
  function loadSet() {
    const d = { for: 'article', cols: 1, size: {}, text: {}, ink: 'colour', crop: 'fit', axes: {}, fine: false, deform: 'film', last: null, customPt: null, capLang: 'ui' };
    try { const s = JSON.parse(localStorage.getItem(LS()) || 'null'); if (s && typeof s === 'object') return Object.assign(d, s); } catch (e) { /* storage may be blocked */ }
    return d;
  }
  function saveSet(s) { try { localStorage.setItem(LS(), JSON.stringify(s)); } catch (e) { /* storage may be blocked */ } }
  const sizeKey = (s) => (s.for === 'article' ? (s.cols === 2 ? 'article2' : 'article1') : s.for);
  // the caption language (DESIGN.md 12, i18n-22): the dialog offers it only when the interface is not English, so an
  // English interface keeps its dialog and its captions as they were
  const capLangOf = (s) => (uiLang() !== 'en' && (s.capLang === 'en' || s.capLang === 'ru') ? s.capLang : uiLang());
  // the build options from the remembered settings
  function optsOf(s, extra) {
    const sk = sizeKey(s);
    return Object.assign({ for: s.for, cols: s.cols, sizeId: s.size[sk] || null, customPt: s.customPt, text: s.text[s.for] || null, ink: s.ink, crop: s.crop, axes: s.axes[s.for] || null, deform: s.deform, panels: s.panels || 'both', lang: capLangOf(s) }, extra || {});
  }
  const ICON = {
    article: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="3.5" y="2.5" width="13" height="15" rx="1"/><path d="M6 6h3.5M6 8.5h3.5M6 11h3.5M11 6h3M11 8.5h3M6 14h8"/></svg>',
    homework: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 3.5h12v13H4z"/><path d="M6.5 7l1.5 1.5L11 5.5M6.5 12.5h7"/></svg>',
    slides: '<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2.5" y="4" width="15" height="10" rx="1"/><path d="M10 14v3M7 17h6"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 16 16"><path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8z" fill="none" stroke="currentColor" stroke-width="1.2"/><circle cx="8" cy="8" r="2" fill="currentColor"/></svg>',
    loupe: '<svg width="14" height="14" viewBox="0 0 16 16"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="1.3"/><path d="M10.5 10.5l3.5 3.5" stroke="currentColor" stroke-width="1.5"/></svg>',
    down: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 3.5l3 3 3-3" stroke="currentColor" fill="none" stroke-width="1.3"/></svg>',
    right: '<svg width="10" height="10" viewBox="0 0 10 10"><path d="M3.5 2l3 3-3 3" stroke="currentColor" fill="none" stroke-width="1.4"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" stroke-width="1.5"/></svg>',
  };
  // hairline "words" of dummy text at the document's x-height (deterministic)
  const dummy = (lines, seed, indent) => {
    let r = seed, out = '';
    const rnd = () => { r = (r * 9301 + 49297) % 233280; return r / 233280; };
    for (let l = 0; l < lines; l++) {
      let row = '<div class="xf-txt">';
      if (l === 0 && indent) row += '<i style="width:14px;background:none"></i>';
      const n = l === lines - 1 ? 5 + Math.floor(rnd() * 6) : 30;
      for (let k = 0; k < n; k++) row += `<i style="width:${10 + Math.floor(rnd() * 10) * 4}px"></i>`;
      out += row + '</div>';
    }
    return out;
  };
  const ptTxt = (v) => $t('{x} pt', { x: I18 ? I18.num(v) : v });
  let dlg = null; // the open dialog's state (tests read it)
  let lastFig = null;
  function open() {
    if (!A || document.querySelector('.modal-bg')) return;
    const { h, toast } = A;
    const set = loadSet();
    const view = A.viewKind();
    const opener = document.activeElement;
    let token = 0, fig = null, capEdited = null, closed = false;
    const st = { set, view, building: false };
    dlg = st;
    const close = () => { closed = true; token++; bg.remove(); document.removeEventListener('keydown', onKey, true); dlg = null; if (opener && opener.focus) opener.focus({ preventScroll: true }); };
    const onKey = (e) => {
      if (e.key === 'Escape') { if (document.querySelector('#popHost .pop.menu')) return; e.preventDefault(); close(); return; }
      // Tab and Shift+Tab stay inside the dialog (aria-modal): from the last control to the first and back
      if (e.key === 'Tab' && !document.querySelector('#popHost .pop.menu')) {
        const md = bg.querySelector('.modal.xf');
        if (!md) return;
        const fs = [...md.querySelectorAll('button, [href], input, select, textarea, [tabindex]')].filter((x) => !x.disabled && x.tabIndex >= 0 && !x.closest('[hidden]') && x.getClientRects().length);
        if (!fs.length) return;
        const a = document.activeElement, i = fs.indexOf(a);
        if (e.shiftKey && (i <= 0)) { e.preventDefault(); fs[fs.length - 1].focus(); }
        else if (!e.shiftKey && (i < 0 || i === fs.length - 1)) { e.preventDefault(); fs[0].focus(); }
      }
    };
    document.addEventListener('keydown', onKey, true);
    const bg = h('div', { class: 'modal-bg', onclick: (e) => { if (e.target === bg) close(); } });
    const segB = (id, value, options, onchange, label, cls) => {
      const el = h('div', { class: 'seg xf-seg' + (cls ? ' ' + cls : ''), id, role: 'radiogroup', 'aria-label': label });
      for (const [v, l, sub, ic] of options) {
        const b = h('button', { type: 'button', role: 'radio', 'data-v': v, 'aria-checked': String(v === value), onclick: () => { for (const x of el.children) x.setAttribute('aria-checked', String(x === b)); onchange(v); } });
        if (ic) b.insertAdjacentHTML('beforeend', ic);
        b.append(h('span', { class: 'xf-sl' }, l));
        if (sub) b.append(h('small', null, sub));
        el.append(b);
      }
      el.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        const bs = [...el.children], i = bs.findIndex((b) => b.getAttribute('aria-checked') === 'true');
        const j = Math.max(0, Math.min(bs.length - 1, i + (e.key === 'ArrowRight' ? 1 : -1)));
        bs[j].click(); bs[j].focus(); e.preventDefault();
      });
      return el;
    };
    const iconBtn = (cls, html, label, onclick) => { const b = h('button', { type: 'button', class: cls, onclick }); b.innerHTML = html; if (label) b.append(h('span', null, label)); return b; };
    // ---- the page (the preview) ----
    const hint = h('span', { class: 'xf-hint' });
    const greyBtn = iconBtn('xf-ico', ICON.eye, $t('See in grey'), () => { const on = !paper.classList.contains('grey'); paper.classList.toggle('grey', on); greyBtn.classList.toggle('on', on); greyBtn.setAttribute('aria-pressed', String(on)); });
    greyBtn.setAttribute('aria-pressed', 'false');
    const loupeBtn = iconBtn('xf-ico', ICON.loupe, $t('Loupe'), () => { const on = !loupeBtn.classList.contains('on'); loupeBtn.classList.toggle('on', on); loupeBtn.setAttribute('aria-pressed', String(on)); stage.classList.toggle('loupe-on', on); if (!on) loupe.hidden = true; });
    loupeBtn.setAttribute('aria-pressed', 'false');
    const figImg = h('img', { class: 'xf-fig', alt: $t('The figure at its printed size') });
    const capImg = h('img', { class: 'xf-capimg', alt: $t('The caption, typeset') });
    const capTa = h('textarea', { class: 'xf-capsrc', rows: 4, spellcheck: 'false', 'aria-label': $t('Caption (LaTeX source)') });
    const capEditTag = h('span', { class: 'xf-edit' }, $t('Click to edit · LaTeX source'));
    const regen = h('button', { type: 'button', class: 'xf-link', hidden: true, onclick: (e) => { e.stopPropagation(); capEdited = null; regen.hidden = true; showCaption(); } }, $t('Regenerate'));
    const capBox = h('div', { class: 'xf-cap', tabindex: '0', role: 'button', 'aria-label': $t('Edit the caption'), onclick: () => editCaption(), onkeydown: (e) => { if (e.key === 'Enter') { e.preventDefault(); editCaption(); } } }, capEditTag, capImg);
    const before = h('div', { class: 'xf-before' }), after = h('div', { class: 'xf-after' });
    const paper = h('div', { class: 'xf-paper' }, before, figImg, capBox, after);
    const wait = h('div', { class: 'xf-wait' }, $t('Typesetting…'));
    const scroll = h('div', { class: 'xf-scroll' }, paper, wait);
    const loupe = h('div', { class: 'xf-loupe', hidden: true });
    const stage = h('div', { class: 'xf-stage' }, h('div', { class: 'xf-bar' }, hint, h('span', { class: 'xf-sp' }), greyBtn, loupeBtn), scroll, loupe);
    const facts = h('div', { class: 'xf-facts', role: 'status' });
    // the loupe follows a mouse, and a finger or pen pressed on the paper (pointer events: a phone has no hover)
    let loupeT = 0;
    const loupeAt = (e) => {
      if (!loupeBtn.classList.contains('on') || !fig) return;
      clearTimeout(loupeT);
      const r = figImg.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { loupe.hidden = true; return; }
      const sr = stage.getBoundingClientRect(), k = 3, bw = r.width * k, bh = r.height * k;
      loupe.hidden = false;
      // a finger or pen: the lens floats 110 px above the contact, inside the stage (beside the finger, or below it,
      // when the stage has no room above), so the fingertip does not cover the spot it magnifies; a mouse: centred
      let lx = e.clientX - sr.left - stage.clientLeft, ly = e.clientY - sr.top - stage.clientTop;
      if (e.pointerType && e.pointerType !== 'mouse') {
        const sw = stage.clientWidth, sh = stage.clientHeight;
        const x0 = lx, y0 = ly, cl = (v, n) => Math.max(70, Math.min(n - 70, v)), far = () => Math.hypot(lx - x0, ly - y0) >= 90;
        lx = cl(x0, sw); ly = cl(y0 - 110, sh);
        if (!far()) { lx = cl(x0 + (x0 < sw / 2 ? 110 : -110), sw); ly = cl(y0 - 60, sh); }
        if (!far()) { lx = cl(x0, sw); ly = cl(y0 + 110, sh); }
      }
      loupe.style.left = `${lx - 70}px`; loupe.style.top = `${ly - 70}px`;
      loupe.style.backgroundImage = `url("${figImg.src}")`;
      loupe.style.backgroundSize = `${bw}px ${bh}px`;
      loupe.style.backgroundPosition = `${-(e.clientX - r.left) * k + 70}px ${-(e.clientY - r.top) * k + 70}px`;
    };
    stage.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse' || e.buttons) loupeAt(e); });
    stage.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') loupeAt(e); });
    // (a cancelled touch, when the browser takes it for a scroll, ends like a lift)
    for (const t of ['pointerup', 'pointercancel']) stage.addEventListener(t, (e) => { if (e.pointerType !== 'mouse') { clearTimeout(loupeT); loupeT = setTimeout(() => { loupe.hidden = true; }, 1600); } });
    stage.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') loupe.hidden = true; });
    // ---- the controls ----
    const sizeBtn = h('button', { type: 'button', class: 'xf-select', id: 'xfSize', 'aria-haspopup': 'menu' });
    const textSel = h('select', { class: 'xf-select xf-text', id: 'xfText', 'aria-label': $t('Text size'), onchange: () => { set.text[set.for] = +textSel.value; changed(); } }, ...[10, 11, 12].map((v) => h('option', { value: String(v) }, $t('Text {v} pt', { v }))));
    const customRow = h('div', { class: 'xf-custom', hidden: true });
    // \the\linewidth prints pt; 6.5in, 16.5cm, 165mm and bp are read too (TeX points: 72.27 per inch)
    const lenPt = (str) => { const m = /^\s*([0-9]*\.?[0-9]+)\s*(pt|in|cm|mm|bp)?\s*$/i.exec(String(str || '')); if (!m) return NaN; const u = (m[2] || 'pt').toLowerCase(); return +m[1] * { pt: 1, in: 72.27, cm: 72.27 / 2.54, mm: 72.27 / 25.4, bp: 72.27 / 72 }[u]; };
    const customInp = h('input', { type: 'text', class: 'xf-input', id: 'xfCustom', placeholder: '469.75pt', 'aria-label': $t('Paste \\the\\linewidth'), onchange: () => {
      const v = lenPt(customInp.value);
      if (v > 50 && v < 2000) { customInp.removeAttribute('aria-invalid'); set.customPt = +v.toFixed(2); set.size[sizeKey(set)] = 'custom'; changed(); }
      else { customInp.setAttribute('aria-invalid', 'true'); toast($t('Paste a width between 50 pt and 2000 pt, such as 469.75pt, 6.5in or 16.5cm.')); }
    } });
    customRow.append(h('span', null, $t('Your \\the\\linewidth')), customInp);
    const colsSeg = segB('xfCols', set.cols === 2 ? '2' : '1', [['1', $t('One column')], ['2', $t('Two column')]], (v) => { set.cols = +v; changed(); }, $t('Columns'), 'xf-cols');
    const forSeg = segB('xfFor', set.for, [['article', $t('Article'), $t('journal, arXiv'), ICON.article], ['homework', $t('Homework'), 'Overleaf, Docs', ICON.homework], ['slides', $t('Slides'), 'Beamer, Keynote', ICON.slides]], (v) => { set.for = v; changed(); }, $t('For'), 'big');
    const inkSeg = segB('xfInk', set.ink, [['colour', $t('Colour')], ['bw', $t('B/W')]], (v) => { set.ink = v; changed(); }, $t('Ink'));
    const rows = [];
    const row = (label, ...els) => { const r = h('div', { class: 'xf-row' }, h('div', { class: 'xf-h' }, label), ...els); rows.push(r); return r; };
    const sizeRow = row($t('Size'), colsSeg, h('div', { class: 'xf-pair' }, sizeBtn, textSel), customRow);
    sizeRow.classList.add('wide');
    const forRow = row($t('For'), forSeg); forRow.classList.add('wide');
    const inkRow = row($t('Ink'), inkSeg); inkRow.classList.add('wide');
    // the caption language (DESIGN.md 12): offered only when the interface is not English (the English dialog is
    // unchanged); remembered with the settings. An edited caption is dropped: it was written in the other language
    const capLangRow = uiLang() !== 'en' ? row($t('Caption'), segB('xfCapLang', set.capLang === 'en' || set.capLang === 'ru' ? set.capLang : 'ui', [['ui', $t('Interface language')], ['en', 'English'], ['ru', 'Русский']], (v) => { set.capLang = v; capEdited = null; regen.hidden = true; changed(); }, $t('Caption language'))) : null;
    if (capLangRow) capLangRow.classList.add('wide');
    const deformRow = view === 'morph' ? row($t('Deformation'), segB('xfDeform', set.deform, [['film', $t('Filmstrip')], ['paths', $t('Paths')]], (v) => { set.deform = v; changed(); }, $t('Deformation'))) : null;
    if (deformRow) deformRow.classList.add('wide');
    // Fine-tune
    const ftBody = h('div', { class: 'xf-ft', hidden: !set.fine });
    const ftBtn = h('button', { type: 'button', class: 'xf-disc', 'aria-expanded': String(!!set.fine), onclick: () => { set.fine = !set.fine; ftBody.hidden = !set.fine; ftBtn.setAttribute('aria-expanded', String(set.fine)); ftBtn.querySelector('.xf-chev').innerHTML = set.fine ? ICON.down : ICON.right; saveSet(set); } });
    ftBtn.append(h('span', { class: 'xf-chev', html: set.fine ? ICON.down : ICON.right }), h('span', null, $t('Fine-tune')), h('small', null, view === 'xy' ? $t('Crop · Axes · Panels') : view === 'land' ? $t('Crop') : $t('Crop · Axes')));
    const fr = (label, el) => h('div', { class: 'xf-fr' }, h('span', null, label), el);
    ftBody.append(fr($t('Crop'), segB('xfCrop', set.crop, [['fit', $t('Fit content')], ['screen', $t('As on screen')]], (v) => { set.crop = v; changed(); }, $t('Crop'))));
    const axesSeg = () => segB('xfAxes', set.axes[set.for] || PRESET[set.for].axes, [['box', $t('Box')], ['cross', $t('Cross')], ['none', $t('None')]], (v) => { set.axes[set.for] = v; changed(); }, $t('Axes'));
    let axesEl = axesSeg();
    const axesRow = fr($t('Axes'), axesEl);
    if (view !== 'land') ftBody.append(axesRow);
    if (view === 'xy') ftBody.append(fr($t('Panels'), segB('xfPanels', set.panels || 'both', [['both', $t('Both')], ['L', $t('X only')], ['R', $t('Y only')]], (v) => { set.panels = v; changed(); }, $t('Panels'))));
    const ctl = h('div', { class: 'xf-ctl' }, forRow, sizeRow, inkRow, ...(capLangRow ? [capLangRow] : []), ...(deformRow ? [deformRow] : []), h('div', { class: 'xf-ftwrap' }, ftBtn, ftBody));
    // ---- the footer ----
    const nameInp = h('input', { type: 'text', class: 'xf-nameinp', id: 'xfName', value: A.sceneName(), spellcheck: 'false', 'aria-label': $t('File name'), onchange: () => { changed(); }, oninput: () => fitName() });
    // the field is as wide as the name (up to 40 characters, the longest a scene name gets)
    const fitName = () => { nameInp.style.width = `${Math.min(40, Math.max(8, nameInp.value.length + 1))}ch`; };
    fitName();
    const extEl = h('span', { class: 'xf-ext' }, '.pdf');
    const moreBtn = h('button', { type: 'button', class: 'btn quiet xf-more', id: 'xfMore', 'aria-haspopup': 'menu' }, $t('More formats '), h('span', { html: ICON.down }));
    const docsBtn = h('button', { type: 'button', class: 'btn xf-dest', id: 'xfDocs' }, $t('For Docs'));
    const olBtn = h('button', { type: 'button', class: 'btn primary xf-dest', id: 'xfOverleaf' }, $t('For Overleaf'));
    const after2 = h('div', { class: 'xf-after2', hidden: true });
    const foot = h('div', { class: 'xf-foot' }, h('label', { class: 'xf-name' }, nameInp, extEl), h('span', { class: 'xf-sp' }), moreBtn, docsBtn, olBtn, after2);
    const chip = h('span', { class: 'xf-chip' }); chip.innerHTML = A.chipHTML(view);
    const m = h('div', { class: 'modal xf', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'xfTitle' },
      h('div', { class: 'xf-head' }, h('h2', { id: 'xfTitle' }, $t('Export figure')), chip, h('span', { class: 'xf-sp' }), iconBtn('icon-btn xf-x', ICON.close, null, close)),
      h('div', { class: 'xf-body' }, h('div', { class: 'xf-left' }, stage, facts), ctl), foot);
    m.querySelector('.xf-x').setAttribute('aria-label', $t('Close'));
    bg.append(m);
    document.body.append(bg);
    // ---- behaviour ----
    const sync = () => {
      colsSeg.hidden = set.for !== 'article';
      for (const b of colsSeg.children) b.setAttribute('aria-checked', String(b.dataset.v === String(set.cols)));
      const sz = sizeOf(optsOf(set));
      sizeBtn.innerHTML = '';
      sizeBtn.append(h('span', null, $t(sz.label) + ' ', h('span', { class: 'xf-dim' }, '· ' + ptTxt(+sz.pt.toFixed(2)))), h('span', { class: 'xf-caret', html: ICON.down }));
      customRow.hidden = sz.id !== 'custom';
      if (sz.id === 'custom') customInp.value = `${sz.pt}pt`;
      textSel.value = String(set.text[set.for] || (set.for === 'article' ? 10 : 11));
      const nax = axesSeg(); axesEl.replaceWith(nax); axesEl = nax;
      extEl.textContent = '.pdf';
      docsBtn.textContent = set.for === 'slides' ? $t('For Slides') : $t('For Docs');
      olBtn.textContent = set.for === 'slides' ? $t('For Beamer') : $t('For Overleaf');
      const T = TYPE[set.for][set.text[set.for] || (set.for === 'article' ? 10 : 11)];
      hint.textContent = $t('{label}, {pt} pt text · Fit column', { label: $t(sz.label), pt: set.text[set.for] || (set.for === 'article' ? 10 : 11) });
      st.T = T;
    };
    const changed = () => { saveSet(set); sync(); rebuild(); };
    sizeBtn.addEventListener('click', () => {
      const cur = sizeOf(optsOf(set)).id;
      const items = sizeList(set).map((s) => ({ label: `${s.id === cur ? '✓ ' : ''}${$t(s.label)}${s.note ? ` — ${$t(s.note)}` : ''}`, key: ptTxt(s.pt), run: () => { set.size[sizeKey(set)] = s.id; changed(); } }));
      items.push('sep', { label: `${cur === 'custom' ? '✓ ' : ''}${$t('Paste \\the\\linewidth…')}`, key: $t('exact'), run: () => { set.size[sizeKey(set)] = 'custom'; if (!set.customPt) set.customPt = sizeOf(Object.assign(optsOf(set), { sizeId: null })).pt; changed(); setTimeout(() => { customInp.focus(); customInp.select(); }, 30); } });
      A.openMenu(sizeBtn, items);
    });
    const opts = (extra) => optsOf(set, Object.assign({ name: nameInp.value || A.sceneName(), captionTex: capEdited }, extra || {}));
    const placePaper = () => {
      if (!fig) return;
      const T = st.T || [8, 9, 9];
      const wpx = fig.W * 96 / 72, margin = set.for === 'homework' ? 72 : 48;
      paper.style.width = `${wpx + 2 * margin}px`;
      paper.style.padding = `28px ${margin}px 24px`;
      // body text at the document's size: lines every 1.2 x the size
      paper.style.setProperty('--lh', `${(T[2] || 10) * 1.2 * 96 / 72 / 1.0}px`);
      const avail = Math.max(200, scroll.clientWidth - 24);
      const z = Math.min(1.05, avail / (wpx + 2 * margin));
      paper.style.zoom = String(z);
      figImg.style.width = `${wpx}px`;
      capImg.style.width = `${wpx}px`; capTa.style.width = `${wpx}px`;
    };
    const showCaption = () => {
      if (!fig) return;
      const tex = capEdited != null ? capEdited : fig.captionTex;
      if (!tex || set.for === 'slides') { capBox.hidden = true; return; }
      capBox.hidden = false;
      const T = st.T || [8, 9, 9];
      const c = captionSVG(tex, fig.W, T[2], fig.lang);
      capImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.svg);
      capImg.style.width = `${fig.W * 96 / 72}px`;
    };
    function editCaption() {
      if (!fig || capBox.classList.contains('editing')) return;
      capBox.classList.add('editing');
      capTa.value = capEdited != null ? capEdited : fig.captionTex;
      capImg.replaceWith(capTa);
      capBox.append(regen);
      capTa.focus();
      let t = 0;
      capTa.oninput = () => { clearTimeout(t); t = setTimeout(() => { capEdited = capTa.value; regen.hidden = false; }, 250); };
      capTa.onblur = () => { capEdited = capTa.value === fig.captionTex ? capEdited : capTa.value; capBox.classList.remove('editing'); capTa.replaceWith(capImg); regen.hidden = capEdited == null; showCaption(); };
      capTa.onkeydown = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); capTa.blur(); } };
    }
    const rebuild = async () => {
      const my = ++token;
      st.building = true; scroll.classList.add('busy'); wait.hidden = false;
      try {
        const f = await build(opts({ draft: true, alive: () => my === token && !closed }));
        if (my !== token || !f) return;
        fig = f; lastFig = f; st.fig = f;
        figImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(f.svg);
        before.innerHTML = set.for === 'homework' ? `<div class="xf-prob">${$t('Problem 3.')}</div>${dummy(3, 7, true)}` : dummy(4, 11, true);
        after.innerHTML = dummy(3, 5, true);
        placePaper(); showCaption();
        const T = st.T || [8, 9, 9];
        const tsz = set.text[set.for] || (set.for === 'article' ? 10 : 11);
        facts.innerHTML = '';
        // (Russian: centimetres, one decimal, GLOSSARY 3.8)
        const dims = uiLang() === 'en' || !I18 ? `${(f.W / 72).toFixed(2)} × ${(f.H / 72).toFixed(2)} in` : $t('{x} × {x2} in', { x: I18.num((f.W / 72 * 2.54).toFixed(1)), x2: I18.num((f.H / 72 * 2.54).toFixed(1)) });
        facts.append(h('b', null, dims), $t(' · labels {x}/{x2} pt, as in {tsz} pt text · {choice} · {choice2}', { x: I18 ? I18.num(T[0]) : T[0], x2: I18 ? I18.num(T[1]) : T[1], tsz, choice: f.ink === 'bw' ? $t('gray only') : $t('print color'), choice2: f.for === 'homework' ? $t('stays under its problem ([H])') : f.star ? $t('figure* across both columns') : $t('floats [tbp]') }));
      } catch (e) {
        console.error(e);
        if (my === token) { wait.hidden = false; wait.textContent = /MathJax/.test(String(e && e.message)) ? $t('The typesetter is still loading; try again in a moment.') : $t('The figure could not be made.'); }
        return;
      } finally { if (my === token) { st.building = false; scroll.classList.remove('busy'); } }
      wait.hidden = true;
    };
    // the destinations: For Overleaf copies the LaTeX first (while the click still counts as a gesture), then saves
    // the PDF; For Docs copies the PNG with its printed size and the caption in the image
    const done = (btn, text) => { const t0 = btn.textContent; btn.classList.add('done'); btn.textContent = text; setTimeout(() => { if (btn.isConnected) { btn.classList.remove('done'); btn.textContent = t0; sync(); } }, 2600); };
    const full = async (extra) => build(opts(Object.assign({ alive: () => !closed }, extra)));
    olBtn.addEventListener('click', async () => {
      if (!fig) return;
      A.copyText(latex(fig, capEdited));
      olBtn.disabled = true; olBtn.textContent = $t('Making the PDF…');
      try {
        const f = await full();
        if (!f) return;
        // (a declined or refused save: no "Saved", no hint, and it is not remembered as the last destination)
        if (await A.saveFile(`${f.name}.pdf`, await pdf(f)) === false) return;
        set.last = { kind: 'overleaf', fmt: 'pdf' }; saveSet(set);
        done(olBtn, $t('✓ Saved · LaTeX copied'));
        after2.hidden = false;
        after2.textContent = $t("First time only: drop {name}.pdf into Overleaf's file tree, then paste. {choice}", { name: f.name, choice: f.for === 'homework' ? $t('The snippet keeps the figure under your solution and shrinks it only if your page is narrower.') : $t('The snippet includes the figure at its natural size, so its labels match your text.') });
      } catch (e) { console.error(e); cueError(); toast($t('The PDF could not be made here; try More formats → SVG.')); }
      finally { olBtn.disabled = false; if (!olBtn.classList.contains('done')) sync(); }
    });
    docsBtn.addEventListener('click', async () => {
      if (!fig) return;
      docsBtn.disabled = true; docsBtn.textContent = $t('Copying…');
      try {
        const f = await full({ capInImage: set.for !== 'slides' });
        if (!f) return;
        const how = await copyImage(f);
        if (how) { set.last = { kind: 'docs', fmt: 'png' }; saveSet(set); done(docsBtn, $t('✓ Copied · paste it')); cueDone(); }
        else if (await A.saveFile(`${f.name}.png`, await png(f, 300)) !== false) { set.last = { kind: 'docs', fmt: 'png' }; saveSet(set); done(docsBtn, $t('✓ Saved PNG')); }
      } catch (e) { console.error(e); cueError(); toast($t('The image could not be copied; try More formats → PNG.')); }
      finally { docsBtn.disabled = false; if (!docsBtn.classList.contains('done')) sync(); }
    });
    const saveAs = async (fmt, dpi) => {
      try {
        const f = await full({ capInImage: fmt === 'png' && set.for === 'homework' });
        if (!f) return;
        let ok;
        if (fmt === 'pdf') ok = await A.saveFile(`${f.name}.pdf`, await pdf(f));
        else if (fmt === 'svg') ok = await A.saveFile(`${f.name}.svg`, svgBlob(f));
        else if (fmt === 'png') ok = await A.saveFile(`${f.name}.png`, await png(f, dpi || 300));
        else if (fmt === 'tex') ok = await A.saveFile(`${f.name}-latex.txt`, latex(f, capEdited));
        if (ok !== false) { set.last = { kind: 'save', fmt, dpi }; saveSet(set); }
      } catch (e) { console.error(e); cueError(); toast(fmt === 'pdf' ? $t('The PDF could not be made here; try SVG.') : $t('The figure could not be saved.')); }
    };
    moreBtn.addEventListener('click', () => {
      A.openMenu(moreBtn, [
        { label: 'PDF', key: $tx('format', 'vector'), run: () => saveAs('pdf') },
        { label: 'SVG', key: $tx('format', 'vector'), run: () => saveAs('svg') },
        { label: 'PNG · 300 dpi', key: $tx('format', 'image'), run: () => saveAs('png', 300) },
        { label: 'PNG · 600 dpi', key: $tx('format', 'image'), run: () => saveAs('png', 600) },
        'sep',
        { label: $t('Copy LaTeX only'), run: () => { if (fig) { A.copyText(latex(fig, capEdited)); set.last = { kind: 'latex' }; saveSet(set); toast($t('LaTeX copied.')); cueDone(); } } },
        { label: $t('Save LaTeX (.txt)'), run: () => saveAs('tex') },
        { label: $t('Copy image'), run: () => docsBtn.click() },
      ]);
    });
    let rz = 0;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(placePaper, 60); };
    window.addEventListener('resize', onResize);
    const obs = new MutationObserver(() => { if (!bg.isConnected) { window.removeEventListener('resize', onResize); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
    sync();
    olBtn.focus({ preventScroll: true });
    setTimeout(rebuild, 30);
    pdfLib();
  }
  // the export menu's Copy figure again / Save figure again: the last destination, with the remembered settings
  async function again(what) {
    const set = loadSet();
    const last = set.last || { kind: 'overleaf', fmt: 'pdf' };
    const f = await build(optsOf(set, { capInImage: what === 'copy' && last.kind === 'docs' }));
    if (!f) return false;
    if (what === 'copy') {
      if (last.kind === 'docs') { const how = await copyImage(f); if (!how) { if (await A.saveFile(`${f.name}.png`, await png(f, 300)) !== false) A.toast($t('Saved {name}.png (the image could not be copied here).', { name: f.name })); } else { A.toast($t('Figure copied as an image.')); cueDone(); } }
      else { await A.copyText(latex(f)); A.toast($t('Figure LaTeX copied.')); cueDone(); }
      return true;
    }
    const fmt = last.fmt || 'pdf';
    if (fmt === 'svg') await A.saveFile(`${f.name}.svg`, svgBlob(f));
    else if (fmt === 'png') await A.saveFile(`${f.name}.png`, await png(f, last.dpi || 300));
    else if (fmt === 'tex') await A.saveFile(`${f.name}-latex.txt`, latex(f));
    else await A.saveFile(`${f.name}.pdf`, await pdf(f));
    return true;
  }
  return {
    attach: (api) => { A = api; },
    build, pdf, png, svgBlob, greyProof, latex, captionSVG, copyImage, open, again,
    settings: loadSet, saveSettings: saveSet, sizes: SIZES, presets: PRESET,
    dialog: () => dlg, last: () => lastFig, segsOf, plainOf, XD,
    geom: { senseAt, chevronAt, fitBox },
  };
})();
