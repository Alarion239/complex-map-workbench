// The figure export (notes/export-design, round 2, as built: AS-BUILT.md; round 3, the deformation in every view, the
// formats PDF / PNG / SVG / Video, the displayed F and the video: ROUND3.md). A composer that sets every label in
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
    // (a displayed formula {d}: centred on a line of its own, with half a line of air above and below)
    const di = segs.findIndex((s) => s.d != null);
    if (di >= 0) {
      const a = di ? XD.caption(segs.slice(0, di), x0, y0, W, pt, color) : { markup: '', h: 0, lines: 0 };
      const it = XD.tex(`\\displaystyle ${segs[di].d.replace(/^\\displaystyle\s*/, '')}`, pt, color);
      const yb = y0 + (a.lines ? a.h + pt * 0.55 : 0) + it.a;
      const k = it.w > W ? W / it.w : 1;
      let dm = XD.at(it, x0 + (W - it.w * k) / 2, yb, 'start', 'base', 'caption');
      if (k < 1) dm = `<g transform="translate(${f2(x0 + (W - it.w * k) / 2)} ${f2(yb)}) scale(${k.toFixed(4)}) translate(${f2(-(x0 + (W - it.w * k) / 2))} ${f2(-yb)})">${dm}</g>`;
      const yAfter = yb + it.d * k + pt * 0.55;
      const rest = segs.slice(di + 1);
      const b = rest.some((s) => (s.t != null ? s.t.trim() : true)) ? XD.caption(rest, x0, yAfter - pt * 0.2, W, pt, color) : { markup: '', h: 0, lines: 0 };
      return { markup: a.markup + dm + b.markup, h: yAfter - y0 + (b.lines ? b.h : -pt * 0.55), lines: a.lines + 1 + b.lines };
    }
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
    // (export review r3, verify-new-1) TeX's line spacing: baselines 1.2 pt apart (\baselineskip), unless the depth of a
    // line and the height of the next would leave less than \lineskiplimit (0) between them; then they are \lineskip
    // (0.1 pt) apart. A tall superscript (${H^{(2)}_{s}}'$) never touches the line above
    const lh = pt * 1.2, lskip = pt * 0.1;
    const hOf = (ln) => Math.max(pt * 0.75, ...ln.flat().map((it) => it.a || 0)), dOf = (ln) => Math.max(pt * 0.3, ...ln.flat().map((it) => it.d || 0));
    let m = '', y = y0 + (lines.length ? hOf(lines[0]) : pt * 0.75), prevD = null;
    for (const ln of lines) {
      if (prevD != null) y += Math.max(lh, prevD + hOf(ln) + lskip);
      let x = x0;
      for (const wd of ln) { for (const it of wd) { m += XD.at(it, x, y, 'start', 'base', 'caption'); x += it.w; } x += sp; }
      prevD = dOf(ln);
    }
    return { markup: m, h: lines.length ? y - y0 + prevD : 0, lines: lines.length };
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
  function levelBoundary(s, win, n = 720) {
    const key = JSON.stringify([s.kind, s.expr, !!s.complement, win.x0, win.x1, win.y0, win.y1, n]);
    if (lvlCache.has(key)) return lvlCache.get(key);
    let L;
    try { L = Region.levelOf(s); } catch (e) { return []; }
    const dx = (win.x1 - win.x0) / n, dy = (win.y1 - win.y0) / n, N = n + 1, G = new Float64Array(N * N);
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
    let r = await A.art(side, { box, wpt, dpi: dpi * (extra.ss || 1), ink: printInkFor(o, A.state().alpha), T: extra.T, alive: o.alive });
    if (!r) return null;
    if (extra.ss === 2) r = await down2(r);
    const a = await XD.art(r, box, { mode: flat, wpt, fade: extra.fade });
    a.dpi = dpi; a.raw = r;
    return a;
  }
  // (export review r3, editor-20) a raster rendered at twice the resolution, averaged 2 x 2: a discontinuity of the
  // map (a branch cut) gets a smooth edge instead of pixel steps; in slices, so no task nears 50 ms
  async function down2(r) {
    const w = r.w >> 1, h = r.h >> 1, out = new Uint8Array(w * h * 3), src = r.rgb, W2 = r.w;
    await sliced(w * h, (i0, i1) => {
      for (let i = i0; i < i1; i++) {
        const y = (i / w) | 0, x = i - y * w, a = 3 * (2 * y * W2 + 2 * x), b = a + 3 * W2;
        for (let c = 0; c < 3; c++) out[3 * i + c] = (src[a + c] + src[a + 3 + c] + src[b + c] + src[b + 3 + c] + 2) >> 2;
      }
    });
    return Object.assign({}, r, { w, h, rgb: out });
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
  async function figXY(o, P, W, T, view0) {
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
        // (round 3: the art layer leaves the globe's marks out; its labels and the points' images are vectors)
        if (r.globe) {
          const c = [0, r.w, 0, r.h], k = wpt / r.w, proj = globeProj(r.globe, r, c, x, y, k);
          const Fp = side === 'R' && A.defo && A.defo().on ? A.homF(A.defo().T) : Fs[side];
          if (!(view0 === 'xyL' && st.main === 'phase')) items.push(shapes.filter((s) => kindType(s) === 'point' && s.p).map((s, q) => { const e = proj(Fp(C(s.p[0], s.p[1]))); return e ? XD.marker('dot', e[0], e[1], 1.6, o.ink === 'bw' ? '#000000' : PTS[q % 4][1], '#ffffff', 0.4) : ''; }).join(''));
          items.push(globeLabels(r.globe, r, c, x, y, k, tp - 1));
        }
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
  // (round 3: in slices, a yield once 8 ms have passed and after each level, so no task holds the page near 50 ms; the
  // same lines as before)
  async function argLevels(F, box, n, ks) {
    const G = [], V = [], dx = (box.x1 - box.x0) / n, dy = (box.y1 - box.y0) / n;
    let t0 = performance.now();
    for (let j = 0; j <= n; j++) {
      const r = new Float64Array(n + 1), v = new Array(n + 1); for (let i = 0; i <= n; i++) { const w = F(C(box.x0 + i * dx, box.y0 + j * dy)); r[i] = fin(w) ? Math.atan2(w.im, w.re) : NaN; v[i] = w; } G.push(r); V.push(v);
      if (performance.now() - t0 > 8) { await breathe(); t0 = performance.now(); }
    }
    // (export review r3, editor-20) an edge across a branch cut is not crossed by a level line: there F jumps, and its
    // midpoint value is far from the mean of the ends (a continuous F is within its second difference of it). The
    // test is made once per edge, only where a level crosses
    const cont = new Map();
    const smooth = (a, b, A0, B0) => {
      const key = a[1] === b[1] ? `h${a[1]},${Math.min(a[0], b[0])}` : `v${a[0]},${Math.min(a[1], b[1])}`;
      if (cont.has(key)) return cont.get(key);
      const wa = V[a[1]][a[0]], wb = V[b[1]][b[0]], m = F(C(box.x0 + (a[0] + b[0]) / 2 * dx, box.y0 + (a[1] + b[1]) / 2 * dy));
      const ok = !fin(m) || !fin(wa) || !fin(wb) || Math.hypot(m.re - (wa.re + wb.re) / 2, m.im - (wa.im + wb.im) / 2) <= 0.25 * Math.hypot(wa.re - wb.re, wa.im - wb.im) + 1e-12 * (Math.hypot(wa.re, wa.im) + Math.hypot(wb.re, wb.im));
      cont.set(key, ok);
      return ok;
    };
    const out = {};
    for (const k of ks) {
      await breathe();
      const th = k * Math.PI / 6, segs = [];
      const g = (v) => { let d = v - th; while (d > Math.PI) d -= 2 * Math.PI; while (d <= -Math.PI) d += 2 * Math.PI; return d; };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const c = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]].map(([a, b]) => [a, b, g(G[b][a])]);
        if (c.some((q) => !Number.isFinite(q[2]))) continue;
        const pts = [];
        for (let e = 0; e < 4; e++) {
          const P1 = c[e], P2 = c[(e + 1) % 4];
          if ((P1[2] < 0) !== (P2[2] < 0) && Math.abs(P1[2] - P2[2]) < Math.PI && smooth(P1, P2)) { const s = P1[2] / (P1[2] - P2[2]); pts.push([box.x0 + (P1[0] + s * (P2[0] - P1[0])) * dx, box.y0 + (P1[1] + s * (P2[1] - P1[1])) * dy]); }
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
    // (round 3: row by row, with a yield once 8 ms have passed)
    let t0 = performance.now();
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const f = F(C(box.x0 + (i + 0.5) / w * (box.x1 - box.x0), box.y1 - (j + 0.5) / h * (box.y1 - box.y0))), m = Math.log2(Math.hypot(f.re, f.im));
        lum[j * w + i] = Number.isFinite(m) && (Math.floor(m) & 1) === 0 ? 0xE0 : 0xFF;
      }
      if (performance.now() - t0 > 8) { await breathe(); t0 = performance.now(); }
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
    const L = await argLevels(F, box, n, ks);
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
    const cols = W >= 400 || o.for === 'slides' ? 4 : 2, rows = n / cols;
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
    let anyOpen = false;
    for (const [i, t] of ts.entries()) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + mL + col * (pw + gap), yT = row * rowH + amax + dmax + 4;
      const art = await artPanel('R', box, pw, o, { T: t });
      if (!art) return null;
      const Ht = Hof(t);
      const curves = [];
      // (export review r3, editor-9: X's boundary at t = 0 is a thin gray line; a dash means "not included", as in every
      // Homework figure)
      if (t > 0) for (const s of shapes) if (kindType(s) === 'area') curves.push({ pts: shapeCurves(s, (z) => z, box, pw, srcWin).pts, w: 0.4, color: '#999999', cap: 'butt' });
      shapes.forEach((s, si) => {
        if (kindType(s) === 'point') return;
        const tn = tonesOf(s, o), open = P.dashOpen && kindType(s) === 'area' && Region.isOpen && Region.isOpen(s);
        if (open) anyOpen = true;
        curves.push({ pts: shapeCurves(s, Ht, box, pw, srcWin).pts, w: P.lw.edge, color: o.ink === 'bw' ? '#000000' : tn.edge, dash: open ? '3 2' : null, cap: 'butt' });
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
    return { items, defs, lines, H: rows * rowH, info: { box, ts, tracked, m, labs: ts.map(fracTex), open: anyOpen } };
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
    for (const s of shapes) if (kindType(s) !== 'point') curves.push({ pts: shapeCurves(s, (z) => z, box, w, srcWin).pts, w: 0.4, color: '#999999', cap: 'butt' });
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
    // (X's outline is gray and solid here, so a dash means only "not included": export review r3, editor-9)
    for (const [a, b] of [[' (dashed outline)', ' (gray outline)'], [', with dashed outlines,', ', with gray outlines,'], [', with a dashed outline,', ', with a gray outline,']]) {
      const a2 = using(XD.lang, () => $t(a)), b2 = using(XD.lang, () => $t(b));
      cap = cap.split(a2).join(b2);
    }
    if (!P.dashOpen) cap = cap.replace(/\s*Dashed boundaries do not belong to the sets\./, '');
    if (!P.dashOpen && XD.lang !== 'en') { const d = using(XD.lang, () => $t('Dashed boundaries do not belong to the sets.')); cap = cap.split(' ' + d).join('').split(d).join(''); }
    return { items, defs: p.defs, lines: p.lines, H: top + h + bottom, info: { box, kept: kept.length, m }, captionTex: cap };
  }
  // ---------- (5) The deformation in every view (round 3, ROUND3.md): Phase, Landscape and the globes ----------
  // the deformation's kind in a view: 'plane' (X -> Y on the plane), 'deriv' (the merged plane over a d/dz step),
  // 'globe' (X -> Y on the Riemann sphere), 'phase' (the portrait of H_t), 'phaseGlobe' (on the sphere), 'land' (the
  // relief of H_t); null without the deformation. The paths figure exists where the app draws paths: plane, globe
  const defoOf = (view) => {
    const d = A && A.defo ? A.defo() : null;
    if (!d || !d.on) return null;
    if (view === 'morph') return 'plane';
    if (view === 'xyR') return d.rGlobe ? 'globe' : 'deriv';
    if (view === 'phase') return 'phase';
    if (view === 'xyL' && d.main === 'phase') return 'phaseGlobe';
    if (view === 'land') return 'land';
    return null;
  };
  const PATHS_OK = new Set(['plane', 'globe']);
  // the frames' times: n frames from 0 to m, and their labels (thirds when m is whole)
  const filmTimes = (m, n = 4) => [...Array(n).keys()].map((i) => i * m / (n - 1));
  const fracTexOf = (m) => (t) => { const q = t / m * 3; if (m === 1) return ['0', '1/3', '2/3', '1'][Math.round(q)] || (XD.lang === 'ru' && I18 ? I18.texNum(CX.fmtNum(t, 2), 'ru') : CX.fmtNum(t, 2)); return Math.abs(t - Math.round(t)) < 1e-9 ? String(Math.round(t)) : `${Math.round(t * 3)}/3`; };
  const frameTitle = (i, lab, lp) => XD.tex(XD.lang === 'ru' ? `\\textit{${RU_LETTERS[i]}}\\enspace t=${lab}` : `\\text{(${String.fromCharCode(97 + i)})}\\enspace t=${lab}`, lp);
  // the non-white bounds of a raster {w, h, rgb} (px): [i0, i1, j0, j1], or null
  const inkBounds = (r, thr = 246) => {
    let i0 = r.w, i1 = -1, j0 = r.h, j1 = -1;
    for (let j = 0; j < r.h; j++) for (let i = 0; i < r.w; i++) { const q = 3 * (j * r.w + i); if (r.rgb[q] < thr || r.rgb[q + 1] < thr || r.rgb[q + 2] < thr) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
    return i1 < 0 ? null : [i0, i1, j0, j1];
  };
  // the same, in slices of rows with a yield once 8 ms have passed (a 300 dpi frame is 1-2 Mpx: no task near 50 ms)
  const inkBoundsA = async (r, thr = 246) => {
    let i0 = r.w, i1 = -1, j0 = r.h, j1 = -1, t0 = performance.now();
    for (let j = 0; j < r.h; j++) {
      for (let i = 0; i < r.w; i++) { const q = 3 * (j * r.w + i); if (r.rgb[q] < thr || r.rgb[q + 1] < thr || r.rgb[q + 2] < thr) { if (i < i0) i0 = i; if (i > i1) i1 = i; if (j < j0) j0 = j; if (j > j1) j1 = j; } }
      if (performance.now() - t0 > 8) { await breathe(); t0 = performance.now(); }
    }
    return i1 < 0 ? null : [i0, i1, j0, j1];
  };
  const cropRGB = (r, c) => {
    const [c0, c1, d0, d1] = c, cw = c1 - c0, ch = d1 - d0, rgb = new Uint8Array(cw * ch * 3);
    for (let j = 0; j < ch; j++) rgb.set(r.rgb.subarray(3 * ((j + d0) * r.w + c0), 3 * ((j + d0) * r.w + c0 + cw)), 3 * j * cw);
    return { w: cw, h: ch, rgb };
  };
  // a globe's marks as vectors (the art layer leaves them out): w -> [x, y] in pt on the placed image, null on the far
  // side. g: the render's camera {MVP, eye, w, h}; r: the raster; c: its crop [c0, c1, d0, d1]; (x, y, k): the image's
  // corner and pt per raster px
  const globeProj = (g, r, c, x, y, k) => {
    if (!g || typeof GLR === 'undefined' || !GLR.M4 || !A.lift) return () => null;
    return (w, lift = 1.01) => {
      if (!fin(w)) return null;
      const p = A.lift(w.re, w.im), tv = [g.eye[0] - p[0], g.eye[1] - p[1], g.eye[2] - p[2]], l = Math.hypot(...tv) || 1;
      if ((tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / l <= 0.02) return null;
      const q = GLR.M4.apply(g.MVP, p.map((v) => v * lift));
      if (q[3] <= 1e-6) return null;
      const px = (q[0] / q[3] * 0.5 + 0.5) * g.w * r.w / g.w, py = (1 - (q[1] / q[3] * 0.5 + 0.5)) * g.h * r.h / g.h;
      return [x + (px - c[0]) * k, y + (py - c[2]) * k];
    };
  };
  // the sphere's own labels (0, infinity, 1, i, -1, -i) beside the globe, where they face the camera
  function globeLabels(g, r, c, x, y, k, tp) {
    if (!g || !A.lift || typeof GLR === 'undefined') return '';
    const P = (p) => { const q = GLR.M4.apply(g.MVP, p); if (q[3] <= 1e-6) return null; return [x + ((q[0] / q[3] * 0.5 + 0.5) * r.w - c[0]) * k, y + ((1 - (q[1] / q[3] * 0.5 + 0.5)) * r.h - c[2]) * k]; };
    const face = (p) => { const tv = [g.eye[0] - p[0], g.eye[1] - p[1], g.eye[2] - p[2]]; return (tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / (Math.hypot(...tv) || 1); };
    let m = '';
    for (const [lab, p] of [['0', [0, 0, -1]], ['\\infty', [0, 0, 1]], ['1', A.lift(1, 0)], ['i', A.lift(0, 1)], ['-1', A.lift(-1, 0)], ['-i', A.lift(0, -1)]]) {
      if (face(p) < 0.3) continue;
      const q = P(p[2] === 0 && Math.abs(p[0]) + Math.abs(p[1]) > 0.5 ? [p[0] * 1.06, p[1] * 1.06, 0.1] : p.map((v) => v * 1.1));
      if (!q) continue;
      const it = XD.tex(lab, tp), b = XD.boxOf(it, q[0], q[1], 'middle', 'mid');
      if (XD.boxes.some((o2) => o2.x0 < b.x1 + 0.6 && o2.x1 > b.x0 - 0.6 && o2.y0 < b.y1 + 0.6 && o2.y1 > b.y0 - 0.6)) continue;
      m += XD.at(it, q[0], q[1], 'middle', 'mid', 'globe-label', 0.4);
    }
    return m;
  }
  // (export review r3, editor-9) an area's boundary curves (parametric) and their image under Ht on the globe, through
  // the camera (front side only), as polylines in pt
  const globeCurves = (s, srcWin) => {
    let cs = [];
    try { cs = Region.curvesOf(s, srcWin) || []; } catch (e) { cs = []; }
    // (a formula's boundary is a polyline of its level set: followed piece by piece as a curve of u in [0, 1])
    if (!cs.length && kindType(s) === 'area' && !(Region.KINDS[s.kind] && Region.KINDS[s.kind].boundary)) cs = levelBoundary(s, srcWin, 360);
    return cs.map((q) => (typeof q.f === 'function' ? q : q && q.pts && q.pts.length > 1 ? { f: (u) => { const n = q.pts.length - 1, x = Math.min(n, Math.max(0, u * n)), i = Math.min(n - 1, Math.floor(x)), a = q.pts[i], b = q.pts[i + 1], fr = x - i, A0 = a.re != null ? [a.re, a.im] : a, B0 = b.re != null ? [b.re, b.im] : b; return C(A0[0] + (B0[0] - A0[0]) * fr, A0[1] + (B0[1] - A0[1]) * fr); } } : null)).filter(Boolean);
  };
  // (dense, even steps of u: a boundary seen edge-on projects to a nearly straight run, which an adaptive sampler takes
  // for a jump; a piece ends where the curve goes behind the sphere)
  const globeEdge = (s, Ht, proj, srcWin, n = 1600) => globeCurves(s, srcWin).flatMap((cv) => {
    const out = []; let cur = [], prev = null;
    for (let i = 0; i <= n; i++) {
      let p = null; try { p = proj(Ht(cv.f(i / n))); } catch (e) { p = null; }
      if (!p || (prev && Math.hypot(p[0] - prev[0], p[1] - prev[1]) > 30)) { if (cur.length > 1) out.push(cur); cur = []; }
      if (p) cur.push(p);
      prev = p;
    }
    if (cur.length > 1) out.push(cur);
    return out;
  });
  // (export review r3, editor-18) the floor marks of a relief: Re and Im ticks along the front edges and their names,
  // through the render's camera L; toPt(ii, jj): raster px -> pt; fr: the panel {x, top, iw, ih}
  function landFloor(L, r, toPt, fr, tp, lp, tick = 2.5) {
    if (!L || !L.MVP || typeof GLR === 'undefined' || !GLR.M4) return '';
    const proj = (p) => { const q = GLR.M4.apply(L.MVP, p); if (q[3] <= 1e-6) return null; const px = (q[0] / q[3] * 0.5 + 0.5) * L.w, py = (1 - (q[1] / q[3] * 0.5 + 0.5)) * L.h; return toPt(px * r.w / L.w, py * r.h / L.h); };
    const [ax, ay] = L.aspect || [1, 1], z0 = L.floorZ, eye = L.eye || [1, 1, 1], bx = L.box;
    const sx = eye[0] < 0 ? -1 : 1, sy = eye[1] < 0 ? -1 : 1;
    const Xw = (v) => ((v - bx.x0) / (bx.x1 - bx.x0) - 0.5) * 2 * ax, Yw = (v) => ((v - bx.y0) / (bx.y1 - bx.y0) - 0.5) * 2 * ay;
    const free = (bb) => !XD.boxes.some((q) => q.x0 < bb.x1 + 1 && q.x1 > bb.x0 - 1 && q.y0 < bb.y1 + 1 && q.y1 > bb.y0 - 1) && bb.x0 > fr.x + 1 && bb.x1 < fr.x + fr.iw - 1 && bb.y0 > fr.top + 1 && bb.y1 < fr.top + fr.ih - 1;
    let tk = '', out = '';
    const edge = (vals, at, dir, name) => {
      const dec = XD.decimals(vals.step);
      let mid = null, dirm = null;
      const e0 = proj(at(vals.lo)), e1 = proj(at(vals.hi));
      if (e0 && e1) tk += `M${f2(e0[0])} ${f2(e0[1])}L${f2(e1[0])} ${f2(e1[1])}`;
      for (const v of vals.list) {
        const p = at(v), a = proj(p), b = proj([p[0] + dir[0] * 0.08, p[1] + dir[1] * 0.08, z0]);
        if (!a || !b) continue;
        const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1, u = [dx / l, dy / l];
        const it = XD.tex(XD.tickTex(v, dec), tp);
        const cx = a[0] + u[0] * (tick + 2 + Math.abs(u[0]) * it.w / 2), cy = a[1] + u[1] * (tick + 2 + Math.abs(u[1]) * (it.a + it.d) / 2);
        if (!free(XD.boxOf(it, cx, cy, 'middle', 'mid'))) continue;
        tk += `M${f2(a[0])} ${f2(a[1])}l${f2(u[0] * tick)} ${f2(u[1] * tick)}`;
        out += XD.at(it, cx, cy, 'middle', 'mid', 'tick');
        (mid = mid || []).push([cx, cy]); dirm = u;
      }
      if (mid && mid.length) {
        const q = mid[Math.floor(mid.length / 2)], it = XD.tex(name, lp), cx = q[0] + dirm[0] * (it.w / 2 + 7), cy = q[1] + dirm[1] * (lp + 2);
        if (free(XD.boxOf(it, cx, cy, 'middle', 'mid'))) out += XD.at(it, cx, cy, 'middle', 'mid', 'axis-name');
      }
    };
    const tks = (a0, a1) => { const st = niceStep(a1 - a0, 3); return { step: st, list: XD.ticks(a0, a1, st), lo: a0, hi: a1 }; };
    const v = A.panelVar('L');
    edge(tks(bx.x0, bx.x1), (t) => [Xw(t), sy * ay, z0], [0, sy], `\\operatorname{Re} ${v}`);
    edge(tks(bx.y0, bx.y1), (t) => [sx * ax, Yw(t), z0], [sx, 0], `\\operatorname{Im} ${v}`);
    return (tk ? `<path d="${tk}" stroke="#000000" stroke-width="0.5" fill="none" stroke-linecap="round"/>` : '') + out;
  }
  // a polyline set in pt as a path
  const ptPath = (segs) => segs.map((sg) => sg.map((p, i) => `${i ? 'L' : 'M'}${f2(p[0])} ${f2(p[1])}`).join('')).join('');
  // the points whose paths a globe shows: the point shapes and points of the areas' boundaries whose paths show for
  // the most part (their samples on the front side), kept apart at their ends; Hof(t) -> H_t
  function globePathPoints(shapes, srcWin, Hof, m, proj, minPt, max = 8) {
    const cands = shapes.filter((s) => kindType(s) === 'point' && s.p).map((s) => C(s.p[0], s.p[1]));
    for (const s of shapes) {
      if (kindType(s) === 'point') continue;
      let cs = []; try { cs = Region.curvesOf(s, srcWin) || []; } catch (e) { cs = []; }
      for (const cv of cs.filter((q) => typeof q.f === 'function').slice(0, 4)) for (let i = 1; i < 16; i++) { const z = cv.f(i / 16); if (fin(z)) cands.push(z); }
    }
    const kept = [];
    for (const z of cands) {
      let vis = 0;
      for (let i = 0; i <= 12; i++) if (proj(Hof(m * i / 12)(z))) vis++;
      const e = proj(Hof(m)(z));
      if (vis < 8 || !e) continue;
      if (kept.every((q) => Math.hypot(q.e[0] - e[0], q.e[1] - e[1]) >= minPt)) kept.push({ z, e });
      if (kept.length >= max) break;
    }
    return kept.map((q) => q.z);
  }
  // Globe, Phase on the sphere, Landscape: a filmstrip of the view's own picture at the frames' times, one shared crop
  async function figFilmPic(o, P, W, T, kind) {
    const [tp, lp] = T;
    const d = A.defo(), m = d.m, ts = filmTimes(m), lab = fracTexOf(m);
    const side = kind === 'globe' ? 'R' : 'L';
    const st = A.state(), ink = printInkFor(o, st.alpha);
    const cols = W >= 400 || o.for === 'slides' ? 4 : 2, rows = 4 / cols, gap = 8;
    const keyW = kind === 'phaseGlobe' && o.ink !== 'bw' ? Math.min(54, W * 0.16) : 0;
    // (export review r3, editor-9) Homework dashes an open set's boundary: on the globe the figure draws it (the art
    // layer leaves its line out)
    const shapes = A.shapes(), srcWin = expandBox(A.screenBox('L0'), 3);
    const openS = kind === 'globe' && P.dashOpen ? shapes.filter((s) => kindType(s) === 'area' && Region.isOpen && Region.isOpen(s) && globeCurves(s, srcWin).length) : [];
    const cell = (W - keyW - gap * (cols - 1)) / cols;
    // the window of the relief: as in figLand (rounded edges), the same for every frame
    let landBox = null;
    if (kind === 'land') {
      const lb = A.landBox ? A.landBox() : null;
      if (lb && [lb.x0, lb.x1, lb.y0, lb.y1].every(Number.isFinite)) { const rnd = (a0, a1) => { const s2 = niceStep(a1 - a0, 8), b0 = Math.round(a0 / s2) * s2, b1 = Math.round(a1 / s2) * s2; return b1 > b0 ? [b0, b1] : [a0, a1]; }; const [x0, x1] = rnd(lb.x0, lb.x1), [y0, y1] = rnd(lb.y0, lb.y1); landBox = { x0, x1, y0, y1 }; }
    }
    // each frame rendered at 300 ppi of its printed size (the crop is unknown yet: render the pane's picture at the cell
    // width, then crop; the crop rarely loses more than a third, so 1.5 x keeps it above 300 ppi)
    const asp = Math.min(A.paneAspect(side), kind === 'land' ? 0.8 : 1);
    const wpt = cell * 1.5, hpt = wpt * asp, raws = [];
    for (const t of ts) {
      const r = await A.art(side, { wpt, hpt, dpi: 300, ink, T: t, alive: o.alive, landBox, skipLines: openS.map((s) => s.id) });
      if (!r) return null;
      raws.push(r);
    }
    // the shared crop: the union of what is drawn, with a little air
    let c = null;
    for (const r of raws) {
      const b = await inkBoundsA(r, kind === 'land' ? 232 : 246);
      if (b) c = c ? [Math.min(c[0], b[0]), Math.max(c[1], b[1]), Math.min(c[2], b[2]), Math.max(c[3], b[3])] : b;
      // (a relief: its floor too, where the floor marks go; export review r3, editor-18)
      const L = kind === 'land' ? r.land : null;
      if (L && L.MVP && typeof GLR !== 'undefined' && GLR.M4) {
        const [ax, ay] = L.aspect || [1, 1];
        for (const [x, y] of [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]]) {
          const q = GLR.M4.apply(L.MVP, [x, y, L.floorZ]);
          if (q[3] <= 1e-6) continue;
          const i = Math.round((q[0] / q[3] * 0.5 + 0.5) * r.w), j = Math.round((1 - (q[1] / q[3] * 0.5 + 0.5)) * r.h);
          c = c ? [Math.min(c[0], i), Math.max(c[1], i), Math.min(c[2], j), Math.max(c[3], j)] : [i, i, j, j];
        }
      }
    }
    const r0 = raws[0];
    if (!c) c = [0, r0.w - 1, 0, r0.h - 1];
    c = [Math.max(0, c[0]), Math.min(r0.w - 1, c[1]), Math.max(0, c[2]), Math.min(r0.h - 1, c[3])];
    const padX = Math.round((kind === 'land' ? 0.07 : 0.03) * (c[1] - c[0])), padY = Math.round((kind === 'land' ? 0.09 : 0.03) * (c[3] - c[2]));
    c = [Math.max(0, c[0] - padX), Math.min(r0.w, c[1] + 1 + padX), Math.max(0, c[2] - padY), Math.min(r0.h, c[3] + 1 + padY)];
    const cw = c[1] - c[0], ch = c[3] - c[2];
    let pw = cell, ph = pw * ch / cw;
    const titleH = (it) => it.a + it.d + 4;
    const titles = ts.map((t, i) => frameTitle(i, lab(t), lp));
    const tH = Math.max(...titles.map(titleH));
    // (a relief with its floor is about as tall as it is wide: it may take three quarters of the width in height)
    const hmax = Math.min((W * (kind === 'land' ? 0.75 : 0.6)) / rows, (P.maxH + 2 - rows * (tH + 6)) / rows);
    if (ph > hmax) { ph = hmax; pw = ph * cw / ch; }
    const x0 = (W - keyW - (cols * pw + (cols - 1) * gap)) / 2;
    const k = pw / cw, items = [], lines = [];
    // the marked points and their paths (the globe): solid up to the frame's t, dotted after
    const Hs = new Map(), Hof = (t) => { const key = t.toFixed(6); if (!Hs.has(key)) Hs.set(key, A.homF(t)); return Hs.get(key); };
    let tracked = [];
    // (export review r3, editor-3) the point shapes are drawn wherever they face the camera; one hidden in every frame
    // is named in the caption
    const ptS = kind === 'globe' ? shapes.filter((s) => kindType(s) === 'point' && s.p) : [], ptShapes = ptS.map((s) => C(s.p[0], s.p[1]));
    const ptLab = ptS.map((s, q) => (P.named ? String.fromCharCode(65 + q) : texLabel(s, q)));
    const ptSeen = ptShapes.map(() => false), ptIn = ptShapes.map(() => []);
    const pxPt = 300 / 96 * k; // pt per CSS px of the render
    // (export review r3, verify-editor-3) a point shape whose path is not drawn is marked with the next marker shape after
    // the tracked points' (dot, square, ...), never a second kind of dot, and the caption names it by that shape
    const untracked = () => ptShapes.map((z, q) => q).filter((q) => !tracked.some((y) => y.re === ptShapes[q].re && y.im === ptShapes[q].im));
    for (const [i, t] of ts.entries()) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + col * (pw + gap), y = row * (tH + ph + 6) + tH;
      const a = await XD.art(cropRGB(raws[i], c), { x0: 0, x1: 1, y0: 0, y1: 1 }, { mode: o.ink === 'bw' ? 'grey' : 'rgb', wpt: pw });
      items.push(`<image x="${f2(x)}" y="${f2(y)}" width="${f2(pw)}" height="${f2(ph)}" preserveAspectRatio="none" xlink:href="${a.url}"/>`);
      if (kind === 'land') { items.push(`<rect x="${f2(x)}" y="${f2(y)}" width="${f2(pw)}" height="${f2(ph)}" fill="none" stroke="#000000" stroke-width="0.5"/>`); lines.push({ x0: x, y0: y, x1: x + pw, y1: y + ph, kind: 'frame' }); }
      items.push(XD.at(titles[i], x, y - 4 - titles[i].d, 'start', 'base', 'title'));
      const g = raws[i].globe;
      if (g && (kind === 'globe' || kind === 'phaseGlobe')) {
        const proj = globeProj(g, raws[i], c, x, y, k);
        if (kind === 'globe') {
          if (i === 0) tracked = globePathPoints(shapes, srcWin, Hof, m, proj, 0.18 * pw, 4);
          let pm = '';
          for (const s of openS) {
            const d2 = ptPath(globeEdge(s, Hof(t), proj, srcWin)), col = o.ink === 'bw' ? '#000000' : tonesOf(s, o).edge;
            if (d2) pm += `<path d="${d2}" fill="none" stroke="#ffffff" stroke-width="${f2(3.5 * pxPt)}" stroke-linecap="round" stroke-opacity="1"/><path d="${d2}" fill="none" stroke="${col}" stroke-width="${f2(Math.max(0.6, 1.5 * pxPt))}" stroke-dasharray="3 2"/>`;
          }
          const un = untracked();
          ptShapes.forEach((z, q) => {
            const e = proj(Hof(t)(z)), u = un.indexOf(q);
            if (e) { ptSeen[q] = true; ptIn[q].push(i); }
            if (u < 0 || !e) return;
            const mk = PTS[(tracked.length + u) % 4];
            pm += XD.marker(mk[0], e[0], e[1], 1.9, o.ink === 'bw' ? '#000000' : mk[1], '#ffffff', 0.4);
          });
          tracked.forEach((z, q) => {
            const sample = (a0, b0) => XD.sample((u) => proj(Hof(u)(z)), a0, b0, 48, 0.25);
            const col2 = o.ink === 'bw' ? '#000000' : PTS[q % 4][1];
            if (t < m) pm += `<path d="${ptPath(sample(t, m))}" fill="none" stroke="#444444" stroke-width="0.7" stroke-dasharray="0 1.8" stroke-linecap="round"/>`;
            if (t > 0) { const d2 = ptPath(sample(0, t)); pm += `<path d="${d2}" fill="none" stroke="#ffffff" stroke-width="1.4" stroke-linecap="round"/><path d="${d2}" fill="none" stroke="${col2}" stroke-width="0.6" stroke-linecap="round"/>`; }
            const e = proj(Hof(t)(z));
            if (e) pm += XD.marker(PTS[q % 4][0], e[0], e[1], 1.9, col2, '#ffffff', 0.4);
          });
          items.push(pm);
        }
        items.push(globeLabels(g, raws[i], c, x, y, k, tp - 1));
      }
    }
    if (keyW) {
      const R = keyW / 2 - 12, r0k = R * 0.55, kx = W - keyW / 2, ky = rows * (tH + ph + 6) / 2 + tH / 2, kid = `${XD.ns}-key`;
      const url = await ringKey(R, 300);
      items.push(`<clipPath id="${kid}"><path d="M${f2(kx - R)} ${f2(ky)}a${f2(R)} ${f2(R)} 0 1 0 ${f2(2 * R)} 0a${f2(R)} ${f2(R)} 0 1 0 ${f2(-2 * R)} 0ZM${f2(kx - r0k)} ${f2(ky)}a${f2(r0k)} ${f2(r0k)} 0 1 1 ${f2(2 * r0k)} 0a${f2(r0k)} ${f2(r0k)} 0 1 1 ${f2(-2 * r0k)} 0Z" clip-rule="evenodd"/></clipPath>`
        + `<image x="${f2(kx - R)}" y="${f2(ky - R)}" width="${f2(2 * R)}" height="${f2(2 * R)}" preserveAspectRatio="none" clip-path="url(#${kid})" xlink:href="${url}"/>`
        + `<circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(R)}" fill="none" stroke="#000000" stroke-width="0.5"/><circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(r0k)}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
      items.push(XD.at(XD.tex('0', tp - 1), kx + R + 1.5, ky, 'start', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\pm\\pi', tp - 1), kx - R - 1.5, ky, 'end', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\arg H_t', tp - 1), kx, ky - R - 3, 'middle', 'bottom', 'key'));
    }
    const box = kind === 'land' && raws[0].land ? raws[0].land.box : null;
    // (export review r3, editor-18) the reliefs' floor marks: Re and Im along the front edges, through each frame's camera
    if (kind === 'land') for (const [i] of ts.entries()) {
      const L = raws[i].land, col = i % cols, row = Math.floor(i / cols);
      if (!L || !L.MVP) continue;
      const x = x0 + col * (pw + gap), y = row * (tH + ph + 6) + tH;
      const cid = `${XD.ns}-lf${i}`;
      items.push(`<clipPath id="${cid}"><rect x="${f2(x)}" y="${f2(y)}" width="${f2(pw)}" height="${f2(ph)}"/></clipPath><g clip-path="url(#${cid})">${landFloor(L, raws[i], (ii, jj) => [x + (ii - c[0]) * k, y + (jj - c[2]) * k], { x, top: y, iw: pw, ih: ph }, tp - 1, lp - 1, 2)}</g>`);
    }
    // (export review r3, editor-10) Phase on the sphere: the zeros and poles a frame hides on the far side
    let hiddenZP = 0, allZP = 0;
    if (kind === 'phaseGlobe') for (const [i, t] of ts.entries()) {
      const g = raws[i].globe, proj = g ? globeProj(g, raws[i], c, 0, 0, 1) : null;
      if (!proj) continue;
      for (const r of zerosPolesIn(A.plotFAt(t), expandBox(A.screenBox('L0'), 2), 30)) { allZP++; if (!proj(r.z)) hiddenZP++; }
      await breathe();
    }
    const pts = tracked.map((z) => ({ z, own: ptShapes.some((y) => y.re === z.re && y.im === z.im) }));
    // the other point shapes: their marker and the frames where they are on the far side
    const marks = kind === 'globe' ? untracked().map((q, u) => ({ q, z: ptShapes[q], lab: ptLab[q], mk: (tracked.length + u) % 4, hiddenIn: ts.map((t, i) => i).filter((i) => !ptIn[q].includes(i)) })).filter((x) => ptSeen[x.q]) : [];
    let Hfig = rows * (tH + ph + 6) - 2;
    // (verify-editor-3) a slide has no caption: a key under the frames says what each marker is (H_t(0.8i), H_t(0))
    if (o.for === 'slides' && (tracked.length || marks.length)) {
      const ent = [...tracked.map((z, q) => ({ mk: q % 4, z })), ...marks.map((x) => ({ mk: x.mk, z: x.z }))].map((e) => ({ mk: PTS[e.mk], it: XD.tex(`H_t(${cxTex(e.z)})`, tp) }));
      const r0m = 1.9, gapE = 10, wE = ent.map((e) => 2 * r0m + 2.5 + e.it.w), tot = wE.reduce((a, b) => a + b, 0) + gapE * (ent.length - 1);
      let xe = (W - keyW - tot) / 2;
      const ye = Hfig + 4 + tp * 0.6;
      for (const [q, e] of ent.entries()) {
        items.push(XD.marker(e.mk[0], xe + r0m, ye, r0m, o.ink === 'bw' ? '#000000' : e.mk[1], '#ffffff', 0.4));
        items.push(XD.at(e.it, xe + 2 * r0m + 2.5, ye, 'start', 'mid', 'key'));
        xe += wE[q] + gapE;
      }
      Hfig = ye + tp * 0.9;
    }
    return { items, defs: '', lines, H: Hfig, info: { film: kind, ts, m, labs: ts.map(lab), tracked, pts, marks, hidden: ptShapes.map((z, q) => ({ z, lab: ptLab[q] })).filter((x, q) => !ptSeen[q]), open: openS.length > 0, outline: kind === 'phaseGlobe' && shapes.some((s) => kindType(s) !== 'point'), hiddenZP: allZP && hiddenZP / allZP > 0.5 ? hiddenZP : 0, box, land: kind === 'land' } };
  }
  // Phase: a filmstrip of the portraits of H_t over one window (colour with level lines, or B/W contours)
  async function figFilmPhase(o, P, W, T) {
    const [tp, lp] = T;
    const d = A.defo(), m = d.m, ts = filmTimes(m), lab = fracTexOf(m);
    const bw = o.ink === 'bw', scr = A.screenBox('L');
    const Fs = ts.map((t) => A.plotFAt(t));
    // the window: the zeros and poles of every frame with a margin of their spread, inside the screen window
    let box = scr, zps = Fs.map(() => []);
    if (o.crop !== 'screen') {
      let b = null;
      // (each search is bounded at 40 ms and runs in a task of its own: the page keeps its frames)
      for (const F of Fs) { for (const r of zerosPolesIn(F, scr, 40)) b = unionBox(b, { x0: r.z.re, x1: r.z.re, y0: r.z.im, y1: r.z.im }); await breathe(); }
      if (b) {
        const span = Math.max(b.x1 - b.x0, b.y1 - b.y0, 1), half = Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 + 0.5 * span, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
        box = { x0: Math.max(scr.x0, cx - half), x1: Math.min(scr.x1, cx + half), y0: Math.max(scr.y0, cy - half), y1: Math.min(scr.y1, cy + half) };
      }
    }
    const cols = W >= 400 || o.for === 'slides' ? 4 : 2, rows = 4 / cols, gap = 8;
    const dc = (A.capParts().dc) || 'enhanced', keyW = bw || dc === 'classic' || dc === 'cauchy' ? 0 : Math.min(54, W * 0.16);
    // (the window does not depend on the ink: colour and B/W show the same part of the plane; export review r3, editor-19)
    const roughW = (W - (dc === 'classic' || dc === 'cauchy' ? 0 : Math.min(54, W * 0.16)) - 30) / cols;
    const stp = stepFor(box, roughW) / 2;
    box = { x0: Math.floor(box.x0 / stp + 1e-9) * stp, x1: Math.ceil(box.x1 / stp - 1e-9) * stp, y0: Math.floor(box.y0 / stp + 1e-9) * stp, y1: Math.ceil(box.y1 / stp - 1e-9) * stp };
    const step = stepFor(box, roughW);
    zps = [];
    for (const F of Fs) { zps.push(zerosPolesIn(F, box, 40)); await breathe(); }
    const mL = tickW(box, step, tp) + 3, mR = Math.max(2, overR(box, step, tp));
    let pw = (W - keyW - mL - gap * (cols - 1) - mR) / cols, ph = pw / aspect(box);
    const titles = ts.map((t, i) => frameTitle(i, lab(t), lp));
    const tH = Math.max(...titles.map((it) => it.a + it.d + 4));
    const rowH0 = tH + tp * 1.05 + 4.2 + 2;
    const hmax = Math.min((W * 0.6) / rows, (P.maxH - rows * rowH0) / rows);
    if (ph > hmax) { ph = hmax; pw = ph * aspect(box); }
    const x0 = (W - keyW - (mL + cols * pw + (cols - 1) * gap + mR)) / 2;
    const rowH = rowH0 + ph;
    const items = [], lines = []; let defs = '';
    // level lines on a grid fine enough for the panel (bounded by the cost of F)
    const t0 = performance.now(); for (let i = 0; i < 50; i++) Fs[Fs.length - 1](C(box.x0 + i * 0.013, box.y0 + i * 0.017)); const per = (performance.now() - t0) / 50;
    // (a frame's grid costs about 25 ms of F: four of them, each in its own task)
    const n = Math.max(40, Math.min(120, Math.floor(Math.sqrt(25 / Math.max(per, 1e-4)))));
    const ownLines = !bw && (dc === 'modulus' || dc === 'grid' || dc === 'classic' || dc === 'cauchy');
    const ks = ownLines ? [] : [...Array(12).keys()].map((q) => q - 5);
    for (const [i, t] of ts.entries()) {
      const col = i % cols, row = Math.floor(i / cols);
      const x = x0 + mL + col * (pw + gap), y = row * rowH + tH;
      let art;
      if (bw) { await breathe(); art = await bandsArt(Fs[i], box, pw, 300); }
      else { art = await artPanel('L', box, pw, Object.assign({}, o, { ink: 'colour' }), { mode: 'rgb', dpi: 300, T: t, ss: 2 }); if (!art) return null; }
      if (o.alive && !o.alive()) return null;
      await breathe();
      const L = await argLevels(Fs[i], box, n, ks), curves = [];
      for (const q of ks) {
        if (bw) curves.push({ pts: L[q], w: q === 0 || q === 6 ? 0.7 : 0.35, color: '#000000', dash: q === 6 ? '3 2' : null, cap: 'butt', noObst: true });
        else curves.push({ pts: L[q], w: 0.3, color: '#1a1a1a', cap: 'butt', noObst: true });
      }
      const points = zps[i].map((r) => (r.kind === 'pole' ? { z: [r.z.re, r.z.im], kind: 'ring', r: 1.6, sw: 0.6 } : { z: [r.z.re, r.z.im], r: 1.5, fill: '#000000', stroke: '#ffffff', sw: 0.5 }));
      const p = XD.panel({ x, y, w: pw, h: ph, box, step, art: [art], curves, points, axes: 'box', ylab: col === 0 ? 'left' : 'none', xtrim: { l: col > 0, r: col < cols - 1 }, tickPt: tp, labelPt: lp, ink: '#000000', lw: { frame: 0.5, tick: 0.5 } });
      items.push(p.markup); defs += p.defs; lines.push(...p.lines);
      items.push(XD.at(titles[i], x, y - 4 - titles[i].d, 'start', 'base', 'title'));
      await breathe();
    }
    if (keyW) {
      const R = keyW / 2 - 12, r0k = R * 0.55, kx = W - keyW / 2, ky = rows * rowH / 2, kid = `${XD.ns}-key`;
      const url = await ringKey(R, 300);
      items.push(`<clipPath id="${kid}"><path d="M${f2(kx - R)} ${f2(ky)}a${f2(R)} ${f2(R)} 0 1 0 ${f2(2 * R)} 0a${f2(R)} ${f2(R)} 0 1 0 ${f2(-2 * R)} 0ZM${f2(kx - r0k)} ${f2(ky)}a${f2(r0k)} ${f2(r0k)} 0 1 1 ${f2(2 * r0k)} 0a${f2(r0k)} ${f2(r0k)} 0 1 1 ${f2(-2 * r0k)} 0Z" clip-rule="evenodd"/></clipPath>`
        + `<image x="${f2(kx - R)}" y="${f2(ky - R)}" width="${f2(2 * R)}" height="${f2(2 * R)}" preserveAspectRatio="none" clip-path="url(#${kid})" xlink:href="${url}"/>`
        + `<circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(R)}" fill="none" stroke="#000000" stroke-width="0.5"/><circle cx="${f2(kx)}" cy="${f2(ky)}" r="${f2(r0k)}" fill="none" stroke="#000000" stroke-width="0.5"/>`);
      items.push(XD.at(XD.tex('0', tp - 1), kx + R + 1.5, ky, 'start', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\pm\\pi', tp - 1), kx - R - 1.5, ky, 'end', 'mid', 'key'));
      items.push(XD.at(XD.tex('\\arg H_t', tp - 1), kx, ky - R - 3, 'middle', 'bottom', 'key'));
    }
    return { items, defs, lines, H: rows * rowH, info: { film: 'phase', ts, m, labs: ts.map(lab), box, bw, zp: zps, dc } };
  }
  // zeros and poles with a time bound of their own
  function zerosPolesIn(F, box, ms) {
    if (typeof Calc === 'undefined' || !Calc.zerosPoles) return [];
    try { return (Calc.zerosPoles(F, box, { target: null, max: 24, budget: 120000, grid: 24, deadline: performance.now() + ms }) || []).filter((r) => r && r.z && fin(r.z)); } catch (e) { return []; }
  }
  // the paths figure on the globe: H_t at t = end on the sphere over X's outline (the app's gray line), and the paths
  // t -> H_t(z) of a few points (the point shapes, else points of the boundaries) with heads at F(z)
  async function figGlobePaths(o, P, W, T) {
    const [tp] = T;
    const d = A.defo(), m = d.m, st = A.state();
    const asp = Math.min(A.paneAspect('R'), 1), wpt = W * 1.2, hpt = wpt * asp;
    const shapes = A.shapes(), srcWin = expandBox(A.screenBox('L0'), 3);
    const openS = P.dashOpen ? shapes.filter((s) => kindType(s) === 'area' && Region.isOpen && Region.isOpen(s) && globeCurves(s, srcWin).length) : [];
    const r = await A.art('R', { wpt, hpt, dpi: 300, ink: printInkFor(o, st.alpha), T: m, alive: o.alive, skipLines: openS.map((s) => s.id) });
    if (!r) return null;
    let c = (await inkBoundsA(r)) || [0, r.w - 1, 0, r.h - 1];
    const pad = Math.round(0.04 * (c[1] - c[0]));
    c = [Math.max(0, c[0] - pad), Math.min(r.w, c[1] + 1 + pad), Math.max(0, c[2] - pad), Math.min(r.h, c[3] + 1 + pad)];
    const cw = c[1] - c[0], ch = c[3] - c[2];
    let iw = Math.min(W - 8, W * 0.72), ih = iw * ch / cw;
    const hmax = Math.min(W * 0.75, P.maxH - 8);
    if (ih > hmax) { ih = hmax; iw = ih * cw / ch; }
    const x = (W - iw) / 2, y = 4, k = iw / cw;
    const a = await XD.art(cropRGB(r, c), { x0: 0, x1: 1, y0: 0, y1: 1 }, { mode: o.ink === 'bw' ? 'grey' : 'rgb', wpt: iw });
    const items = [`<image x="${f2(x)}" y="${f2(y)}" width="${f2(iw)}" height="${f2(ih)}" preserveAspectRatio="none" xlink:href="${a.url}"/>`];
    const proj = globeProj(r.globe, r, c, x, y, k);
    const Hs = new Map(), Hof = (t) => { const key = t.toFixed(6); if (!Hs.has(key)) Hs.set(key, A.homF(t)); return Hs.get(key); };
    const zs = globePathPoints(shapes, srcWin, Hof, m, proj, 0.07 * iw);
    const ink = '#1a1a1a', pxPt = 300 / 96 * k;
    let g = '';
    // (export review r3, editor-9) an open set's boundary, dashed (Homework); editor-3: a point shape whose path is not
    // drawn is marked at F(z) where it faces the camera, else named as hidden
    for (const s of openS) {
      const d2 = ptPath(globeEdge(s, Hof(m), proj, srcWin)), col = o.ink === 'bw' ? '#000000' : tonesOf(s, o).edge;
      if (d2) g += `<path d="${d2}" fill="none" stroke="#ffffff" stroke-width="${f2(3.5 * pxPt)}" stroke-linecap="round"/><path d="${d2}" fill="none" stroke="${col}" stroke-width="${f2(Math.max(0.6, 1.5 * pxPt))}" stroke-dasharray="3 2"/>`;
    }
    // (verify-editor-3) a point shape without an arrow: F(z) marked with a square (then a triangle, ...), not a second
    // kind of dot (the arrows start at dots); the caption names it by that shape
    const hidden = [], marks = [];
    let pq = -1;
    for (const s of shapes) {
      if (kindType(s) !== 'point' || !s.p) continue;
      const z = C(s.p[0], s.p[1]), lab = P.named ? String.fromCharCode(65 + ++pq) : texLabel(s, ++pq);
      if (zs.some((y) => y.re === z.re && y.im === z.im)) continue;
      const e = proj(Hof(m)(z));
      if (!e) { hidden.push({ z, lab }); continue; }
      const mk = 1 + marks.length % 3;
      marks.push({ z, lab, mk });
      g += XD.marker(PTS[mk][0], e[0], e[1], 1.9, o.ink === 'bw' ? '#000000' : PTS[mk][1], '#ffffff', 0.4);
    }
    for (const z of zs) {
      const segs = XD.sample((u) => proj(Hof(u)(z)), 0, m, 64, 0.2);
      if (!segs.length) continue;
      const dd = ptPath(segs);
      g += `<path d="${dd}" fill="none" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round"/><path d="${dd}" fill="none" stroke="${ink}" stroke-width="0.6" stroke-linecap="round"/>`;
      const s0 = proj(z);
      if (s0) g += `<circle cx="${f2(s0[0])}" cy="${f2(s0[1])}" r="1.3" fill="${ink}" stroke="#ffffff" stroke-width="0.4"/>`;
      const last = segs[segs.length - 1], e = last[last.length - 1], eF = proj(Hof(m)(z));
      if (eF && Math.hypot(eF[0] - e[0], eF[1] - e[1]) < 0.5) {
        let q = last.length - 2; while (q > 0 && Math.hypot(last[q][0] - e[0], last[q][1] - e[1]) < 2) q--;
        if (q >= 0) g += XD.arrowHead(e[0], e[1], Math.atan2(e[1] - last[q][1], e[0] - last[q][0]), 4, ink);
      }
    }
    items.push(g, globeLabels(r.globe, r, c, x, y, k, tp - 1));
    return { items, defs: '', lines: [], H: y + ih + 4, info: { film: null, globePaths: true, m, kept: zs.length, pts: zs.map((z) => ({ z })), hidden, marks, open: openS.length > 0 } };
  }
  // =====================================================================================================
  // 4. Captions (journal register, en-US), the build, the LaTeX snippet
  // =====================================================================================================
  const numTex = (v) => (+v.toPrecision(3)).toString();
  // captions are built inside using(lang): $t and I18N.lang give the caption's language
  const capRu = () => !!I18 && I18.lang === 'ru';
  // ---- F's formula as a displayed equation (round 3: "it might be too complicated to fit inline") ----
  // LaTeX first sets a caption in one line (an \hbox) to see whether it fits, and display math cannot go there: the
  // display is guarded so that, in that trial, it is a gap of a full line (the caption is then set as a paragraph),
  // and in the paragraph it is \[ \displaystyle F(z) = ... \]. Every class compiles it (article, amsart, REVTeX, the
  // Homework letter, pdfLaTeX and XeLaTeX); no package is needed.
  const MAPTOK = '\u0001';
  const DISP_OPEN = '\\ifinner\\hskip\\hsize\\else\\[ ', DISP_CLOSE = ' \\]\\fi';
  const DISP_RE = /\\ifinner\\hskip\\hsize\\else\\\[\s*([\s\S]*?)\s*\\\]\\fi/;
  // a caption whose map is MAPTOK: F named in the text ($F$), its formula displayed at the end of the sentence that
  // names it first (", where \[ F(z) = ... . \]"); when that sentence is long, right after the phrase that names F
  // (see displayF); called inside using(lang)
  // (export review r3) CHAINTOK ends the sentence that names the steps f_1, f_2, ...: the display there gives the chain
  // (F(z) = ..., F = f_2 o f_1, f_1(z) = ..., f_2(w_1) = ...), so the steps the caption names are defined
  const CHAINTOK = '\u0002';
  // a literal a+bi (or a real) of the app's TeX, negated: -0.5-0.3i -> 0.5+0.3i; null when it is not one
  const negLit = (x) => {
    const m = /^(-?)(\d+(?:\.\d+)?)(?:([+-])(\d+(?:\.\d+)?)?i)?$/.exec(x.replace(/\s+/g, ''));
    if (!m) { const im = /^(-?)(\d+(?:\.\d+)?)?i$/.exec(x.replace(/\s+/g, '')); return im ? `${im[1] ? '' : '-'}${im[2] || ''}i` : null; }
    return `${m[1] ? '' : '-'}${m[2]}${m[3] ? `${m[3] === '+' ? '-' : '+'}${m[4] || ''}i` : ''}`;
  };
  // the display in normal form (export review r3, editor-16): "+ (-a)" is "- a", and a linear denominator starts
  // with its constant: \frac{z+\left(-0.5-0.3i\right)}{\left(-0.5+0.3i\right)\,z+1} -> \frac{z-\left(0.5+0.3i\right)}{1-\left(0.5-0.3i\right)\,z}
  function tidyTex(t) {
    let out = String(t || '');
    // a denominator c z + 1 -> 1 + c z
    out = out.replace(/\{\\left\(([^()]*?)\\right\)\\,([a-z](?:_\{\d+\})?)\+(\d+(?:\.\d+)?)\}/g, (m0, c, v, k) => `{${k}+\\left(${c}\\right)\\,${v}}`);
    // + (-a) -> - a (a complex literal keeps its parentheses, a real drops them)
    out = out.replace(/\+\\left\((-[^()]*?)\\right\)/g, (m0, a) => { const n = negLit(a); if (n == null || /^-/.test(n)) return m0; return /i/.test(n) && /[+-]/.test(n.slice(1)) ? `-\\left(${n}\\right)` : `-${n}`; });
    return out;
  }
  // the chain as a display: gathered lines, each in \displaystyle, packed to the caption's measure
  function chainDisplay(c, maxW, pt) {
    const F = `${c.Fname}(${c.lvar})=${tidyTex(c.raw)}`, comp = `${c.Fname}=${c.chain.map((q) => q.f).reverse().join('\\circ ')}`;
    const steps = c.chain.map((q) => `${q.f}(${q.v})=${tidyTex(q.tex)}`);
    const wOf = (x) => { try { return XD.tex(`\\displaystyle ${x}`, pt).w; } catch (e) { return 0; } };
    const gap = ',\\qquad ', lines = [];
    if (wOf(F + gap + comp) <= maxW) lines.push(F + gap + comp); else lines.push(F, comp);
    let cur = '';
    for (const q of steps) { const t2 = cur ? cur + gap + q : q; if (cur && wOf(t2) > maxW) { lines.push(cur); cur = q; } else cur = t2; }
    if (cur) lines.push(cur);
    return `\\begin{gathered}${lines.map((l) => `\\displaystyle ${l}`).join(',\\\\ ')}.\\end{gathered}`;
  }
  // the ends of the sentences of a caption: each '.' outside math before a space or the end
  const sentenceEnds = (cap) => {
    const ends = [];
    for (let q = 0, inM = false; q < cap.length; q++) { const ch = cap[q]; if (ch === '$') inM = !inM; else if (!inM && ch === '.' && (q + 1 === cap.length || /\s/.test(cap[q + 1]))) ends.push(q); }
    return ends;
  };
  // the lead-in of a display that ends the text cap[0, p): ", where", or, when the sentence already has its own "where"
  // («где», outside math: the homotopy's "..., где H'(p) = ..."), the sentence is closed and the display is "Here \[ ... \]"
  // (export review r3, verify-editor-13: never «где …, где»)
  function leadIn(cap, p) {
    const st = Math.max(0, ...sentenceEnds(cap).filter((q) => q < p).map((q) => q + 1));
    const word = $t(', where').replace(/^[\s,]+/, '').trim();
    const text = cap.slice(st, p).replace(/\$[^$]*\$/g, ' ');
    return new RegExp(`(^|[^\\p{L}])${word}(?![\\p{L}])`, 'u').test(text) ? `.${$t(' Here')}` : $t(', where');
  }
  // the first letter of a sentence made from a clause, in capitals (not inside math)
  const upperFirst = (s) => s.replace(/^(\s*)(\p{Ll})/u, (m0, sp0, ch) => sp0 + ch.toUpperCase());
  function displayF(cap, c, maxW = 300, pt = 10) {
    const iC = cap.indexOf(CHAINTOK);
    if (iC >= 0) {
      if (c.raw && c.chain) {
        const disp = `${DISP_OPEN}${chainDisplay(c, maxW, pt)}${DISP_CLOSE}`;
        return (cap.slice(0, iC) + leadIn(cap, iC) + disp + cap.slice(iC + 1 + (cap[iC + 1] === '.' ? 1 : 0))).split(MAPTOK).join(`$${c.Fname}$`);
      }
      cap = cap.split(CHAINTOK).join('');
    }
    const i = cap.indexOf(MAPTOK);
    if (i < 0) return cap;
    // the end of the sentence that names F (the next '.' outside math before a space or the end)
    const j = sentenceEnds(cap).find((q) => q > i);
    const disp = `${DISP_OPEN}\\displaystyle ${c.Fname}(${c.lvar})=${tidyTex(c.raw)}.${DISP_CLOSE}`;
    // (export review r3, verify-editor-13) the display follows the phrase that names F: at the first ':' or ';' after F
    // (outside math and brackets, within 100 characters: "Phase portrait of $F$ on $[-7,7]\times[-5,5]$: the color
    // ...", "Landscape of $F$ over ...: the height ..."), and the rest of that sentence becomes a sentence of its own;
    // else at the end of the sentence. Never a lead-in of its own ("The map is") far from F's name, and never ", where"
    // after a clause about something else ("dashed: arg F = pi, where ...")
    let k = null;
    if (j != null) for (let q = i + 1, inM = false, dep = 0; q < Math.min(j, i + 100); q++) {
      const ch = cap[q];
      if (ch === '$') inM = !inM;
      else if (!inM && '([{'.includes(ch)) dep++;
      else if (!inM && ')]}'.includes(ch)) dep--;
      else if (!inM && !dep && (ch === ':' || ch === ';')) { k = q; break; }
    }
    let out;
    if (j == null) out = cap + leadIn(cap, cap.length) + disp;
    else if (k != null) out = cap.slice(0, k) + leadIn(cap, k) + disp + ' ' + upperFirst(cap.slice(k + 1).trimStart());
    else out = cap.slice(0, j) + leadIn(cap, j) + disp + cap.slice(j + 1);
    return out.split(MAPTOK).join(`$${c.Fname}$`);
  }
  // an edited caption may hold a plain \[ ... \]: guarded as above, so it compiles
  const guardDisplays = (tex) => String(tex || '').replace(/(\\else)?\\\[([\s\S]*?)\\\](\\fi)?/g, (m0, el, body, fi) => (el ? m0 : `${DISP_OPEN}${body.trim()}${DISP_CLOSE}`));
  // the caption for the list of figures (\caption[short]{long}): the text before the display (its sentence closed),
  // else the first sentence; null when the caption has no display
  function shortCaption(tex) {
    const m = DISP_RE.exec(tex || '');
    if (!m) return null;
    // (the lead-in of the display, ", where" or ". Here", is not part of the short caption)
    let head = tex.slice(0, m.index).trimEnd();
    for (const l of [$t(', where'), $t(' Here')].map((x) => x.trim())) if (head.endsWith(l)) { head = head.slice(0, -l.length); break; }
    head = head.trim();
    if (head.length > 220) { const k = head.search(/\.\s/); if (k > 0) head = head.slice(0, k); }
    return head.replace(/[.,;:]$/, '') + '.';
  }
  // [x0,x1]x[y0,y1]; in Russian a semicolon inside a bracket pair when an endpoint is a decimal (GLOSSARY 2.3)
  // (export review r3, editor-19: one separator for the whole product, ';' in both intervals once an endpoint is a decimal)
  const winTex = (b) => { if (!b) return ''; if (!capRu()) return `[${numTex(b.x0)},${numTex(b.x1)}]\\times[${numTex(b.y0)},${numTex(b.y1)}]`; const v = [b.x0, b.x1, b.y0, b.y1].map(numTex), sep = I18.texSep(v), n = (x) => I18.texNum(x); return `[${n(v[0])}${sep}${n(v[1])}]\\times[${n(v[2])}${sep}${n(v[3])}]`; };
  const us = (segs) => segs.map((s) => (s.t != null ? { t: s.t.replace(/colour/g, 'color').replace(/Colour/g, 'Color').replace(/grey/g, 'gray').replace(/ \(bar\)/g, '') } : s));
  // a point of the plane in a Russian caption: the decimal comma (a short number formula, never a snippet)
  const cxTexL = (z) => { const s = cxTex(z); return capRu() ? s.replace(/(\d)\.(\d)/g, '$1{,}$2') : s; };
  const listTex = (zs) => zs.map((r) => `$${cxTexL(r.z)}$${(r.mult || 1) > 1 ? $t(' (order {mult})', { mult: r.mult }) : ''}`);
  const joinWords = (a) => (a.length <= 1 ? a.join('') : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')}, and ${a[a.length - 1]}`);
  // Russian: «a, b и c», with «;» between decimals («$0{,}5$; $1$ и $2$»)
  const joinL = (a) => (!capRu() ? joinWords(a) : a.length <= 1 ? a.join('') : `${a.slice(0, -1).join(a.some((x) => /\{,\}/.test(x)) ? '; ' : ', ')} и ${a[a.length - 1]}`);
  // the homotopy as a sentence (export review r3, editor-13): "Here H_t, 0 <= t <= m, deforms the identity (t = 0)
  // into F (t = m) and runs the steps in turn (...): for f_1, ...; for f_2, ..." rather than "... along the homotopy
  // H_t, ..., that runs the steps in turn"; CHAINTOK ends it when the chain is displayed. Called inside using(lang)
  function homSentence(c, map) {
    if (!c.hom) return '';
    const m = tnum(c.hom.m), tail = c.chain && c.raw ? CHAINTOK : '';
    const vals = { H: 'H_t', range: `0\\le t\\le ${c.hom.m}`, def: 'H_t=H^{(k)}_{t-k+1}', interval: 'k-1\\le t\\le k' };
    let pref = '';
    try {
      const tpl = $t('the homotopy {H}, {range}, that runs the steps in turn ({def} on {interval}): ');
      pref = A.segsTex(tpl.split(/(%?\{\w+\})/).filter(Boolean).map((q) => { const k = /^%?\{(\w+)\}$/.exec(q); return k && vals[k[1]] != null ? { m: vals[k[1]] } : { t: q }; })).trim();
    } catch (e) { pref = ''; }
    if (pref && c.hom.tex.indexOf(pref) === 0) {
      const rest = c.hom.tex.slice(pref.length).trim();
      return $t(' Here $H_t$, $0\\le t\\le %{m}$, deforms the identity ($t=0$) into %{map} ($t=%{m}$) and runs the steps in turn ($H_t=H^{(k)}_{t-k+1}$ on $k-1\\le t\\le k$): %{rest}.', { m, map, rest: rest + tail });
    }
    return $t(' Here $H_t$ deforms the identity ($t=0$) into %{map} ($t=%{m}$) along %{hom}.', { map, m, hom: c.hom.tex + tail });
  }
  // one template per sentence (Russian word order, notes/i18n/GLOSSARY.md 1.11); called inside using(lang)
  function captionFor(o, view, body) {
    const ru = capRu();
    const fi = body.info || {};
    // (export review r3, verify2-new-1: a globe figure's points on the far side are not in its list of what it shows)
    const c = A.capParts({ letters: !!PRESET[o.for].named, skip: (fi.globePaths || fi.film === 'globe') && fi.hidden && fi.hidden.length ? fi.hidden.map((x) => x.z) : null });
    // (round 3) F's formula is displayed, not inline: the caption names F (MAPTOK), and displayF sets
    // F(z) = ... as a displayed equation after the sentence that names F first
    const map = c.raw ? MAPTOK : c.mapTex ? `$${c.mapTex}$` : `$${c.Fname}$`;
    // Phase and Landscape of the deformation: the picture is H_t at the current t
    const hm = c.hm && (view === 'phase' || view === 'land' || view === 'xyL');
    if (fi.film || fi.globePaths) {
      const ts = joinL(fi.ts ? fi.ts.map((t, k) => $t('(%{letter}) $t=%{t}$', { letter: ru ? RU_LETTERS[k] : String.fromCharCode(97 + k), t: fi.labs[k] })) : []);
      const along = homSentence(c, map);
      const list = c.shapeListGen ? A.segsTex(us(c.shapeListGen)) : A.segsTex(us(c.shapeList));
      // (the points a globe figure marks are named; a listed point on the far side is said to be hidden)
      const marks = [$t('dot'), $t('square'), $t('triangle'), $t('diamond')];
      const named = (fi.pts || []).map((q, k) => `$${cxTexL(q.z)}$ (${marks[k % 4]})`);
      const hp = (h2) => `$${h2.lab ? `${h2.lab}=` : ''}${cxTexL(h2.z)}$`;
      const hidden = (fi.hidden || []).length ? (fi.hidden.length === 1 ? $t(' The point %{p} is on the far side of the sphere and is not shown.', { p: hp(fi.hidden[0]) }) : $t(' The points %{list} are on the far side of the sphere and are not shown.', { list: joinL(fi.hidden.map(hp)) })) : '';
      const dashed = fi.open ? $t(' Dashed: boundary not included.') : '';
      const plainN = (fi.pts || []).map((q) => `$${cxTexL(q.z)}$`);
      // (export review r3, verify-editor-3) the other point shapes, named by their marker; the frames where one is on the
      // far side ((a) and (d))
      const fl = (i) => (ru ? `\\textit{${RU_LETTERS[i]}}` : `(${String.fromCharCode(97 + i)})`);
      const markS = (fi.marks || []).map((x) => (fi.globePaths ? $t(' The %{mark} is the image of the point %{p} under $%{F}$.', { mark: marks[x.mk], p: hp(x), F: c.Fname })
        : x.hiddenIn && x.hiddenIn.length ? $t(' The %{mark} is the image of the point %{p}; in %{frames} it is on the far side of the sphere.', { mark: marks[x.mk], p: hp(x), frames: joinL(x.hiddenIn.map(fl)) })
          : $t(' The %{mark} is the image of the point %{p}.', { mark: marks[x.mk], p: hp(x) }))).join('');
      // (verify-editor-13) the sentence that names F is short, so its display follows it at once ("..., where \[ F(z) = ... \]")
      if (fi.globePaths) return $t('The deformation $H_t$ on the Riemann sphere, with $\\infty$ at the north pole, from the identity ($t=0$) to %{map} ($t=%{m}$). The figure shows the image of %{list} under $%{F}$ over its boundary at $t=0$ (gray).', { list, map, m: tnum(fi.m), F: c.Fname }) + (plainN.length === 1 ? $t(' The arrow is the path $t\\mapsto H_t(z)$ of the point %{p}, from $z$ (dot) to $%{F}(z)$.', { p: plainN[0], F: c.Fname }) : plainN.length ? $t(' Arrows are the paths $t\\mapsto H_t(z)$ of the points %{list}, from $z$ (dot) to $%{F}(z)$.', { list: joinL(plainN), F: c.Fname }) : '') + markS + hidden + dashed;
      if (fi.film === 'globe') return $t('The deformation $H_t$ on the Riemann sphere, with $\\infty$ at the north pole, from the identity ($t=0$) to %{map} ($t=%{m}$). At %{ts}, the frames show the image of %{list} under $H_t$.', { map, m: tnum(fi.m), ts, list }) + (named.length === 1 ? $t(" Solid: the path $t\\mapsto H_t(z)$ of the point %{p} up to the frame's $t$; dotted: the rest of the path; gray: the boundary at $t=0$.", { p: named[0] }) : named.length ? $t(" Solid: the paths $t\\mapsto H_t(z)$ of the points %{list} up to the frame's $t$; dotted: the rest of each path; gray: the boundary at $t=0$.", { list: joinL(named) }) : $t(' Gray: the boundary at $t=0$.')) + markS + hidden + dashed;
      if (fi.film === 'phaseGlobe') return $t('Phase portraits of $H_t$ on the Riemann sphere, with $\\infty$ at the north pole, at %{ts}: the color shows $\\arg H_t$ (key at right).', { ts }) + (fi.outline ? $t(' Black: the boundary of $X$.') : '') + along;
      if (fi.film === 'land') {
        const ht = { log: '\\log|H_t|', abs: '|H_t|', re: '\\operatorname{Re} H_t', im: '\\operatorname{Im} H_t' }[c.height || 'log'];
        let s2 = $t('Landscapes of $H_t$%{over} at %{ts}: the height is $%{ht}$', { over: fi.box ? $t(' over $%{box}$', { box: winTex(fi.box) }) : '', ts, ht });
        if (c.phase && o.ink !== 'bw') s2 += $t(' and the color shows $\\arg %{f}$', { f: 'H_t' });
        s2 += c.height === 'log' || c.height === 'abs' || !c.height ? $t('; zeros are pits and poles are peaks.') : '.';
        return s2 + along;
      }
      if (fi.film === 'phase') {
        const f = 'H_t', dc = fi.dc || 'enhanced', lv = $t('the thin lines are the level sets $\\arg %{f}\\in\\frac{\\pi}{6}\\mathbb{Z}$', { f });
        let s2 = $t('Phase portraits of $H_t$ on $%{box}$ at %{ts}', { box: winTex(fi.box), ts });
        if (fi.bw) s2 += $t(', drawn as level sets of $\\arg %{f}$ at multiples of $\\pi/6$; heavy: $\\arg %{f}=0$, dashed: $\\arg %{f}=\\pi$. Bands: $\\lfloor\\log_2|%{f}|\\rfloor$ even (gray) or odd (white).', { f });
        else if (dc === 'classic') s2 += $t(': brightness increases with $|%{f}|$, so zeros are black and poles white.', { f });
        else if (dc === 'modulus') s2 += $t(': the color shows $\\arg %{f}$ (key at right); the lines are level curves of $|%{f}|$ and of $\\arg %{f}$.', { f });
        else if (dc === 'grid') s2 += $t(': the color shows $\\arg %{f}$ (key at right); the lines are the preimages of the coordinate lines of the image plane.', { f });
        else if (dc === 'phase') s2 += $t(': the color shows $\\arg %{f}$ (key at right) and %{lv}.', { f, lv });
        else if (dc === 'cauchy') s2 += '.';
        else { const n = c.sectors || 12; s2 += $t(': the color shows $\\arg %{f}$ (key at right), %{lv}, and the shading steps in $|%{f}|$ by factors of $e^{2\\pi/%{n}}\\approx %{x}$; the white line is $|%{f}|=1$.', { f, lv, n, x: tnum(+Math.exp(2 * Math.PI / n).toFixed(2)) }); }
        if (fi.zp && fi.zp.some((z) => z.length)) s2 += $t(' Zeros are dots and poles are open circles.');
        return s2 + along;
      }
    }
    const homDef = () => (hm && c.hom ? $t(' Shown at $t=%{t}$.', { t: tnum(c.hom.T.toFixed(2)) }) + homSentence(c, map) : '');
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
      // (the paths figure keeps the morph figure's own caption: its inline F(z) = ... is displayed as everywhere)
      if (body.captionTex) {
        let cap = c.raw && c.mapTex ? body.captionTex.split(`$${c.mapTex}$`).join(MAPTOK) : body.captionTex;
        // (the steps it names are defined in the display that ends the homotopy's sentence: export review r3, editor-1)
        const hi = c.chain && c.raw && c.hom ? cap.indexOf(c.hom.tex) : -1;
        if (hi >= 0) cap = cap.slice(0, hi + c.hom.tex.length) + CHAINTOK + cap.slice(hi + c.hom.tex.length);
        return cap;
      }
      const i = body.info, ts = i.ts.map((t, k) => $t('(%{letter}) $t=%{t}$', { letter: ru ? RU_LETTERS[k] : String.fromCharCode(97 + k), t: i.labs[k] }));
      let s = $t('The deformation $H_t$ from the identity ($t=0$) to %{map} ($t=%{m}$), at %{ts}.', { map, m: tnum(i.m), ts: joinL(ts) });
      s += i.tracked.length ? $t(" Solid: the paths $t\\mapsto H_t(z)$ of the marked points up to the frame's $t$; dotted: the rest of each path; gray: the boundary at $t=0$.") : $t(' Gray: the boundary at $t=0$.');
      if (i.open) s += $t(' Dashed: boundary not included.');
      return s;
    }
    // the shape list in the genitive («образ круга»): the app gives it as shapeListGen; English has one form
    const genOf = () => (c.shapeListGen ? A.segsTex(us(c.shapeListGen)) : A.segsTex(us(c.shapeList)));
    // one merged panel: the deformation H_t (on the globe, or over a d/dz step), or Phase on the Riemann sphere
    const g = A.state();
    if (view === 'xyR' && c.hom) {
      const list0 = A.segsTex(us(c.shapeList));
      return $t('The deformation $H_t$%{choice}%{choice2}', {
        choice: g.rGlobe ? $t(' on the Riemann sphere, with $\\infty$ at the north pole') : '',
        choice2: list0 ? $t(': the image of %{list0} under $H_t$.', { list0: genOf() }) : '.' }) + $t(' Shown at $t=%{t}$.', { t: tnum(c.hom.T.toFixed(2)) }) + homSentence(c, map);
    }
    if (view === 'xyL' && g.main === 'phase') return $t('Phase portrait of %{choice} on the Riemann sphere, with $\\infty$ at the north pole: the color shows $\\arg %{choice2}$.%{homDef}', { choice: c.hm ? '$H_t$' : map, choice2: c.hm ? 'H_t' : c.Fname, homDef: homDef() });
    // X -> Y
    const i = body.info, two = i.panels.length === 2;
    const list = A.segsTex(us(c.shapeList));
    const cap1 = list ? list.charAt(0).toUpperCase() + list.slice(1) : '';
    const many = c.nShapes > 1, lvar = c.lvar;
    if (o.for === 'homework' || o.for === 'slides') {
      if (o.for === 'slides') return '';
      const wmap = c.raw ? MAPTOK : c.formula ? `$${A.panelVar('R')}=${c.formula}$` : map;
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
    // (a displayed formula, guarded or plain \[ ... \]: a segment {d} of its own)
    const parts = String(tex || '').split(/(\\ifinner\\hskip\\hsize\\else\\\[[\s\S]*?\\\]\\fi|\\\[[\s\S]*?\\\])/);
    for (const pt of parts) {
      const dm = /^(?:\\ifinner\\hskip\\hsize\\else)?\\\[([\s\S]*?)\\\](?:\\fi)?$/.exec(pt);
      if (dm) { out.push({ d: dm[1].trim() }); continue; }
      for (const part of pt.split(/(\$[^$]*\$)/)) segOne(part);
    }
    return out;
    function segOne(part) {
      if (!part) return;
      if (part[0] === '$' && part.length > 1 && part[part.length - 1] === '$') { out.push({ m: part.slice(1, -1) }); return; }
      for (const q of part.split(ru ? /(\\textbf\{[^}]*\}|\\textit\{[^}]*\})/ : /(\\textbf\{[^}]*\})/)) {
        if (!q) continue;
        const b = /^\\textbf\{([^}]*)\}$/.exec(q), it = ru ? /^\\textit\{([^}]*)\}$/.exec(q) : null;
        const un = (s) => s.replace(/---/g, '—').replace(/--/g, '–').replace(/\\"o/g, 'ö').replace(/\\"u/g, 'ü').replace(/\\"a/g, 'ä').replace(/\\([#$%&_{}])/g, '$1').replace(/~/g, ru ? ' ' : ' ').replace(/``|''/g, '"');
        out.push(b ? { b: un(b[1]) } : it ? { i: un(it[1]) } : { t: un(q) });
      }
    }
  }
  const plainOf = (tex, lang) => segsOf(tex, lang).map((s) => (s.d != null ? ` ${plainMath(s.d.replace(/\\displaystyle\s*/g, ''))} ` : s.m != null ? plainMath(s.m) : s.b != null ? s.b : s.i != null ? s.i : s.t)).join('').replace(/ {2,}/g, ' ');
  const plainMath = (m) => m.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)').replace(/\\(operatorname|mathrm|text)\{([^}]*)\}/g, '$2').replace(/\\[a-zA-Z]+/g, (m) => ({ '\\pi': 'π', '\\infty': '∞', '\\arg': 'arg', '\\log': 'log', '\\times': '×', '\\mapsto': '↦', '\\in': '∈', '\\le': '≤', '\\pm': '±' }[m] || '')).replace(/[{}]/g, '');
  const defaults = () => ({ for: 'article', cols: 1, sizeId: null, text: null, ink: 'colour', crop: 'fit', axes: null, panels: 'both', deform: 'film' });
  // (export review r3, editor-2) the default file name and \label: the scene, the view and the kind of figure, so two
  // different figures never share a file or a label (strip-to-disk-phase-film, strip-to-disk-globe-paths, ...); the
  // name stays the same for the same figure, so a new export replaces only its own file
  function defaultName(view, deform, fmt) {
    // (the app's scene name ends with the tag of the view on screen: the base is the scene alone)
    const sn = (A && A.sceneName()) || 'figure', suf = { phase: '-phase', land: '-landscape', morph: '-deformation' }[A.viewKind()];
    const base = suf && sn.endsWith(suf) ? sn.slice(0, -suf.length) : sn;
    const defo = defoOf(view), tag = { plane: 'deformation', deriv: 'deformation', globe: 'globe', phase: 'phase', phaseGlobe: 'phase-sphere', land: 'landscape' }[defo];
    if (fmt === 'video') return defo ? `${base}-${tag}-video` : base;
    if (defo) return `${base}-${tag}-${deform === 'paths' && PATHS_OK.has(defo) ? 'paths' : deform === 'frame' && defo !== 'plane' ? 'frame' : 'film'}`;
    if (view === 'phase') return `${base}-phase`;
    if (view === 'land') return `${base}-landscape`;
    if (view === 'xyL' && A.state().main === 'phase') return `${base}-phase-sphere`;
    return base;
  }
  // (export review r3, editor-4) the list-of-figures entry of a caption with a display: a template of its own, under
  // about 100 characters; null: the text before the display (shortCaption). Called inside using(lang)
  function shortFor(view, body) {
    const fi = body.info || {}, c = A.capParts(), ts = fi.labs ? `$t=${fi.labs.join(',\\,')}$` : '';
    const at = c.hom ? `$t=${tnum(c.hom.T.toFixed(2))}$` : '';
    if (fi.globePaths) return $t('Paths of the deformation $H_t$ on the Riemann sphere.');
    if (fi.film === 'globe') return $t('The deformation $H_t$ on the Riemann sphere at %{ts}.', { ts });
    if (fi.film === 'phaseGlobe') return $t('Phase portraits of $H_t$ on the Riemann sphere at %{ts}.', { ts });
    if (fi.film === 'land') return $t('Landscapes of $H_t$ at %{ts}.', { ts });
    if (fi.film === 'phase') return $t('Phase portraits of $H_t$ at %{ts}.', { ts });
    if (view === 'morph') return fi.labs ? $t('The deformation $H_t$ at %{ts}.', { ts }) : $t('Paths of the deformation $H_t$.');
    if (view === 'xyR' && c.hom) return A.state().rGlobe ? $t('The deformation $H_t$ on the Riemann sphere at %{ts}.', { ts: at }) : $t('The deformation $H_t$ at %{ts}.', { ts: at });
    if (c.hm && c.hom && view === 'phase') return $t('Phase portrait of $H_t$ at %{ts}.', { ts: at });
    if (c.hm && c.hom && view === 'land') return $t('Landscape of $H_t$ at %{ts}.', { ts: at });
    if (c.hm && c.hom && view === 'xyL') return $t('Phase portrait of $H_t$ on the Riemann sphere at %{ts}.', { ts: at });
    if (view === 'phase') return $t('Phase portrait of $%{F}$.', { F: c.Fname });
    if (view === 'land') return $t('Landscape of $%{F}$.', { F: c.Fname });
    return $t('The image under $%{F}$.', { F: c.Fname });
  }
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
    const name = (o.name || defaultName(view, o.deform) || 'figure').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'figure';
    // the caption language: o.lang ('en' | 'ru'), else the interface's
    const lang = o.lang === 'en' || o.lang === 'ru' ? o.lang : uiLang();
    XD.begin(name, lang);
    const t0 = performance.now();
    let body;
    // (round 3) the deformation is exported as a deformation in every view: the filmstrip, the paths (plane, globe),
    // or the frame at the current t (o.deform 'frame', the earlier one-panel figure)
    const defo = defoOf(view);
    if (defo && defo !== 'plane' && o.deform !== 'frame') body = null;
    else if (view === 'phase') body = await figPhase(o, P, W, T);
    else if (view === 'land') body = await figLand(o, P, W, T);
    if (body) { /* made */ }
    else if (view === 'morph') body = o.deform === 'paths' ? await figPaths(o, P, W, T) : await figFilm(o, P, W, T);
    else if (defo && o.deform !== 'frame') body = defo === 'globe' && o.deform === 'paths' ? await figGlobePaths(o, P, W, T) : defo === 'phase' ? await figFilmPhase(o, P, W, T) : defo === 'deriv' ? await figFilm(o, P, W, T) : await figFilmPic(o, P, W, T, defo);
    else body = await figXY(view === 'xyL' || view === 'xyR' ? Object.assign({}, o, { panels: view === 'xyL' ? 'L' : 'R' }) : o, P, W, T, view);
    if (!body || (o.alive && !o.alive())) return null;
    const autoCap = polish(using(lang, () => displayF(captionFor(o, view, body), A.capParts(), 0.88 * W, T[2])), lang);
    const shortCap = polish(using(lang, () => shortFor(view, body)), lang);
    const cp = using(lang, () => A.capParts()), Fn = view === 'morph' || (cp.hm && (view === 'phase' || view === 'land')) ? 'H_t' : cp.Fname;
    const film = view === 'morph' || (body.info && (body.info.film || body.info.globePaths));
    // (export review r3, editor-14) a slide names F: in its title when the formula is short, else displayed under the figure
    const slideF = cp.raw ? `${cp.Fname}(${cp.lvar})=${tidyTex(cp.raw)}` : null, slideFin = !!slideF && slideF.length <= 48;
    const slideTitle = polish(using(lang, () => (film ? (slideFin ? $t('The deformation $H_t$ to $%{F}$', { F: slideF }) : $t('The deformation $H_t$')) : view === 'phase' ? $t('Phase portrait of $%{Fn}$', { Fn }) : view === 'land' ? $t('Landscape of $%{Fn}$', { Fn }) : view === 'morph' ? $t('The deformation $H_t$') : cp.mapTex && cp.mapTex.length < 60 ? $t('The map $%{mapTex}$', { mapTex: cp.mapTex }) : $t('The map $%{Fn}$', { Fn }))), lang);
    const captionTex = o.captionTex != null ? o.captionTex : autoCap;
    let H = body.H;
    const items = body.items.slice();
    if (o.capInImage && captionTex) {
      await warmCaption(captionTex, T[2], lang);
      if (o.alive && !o.alive()) return null;
      const c = XD.caption([{ b: using(lang, () => $t('Figure 1.')) }, { t: ' ' }, ...segsOf(captionTex, lang)], 0, H + 7, W, T[2]);
      items.push(c.markup); H += 7 + c.h + 2;
    }
    const meta = { app: 'Complex Map Workbench', name, preset: o.for, ink: o.ink, view, width: `${Wtex}pt`, scene: A.sceneMeta() };
    const fig = XD.svg({ W, H, items, defs: body.defs, lines: body.lines, meta });
    return Object.assign(fig, { name, captionTex, autoCaption: autoCap, shortCap, slideTitle, slideF: slideF && !(film ? slideFin : cp.mapTex && cp.mapTex.length < 60) ? polish(slideF, lang) : null, view, for: o.for, Wtex, size, T, star: !!size.star, cols: o.cols, ink: o.ink, ms: Math.round(performance.now() - t0), info: body.info, opts: o, lang });
  }
  // the caption typeset alone, as LaTeX would set it under the figure ("Figure 1." in bold), for the paper preview
  // (round 3) a caption's words typeset ahead, in slices with a yield once 8 ms have passed: the cache then serves
  // captionSVG and the image's own caption at once (a long caption is a hundred MathJax calls, 30-50 ms in one task)
  async function warmCaption(tex, pt, lang) {
    const segs = [{ b: using(lang, () => $t('Figure 1.')) }, ...segsOf(tex, lang)], items = [];
    for (const s of segs) {
      if (s.d != null) { items.push(`\\displaystyle ${s.d.replace(/^\\displaystyle\s*/, '')}`); continue; }
      if (s.m != null) { items.push(s.m); continue; }
      const text = s.b != null ? s.b : s.i != null ? s.i : s.t;
      for (const p of String(text).split(lang === 'ru' ? /([ \t\r\n]+)/ : /(\s+)/)) {
        if (!p || (lang === 'ru' ? /^[ \t\r\n]+$/.test(p) : /^\s+$/.test(p))) continue;
        const esc = p.replace(/\\/g, '').replace(/([#$%&_{}])/g, '\\$1');
        items.push(s.b != null ? `\\textbf{${esc}}` : s.i != null ? `\\textit{${esc}}` : `\\text{${esc}}`);
      }
    }
    let t0 = performance.now();
    for (const it of items) {
      const keep = XD.lang;
      XD.lang = lang || 'en';
      try { XD.tex(it, pt); } finally { XD.lang = keep; }
      if (performance.now() - t0 > 8) { await breathe(); t0 = performance.now(); }
    }
  }
  function captionSVG(tex, Wbp, pt, lang) {
    const keep = { name: XD.name, ns: XD.ns, glyphs: XD.glyphs, boxes: XD.boxes, lang: XD.lang };
    try {
      XD.begin('caption', lang || 'en');
      const c = XD.caption([{ b: using(lang, () => $t('Figure 1.')) }, { t: ' ' }, ...segsOf(tex, lang)], 0, 0, Wbp, pt);
      return XD.svg({ W: Wbp, H: c.h + pt * 0.3, items: [c.markup] });
    } finally { Object.assign(XD, keep); }
  }
  const layoutOf = (fig) => (fig.for === 'homework' ? '\\linewidth' : fig.star ? '\\textwidth' : fig.cols === 2 ? '\\columnwidth' : '\\linewidth');
  // the snippet for a format: 'pdf' (natural size), 'png' (an explicit width: a raster has no size of its own that every
  // engine reads), 'svg' (\includesvg: the svg package runs Inkscape). F's displayed formula keeps the list of figures
  // working through \caption[short]{long}
  const latex = (fig, captionTex, fmt = 'pdf', dpi = 300) => using(fig.lang, () => latexIn(fig, captionTex, fmt, dpi));
  function latexIn(fig, captionTex, fmt = 'pdf', dpi = 300) {
    const cap0 = guardDisplays(captionTex != null ? captionTex : fig.captionTex);
    const n = fig.name, w = +fig.Wtex.toFixed(2), size = $t(fig.size.label).replace(/^[А-ЯЁ]/, (c) => c.toLowerCase());
    const engMain = fig.lang === 'ru' ? [$t('% English main document: \\usepackage[T2A,T1]{fontenc}\\usepackage[russian,english]{babel}')] : [];
    const ru = (t) => (fig.lang === 'ru' && t ? `\\foreignlanguage{russian}{${t}}` : t);
    const sc0 = shortCaption(cap0), sc = sc0 && fig.shortCap && (fig.view !== 'xy' || sc0.length > 100) ? fig.shortCap : sc0, cap = ru(cap0);
    // (the short caption in braces: a window [a,b] x [c,d] in it would end the optional argument early)
    const capLine = sc ? `  \\caption[{${ru(sc)}}]{${cap}}` : `  \\caption{${cap}}`;
    const ext = fmt === 'png' ? '.png' : fmt === 'svg' ? '.svg' : '.pdf';
    const file = `${n}${ext}`;
    const shrink = `\\ifdim\\linewidth<${w}pt \\linewidth\\else ${w}pt\\fi`;
    const inc = (width) => (fmt === 'svg' ? `  \\includesvg[width=${width}]{${n}}` : fmt === 'png' ? `  \\includegraphics[width=${width}]{${file}}` : width ? `  \\includegraphics[width=${width}]{${n}}` : `  \\includegraphics{${n}}`);
    const pre = (more) => (fmt === 'svg' ? $t('% Preamble: \\usepackage{graphicx,amsmath,amssymb,svg%{more}} (svg runs Inkscape: compile with --shell-escape; Overleaf does both)', { more }) : $t('% Preamble: \\usepackage{graphicx,amsmath,amssymb%{more}}', { more }));
    const upload = fmt === 'pdf' ? [] : [fmt === 'png' ? $t('% Upload %{file} (PNG, %{dpi} dpi) next to your .tex file (Overleaf: the file tree).', { file, dpi }) : $t('% Upload %{file} next to your .tex file (Overleaf: the file tree).', { file })];
    if (fig.for === 'homework') return [
      $t('% %{n}.pdf is made for \\linewidth = %{w}pt (%{size}); natural size wherever it fits, shrunk only on a narrower page.', { n, w, size }).replace(`${n}.pdf`, file),
      ...upload,
      pre(',float'),
      ...engMain,
      '\\begin{figure}[H]',
      '  \\centering',
      inc(shrink),
      capLine,
      `  \\label{fig:${n}}`,
      '\\end{figure}', ''].join('\n');
    if (fig.for === 'slides') return [
      $t('% %{n}.pdf is made for \\textwidth = %{w}pt (%{size}); shrunk only on a narrower frame. Preamble: \\usepackage{graphicx}', { n, w, size }).replace(`${n}.pdf`, file),
      ...upload,
      ...(fmt === 'svg' ? [pre('')] : []),
      // (a Russian title too sits in \\foreignlanguage: an English-main document sets it in T2A)
      `\\begin{frame}{${fig.slideTitle ? ru(fig.slideTitle) : n}}`,
      '  \\centering',
      inc(shrink),
      ...(fig.slideF ? [`  \\[ \\displaystyle ${fig.slideF} \\]`] : []),
      '\\end{frame}', ''].join('\n');
    const L = layoutOf(fig), env = fig.star ? 'figure*' : 'figure';
    return [
      $t('% %{n}.pdf is made for %{L} = %{w}pt (%{size}); include it unscaled so its labels match your text.', { n, L, w, size }).replace(`${n}.pdf`, file),
      ...upload,
      fmt === 'pdf' ? $t('% If your %{L} is narrower, use [width=%{L}] (the labels will shrink). Preamble: \\usepackage{graphicx,amsmath,amssymb}', { L }) : pre(''),
      ...engMain,
      `\\begin{${env}}[tbp]`,
      '  \\centering',
      inc(fmt === 'pdf' ? null : shrink),
      capLine,
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
  // 6. Video of the deformation (round 3): every frame rendered exactly off-screen (never a screen capture), encoded
  // with WebCodecs as H.264 in our own MP4 muxer, else VP9 in our own WebM muxer; one frame per task, so the page
  // keeps its frames while a video is made
  // =====================================================================================================
  const VIDEO_SIZES = { '1920x1080': [1920, 1080], '1280x720': [1280, 720], '1080x1080': [1080, 1080] };
  // (export review r3, editor-5) win: 'screen' (the screen's window, the default) or 'fit' (the window the motion needs)
  // (export review r3, verify-editor-7) secs is the length of ONE step (the Length menu says "3 s per step"): a chain of
  // five steps is not rushed, a single map takes that long
  const VSECS = [2, 3, 4, 6];
  const vdefaults = () => ({ size: '1920x1080', fps: 30, secs: 3, ends: 'once', paths: true, tlabel: true, look: 'light', win: 'screen' });
  // the frames' times (export review r3, editor-7, a lecture's pace): each step eased on its own (t = k + ease(u)) over
  // secs seconds, a hold of 0.6 s at every whole t inside, holds of 1.2 s at both ends. Bounce: there and back.
  // Loop: three runs, each followed by a 0.5 s cross-fade from t = m back to t = 0 (the last one too, so a player's loop
  // does not jump). An entry is a time, or {a, b, k}: the frame at a faded into the frame at b by k
  function videoTimes(v, m) {
    const fps = v.fps === 60 ? 60 : 30, nSteps = m >= 1 && Math.abs(m - Math.round(m)) < 1e-9 ? Math.round(m) : 1;
    const per = Math.max(2, Math.round((v.secs || 3) * fps)), mid = Math.round(0.6 * fps), end = Math.round(1.2 * fps);
    const ease = (u) => u * u * (3 - 2 * u), hold = (t, n) => Array(n).fill(t);
    const run = [0];
    for (let k = 0; k < nSteps; k++) {
      for (let i = 1; i <= per; i++) run.push((k + ease(i / per)) * m / nSteps);
      if (k < nSteps - 1) run.push(...hold((k + 1) * m / nSteps, mid));
    }
    if (v.ends === 'bounce') return [...hold(0, end), ...run, ...hold(m, end), ...run.slice().reverse().slice(1), ...hold(0, end)];
    const one = [...hold(0, end), ...run, ...hold(m, end)];
    if (v.ends === 'loop') { const nf = Math.round(0.5 * fps), fade = [...Array(nf).keys()].map((i) => ({ a: m, b: 0, k: (i + 1) / nf })); return [...one, ...fade, ...one, ...fade, ...one, ...fade]; }
    return one;
  }
  const tOf = (e) => (typeof e === 'number' ? e : null);
  // the window of a plane kind at the video's aspect: the screen's (As on screen), else the union of what the frames
  // draw (Fit the motion; Phase: its zeros and poles)
  async function videoBox(side, kind, asp, m, o, v) {
    const scr = A.screenBox(side);
    let cb = null;
    if (v.win === 'fit') {
      if (kind === 'phase') {
        for (const t of [0, m / 3, 2 * m / 3, m]) { for (const r of zerosPolesIn(A.plotFAt(t), scr, 40)) cb = unionBox(cb, { x0: r.z.re, x1: r.z.re, y0: r.z.im, y1: r.z.im }); await breathe(); }
        if (cb) { const sp = Math.max(cb.x1 - cb.x0, cb.y1 - cb.y0, 1); cb = { x0: cb.x0 - 0.6 * sp, x1: cb.x1 + 0.6 * sp, y0: cb.y0 - 0.6 * sp, y1: cb.y1 + 0.6 * sp }; }
      } else {
        for (const t of [0, m / 3, 2 * m / 3, m]) {
          const q = await A.art(side, { box: scr, wpt: 120, dpi: 72, ink: printInkFor(o, A.state().alpha), T: t, alive: o.alive });
          if (!q) return null;
          cb = unionBox(cb, contentBox(q, scr));
        }
        if (cb) { const px = 0.08 * (cb.x1 - cb.x0), py = 0.08 * (cb.y1 - cb.y0); cb = { x0: Math.max(scr.x0, cb.x0 - px), x1: Math.min(scr.x1, cb.x1 + px), y0: Math.max(scr.y0, cb.y0 - py), y1: Math.min(scr.y1, cb.y1 + py) }; }
      }
    }
    // (As on screen: the screen's window, widened to the frame's aspect, so all of it shows)
    const b = cb || scr, cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2;
    let w = b.x1 - b.x0, h = b.y1 - b.y0;
    if (w / h > asp) h = w / asp; else w = h * asp;
    return { x0: cx - w / 2, x1: cx + w / 2, y0: cy - h / 2, y1: cy + h / 2 };
  }
  // (export review r3, verify-editor-8) the sphere's labels in a video: 0, infinity, 1, i, -1, -i wherever their point
  // faces the camera (n.v > 0.05), at full ink (the screen fades them near the rim, which left infinity nearly white);
  // poles just beyond the globe, equator points just above |z| = 1, as on screen. g: the render's camera; returns
  // {lab, u, v} in fractions of the pane
  const GLOBE_LABS = [['0', [0, 0, -1]], ['∞', [0, 0, 1]], ['1', null, 1, 0], ['i', null, 0, 1], ['−1', null, -1, 0], ['−i', null, 0, -1]];
  function globeLabelSpots(g) {
    if (!g || !A.lift || typeof GLR === 'undefined' || !GLR.M4) return [];
    const out = [];
    for (const [lab, p0, re, im] of GLOBE_LABS) {
      const p = p0 || A.lift(re, im), tv = [g.eye[0] - p[0], g.eye[1] - p[1], g.eye[2] - p[2]];
      if ((tv[0] * p[0] + tv[1] * p[1] + tv[2] * p[2]) / (Math.hypot(...tv) || 1) <= 0.05) continue;
      const q = GLR.M4.apply(g.MVP, p[2] === 0 && Math.abs(p[0]) + Math.abs(p[1]) > 0.5 ? [p[0] * 1.06, p[1] * 1.06, 0.1] : p.map((v) => v * 1.1));
      if (q[3] <= 1e-6) continue;
      out.push({ lab, u: q[0] / q[3] * 0.5 + 0.5, v: 1 - (q[1] / q[3] * 0.5 + 0.5) });
    }
    return out;
  }
  // (export review r3, video-11, editor-8) a globe or a relief fills the frame: the union of what four frames draw,
  // widened to the frame's aspect, as a crop [u0, u1, v0, v1] of the pane's picture (fractions), at most 1.6 x zoom
  async function videoCrop(side, plan, o) {
    const { W, H, m } = plan;
    let c = null;
    const w0 = 240, h0 = w0 * H / W;
    for (const t of [0, m / 3, 2 * m / 3, m]) {
      const r = await A.art(side, { wpt: w0, hpt: h0, dpi: 72, ink: printInkFor(o, A.state().alpha), T: t, alive: o.alive, landBox: plan.landBox });
      if (!r) return null;
      const b = inkBounds(r, plan.kind === 'land' ? 232 : 246), add = (f) => { c = c ? [Math.min(c[0], f[0]), Math.max(c[1], f[1]), Math.min(c[2], f[2]), Math.max(c[3], f[3])] : f; };
      if (b) add([b[0] / r.w, (b[1] + 1) / r.w, b[2] / r.h, (b[3] + 1) / r.h]);
      // (verify-editor-8) the globe's labels, with their size (about 3 % of H, infinity 4 %) and air: never cut by the edge
      if (plan.kind === 'globe' || plan.kind === 'phaseGlobe') for (const q of globeLabelSpots(r.globe)) add([q.u - 0.04 * H / W, q.u + 0.04 * H / W, q.v - 0.04, q.v + 0.04]);
      // (the relief's floor, where the light look prints its grid and labels: its corners through the camera, with air)
      const L = r.land;
      if (L && L.MVP && typeof GLR !== 'undefined' && GLR.M4) {
        const [ax, ay] = L.aspect || [1, 1];
        for (const [x, y] of [[-ax, -ay], [ax, -ay], [ax, ay], [-ax, ay]]) { const q = GLR.M4.apply(L.MVP, [x * 1.12, y * 1.12, L.floorZ]); if (q[3] > 1e-6) { const u = q[0] / q[3] * 0.5 + 0.5, w = 1 - (q[1] / q[3] * 0.5 + 0.5); add([u, u, w, w]); } }
      }
    }
    if (!c) return [0, 1, 0, 1];
    const pad = 0.04, cx = (c[0] + c[1]) / 2, cy = (c[2] + c[3]) / 2;
    let s = Math.max(c[1] - c[0], c[3] - c[2]) + 2 * pad;
    s = Math.min(1, Math.max(1 / 1.6, s));
    const u0 = Math.min(1 - s, Math.max(0, cx - s / 2)), v0 = Math.min(1 - s, Math.max(0, cy - s / 2));
    return [u0, u0 + s, v0, v0 + s];
  }
  // the plan of a video: what is drawn, where, the tracked points
  async function videoPlan(opts) {
    const o = Object.assign(defaults(), opts || {}), v = Object.assign(vdefaults(), o.video || {});
    const view = o.view || A.viewKind(), kind = defoOf(view);
    if (!kind) throw new Error('The deformation is off');
    const [Wpx, Hpx] = VIDEO_SIZES[v.size] || VIDEO_SIZES['1920x1080'];
    const d = A.defo(), m = d.m;
    const side = kind === 'plane' || kind === 'deriv' || kind === 'globe' ? 'R' : 'L';
    const pic = kind === 'globe' || kind === 'phaseGlobe' || kind === 'land';
    // (the screen's line widths at a retina scale; a globe or a relief: the art layer's own labels at about 3 % of the
    // frame's height, export review r3, editor-8)
    const dpr = pic ? Math.max(1.5, Hpx / 360) : Math.max(1, Math.min(Wpx, Hpx) / 720);
    const plan = { o, v, kind, side, W: Wpx, H: Hpx, dpr, m, pic, times: videoTimes(v, m), name: (o.name || defaultName(view, null, 'video') || 'deformation').replace(/[^A-Za-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'deformation' };
    if (o.trace) plan.trace = o.trace;
    if (kind === 'land') {
      const lb = A.landBox ? A.landBox() : null;
      if (lb && [lb.x0, lb.x1, lb.y0, lb.y1].every(Number.isFinite)) plan.landBox = lb;
    }
    if (!pic) { plan.box = await videoBox(side, kind, Wpx / Hpx, m, o, v); if (!plan.box) return null; }
    else { plan.crop = await videoCrop(side, plan, o); if (!plan.crop) return null; }
    // the marked points: the point shapes, else three points of the first boundary (as the filmstrip)
    const shapes = A.shapes(), srcWin = expandBox(A.screenBox('L0'), 3);
    let tracked = shapes.filter((s) => kindType(s) === 'point' && s.p).slice(0, 4).map((s) => C(s.p[0], s.p[1]));
    if (!tracked.length && (kind === 'plane' || kind === 'globe')) {
      const a = shapes.find((s) => kindType(s) !== 'point');
      if (a) { let cs = []; try { cs = Region.curvesOf(a, srcWin) || []; } catch (e) { cs = []; } const c = cs.find((q) => typeof q.f === 'function'); if (c) tracked = [0.3, 0.5, 0.7].map((s) => c.f(s)).filter(fin); }
    }
    plan.tracked = kind === 'plane' || kind === 'globe' || kind === 'deriv' ? tracked : [];
    plan.Hs = new Map();
    plan.Hof = (t) => { const key = t.toFixed(6); if (!plan.Hs.has(key)) { if (plan.Hs.size > 400) plan.Hs.clear(); plan.Hs.set(key, A.homF(t)); } return plan.Hs.get(key); };
    // (editor-5) the screen's own paths while it shows them (X -> Y on the plane), as on screen
    const sp = kind === 'plane' && v.paths && A.screenPaths ? A.screenPaths() : null;
    plan.screen = sp ? sp.map((p) => C(p[0], p[1])) : [];
    // the paths t -> H_t(z), sampled once (97 times over [0, m]); a frame draws the part up to its t
    plan.us = [...Array(97).keys()].map((j) => j * m / 96);
    const zs = v.paths ? [...plan.tracked, ...plan.screen] : [];
    plan.paths = zs.map(() => []);
    let tq = performance.now();
    for (const u of plan.us) {
      const Hu = plan.Hof(u);
      zs.forEach((z, k) => plan.paths[k].push(Hu(z)));
      if (performance.now() - tq > 8) { await breathe(); tq = performance.now(); }
    }
    // (the print look draws the boundaries: their source curves are found once, a formula's on a 360 x 360 grid, so no
    // frame waits for them)
    plan.cs = new Map();
    if (v.look === 'print' && plan.box && kind !== 'phase') for (const s of shapes) {
      if (kindType(s) === 'point') continue;
      let cs = [];
      try { cs = Region.curvesOf(s, srcWin) || []; } catch (e) { cs = []; }
      if (!cs.length && kindType(s) === 'area' && !(Region.KINDS[s.kind] && Region.KINDS[s.kind].boundary)) cs = levelBoundary(s, srcWin, 360);
      plan.cs.set(s, cs);
      await breathe();
    }
    plan.shapes = shapes; plan.srcWin = srcWin;
    // (the frames' fonts are matched here, once: the first frame's text otherwise took 20-45 ms of its task)
    { const fc = document.createElement('canvas').getContext('2d'); for (const it of ['', 'italic ']) { fc.font = `${it}${Math.round(0.04 * Hpx)}px "Latin Modern Roman", "CMU Serif", "Times New Roman", serif`; fc.measureText('t = 0.00 −1234567890'); } }
    await breathe();
    // (editor-6) the ring key of Phase and Phase on the sphere: drawn once, kept for every frame
    if ((kind === 'phase' || kind === 'phaseGlobe') && A.hue) {
      const R = Math.round(0.07 * Hpx), n = 2 * R, kc = document.createElement('canvas'); kc.width = n; kc.height = n;
      const kx = kc.getContext('2d'), id = kx.createImageData(n, n);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const u = (i + 0.5) / n * 2 - 1, w = 1 - (j + 0.5) / n * 2, rr = Math.hypot(u, w), q = 4 * (j * n + i);
        if (rr > 1 || rr < 0.55) continue;
        const c = A.hue((Math.atan2(w, u) + Math.PI) / (2 * Math.PI));
        const a = Math.min(1, (1 - rr) * R, (rr - 0.55) * R);
        id.data[q] = c[0]; id.data[q + 1] = c[1]; id.data[q + 2] = c[2]; id.data[q + 3] = Math.round(255 * Math.max(0, a));
      }
      kx.putImageData(id, 0, 0);
      plan.key = kc;
    }
    return plan;
  }
  // the video's text: an italic letter, upright digits, on a white halo (editor-17)
  const vText = (ctx, parts, x, y, fs, align = 'left') => {
    const fam = '"Latin Modern Roman", "CMU Serif", "Times New Roman", serif';
    const fonts = parts.map(([, it, sub]) => `${it ? 'italic ' : ''}${sub ? Math.round(0.7 * fs) : fs}px ${fam}`);
    const ws = parts.map(([s], i) => { ctx.font = fonts[i]; return ctx.measureText(s).width; }), tw = ws.reduce((a, b) => a + b, 0);
    let x0 = align === 'right' ? x - tw : align === 'center' ? x - tw / 2 : x;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
    for (const pass of [0, 1]) {
      let xx = x0;
      parts.forEach(([s], i) => {
        ctx.font = fonts[i];
        const yy = parts[i][2] ? y + 0.25 * fs : y;
        if (pass === 0) { ctx.lineWidth = 0.22 * fs; ctx.strokeStyle = 'rgba(255,255,255,0.92)'; ctx.strokeText(s, xx, yy); } else { ctx.fillStyle = '#111111'; ctx.fillText(s, xx, yy); }
        xx += ws[i];
      });
    }
    return tw;
  };
  // one frame of the video at time t, drawn into the 2D context ctx (W x H device px)
  async function videoFrame(plan, t, ctx) {
    const { o, v, kind, side, W, H, dpr } = plan, st = A.state();
    const look = v.look === 'print' ? 'print' : 'light';
    const base = { dpi: 96 * dpr, T: t, alive: o.alive, raw: true, look: look === 'light' ? 'light' : null, ink: printInkFor(o, st.alpha), noGlobeLabels: kind === 'globe' || kind === 'phaseGlobe' };
    let r;
    if (plan.box) r = await A.art(side, Object.assign(base, { box: plan.box, wpt: W / dpr * 72 / 96 }));
    else {
      const [u0, u1, v0, v1] = plan.crop, zx = 1 / (u1 - u0), zy = 1 / (v1 - v0);
      r = await A.art(side, Object.assign(base, { wpt: W * zx / dpr * 72 / 96, hpt: H * zy / dpr * 72 / 96, landBox: plan.landBox }));
    }
    if (!r) return false;
    const s0 = performance.now();
    ctx.save();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
    // (a globe or a relief: the crop of the pane's picture that holds what the frames draw)
    const cr = plan.crop || [0, 1, 0, 1], sx0 = cr[0] * r.cv.width, sy0 = cr[2] * r.cv.height, sw = (cr[1] - cr[0]) * r.cv.width, sh = (cr[3] - cr[2]) * r.cv.height;
    ctx.drawImage(r.cv, sx0, sy0, sw, sh, 0, 0, W, H);
    // (the off-screen canvas is let go at once: a frame's 8 MB backing store would otherwise wait for the collector)
    r.cv.width = 1; r.cv.height = 1;
    const lw = Math.max(1, Math.min(W, H) / 720);
    // the vector marks: plane kinds in world coordinates, the globe through its camera
    let P = null;
    if (plan.box) { const b = plan.box; P = (w) => (fin(w) ? [(w.re - b.x0) / (b.x1 - b.x0) * W, (b.y1 - w.im) / (b.y1 - b.y0) * H] : null); }
    else if (kind === 'globe' && r.globe) { const pj = globeProj(r.globe, { w: W / (cr[1] - cr[0]), h: H / (cr[3] - cr[2]) }, [cr[0] * W / (cr[1] - cr[0]), 0, cr[2] * H / (cr[3] - cr[2]), 0], 0, 0, 1); P = (w) => pj(w); }
    const line = (pts, color, width, dash) => { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []); ctx.lineCap = dash ? 'butt' : 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); let pen = false; for (const p of pts) { if (!p) { pen = false; continue; } if (pen) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); pen = true; } ctx.stroke(); ctx.setLineDash([]); };
    const fs = Math.round(0.028 * H);
    // (editor-6) the print look's axes, and tick numbers in both looks: the window is fixed, so they are too
    if (plan.box) {
      const b = plan.box, step = niceStep(Math.max(b.x1 - b.x0, b.y1 - b.y0), 8), dec = XD.decimals(step);
      const ox = Math.min(Math.max(P(C(0, 0))[0], 0), W), oy = Math.min(Math.max(P(C(0, 0))[1], 0), H);
      if (look === 'print') { line([[0, oy], [W, oy]], '#555555', 1.2 * lw); line([[ox, 0], [ox, H]], '#555555', 1.2 * lw); }
      const num = (x) => { const s2 = (Math.abs(x) < 1e-12 ? 0 : x).toFixed(dec); return (I18 ? I18.num(s2) : s2).replace(/^-/, '−'); };
      for (const x of XD.ticks(b.x0, b.x1, step)) { if (Math.abs(x) < 1e-12) continue; const px = P(C(x, 0))[0]; if (px < 0.04 * W || px > 0.96 * W) continue; line([[px, oy - 4 * lw], [px, oy + 4 * lw]], '#333333', 1.2 * lw); vText(ctx, [[num(x), false]], px, Math.min(H - 0.02 * H, oy + fs * 1.15), fs, 'center'); }
      for (const y of XD.ticks(b.y0, b.y1, step)) { if (Math.abs(y) < 1e-12) continue; const py = P(C(0, y))[1]; if (py < 0.06 * H || py > 0.9 * H) continue; line([[ox - 4 * lw, py], [ox + 4 * lw, py]], '#333333', 1.2 * lw); vText(ctx, [[num(y), false]], Math.max(fs * 2.2, ox - 0.4 * fs), py + 0.35 * fs, fs, 'right'); }
    }
    // print look on a plane: the boundaries as vectors (the art layer draws fills only); X's boundary as a thin gray
    // line for t > 0; an open set's boundary dashed (a dash means "not included", editor-9)
    if (look === 'print' && plan.box && kind !== 'phase') {
      const wpt = W, Ht = plan.Hof(t);
      for (const s of plan.shapes) {
        if (kindType(s) === 'point') continue;
        const cs = plan.cs.get(s) || [];
        if (t > 0 && kindType(s) === 'area') for (const seg of mapCurves(cs, (z) => z, plan.box, wpt / 2)) line(seg.map((p) => P(C(p[0], p[1]))), '#999999', 1 * lw);
        const tn = tonesOf(s, o), open = kindType(s) === 'area' && Region.isOpen && Region.isOpen(s);
        for (const seg of mapCurves(cs, Ht, plan.box, wpt / 2)) line(seg.map((p) => P(C(p[0], p[1]))), tn.edge, 2 * lw, open ? [7 * lw, 5 * lw] : null);
      }
    }
    // the paths t -> H_t(z): the marked points (solid in their colour, a dot at H_t(z)) and the screen's paths (thin,
    // dark, a head at H_t(z)); each sampled once, drawn up to t
    if (v.paths && P && plan.paths.length) {
      const nT = plan.tracked.length;
      plan.paths.forEach((ws, k) => {
        const mine = k < nT, col = mine ? PTS[k % 4][1] : '#1a1a1a', end = plan.Hof(t)(mine ? plan.tracked[k] : plan.screen[k - nT]);
        const pts = [];
        for (let j = 0; j < plan.us.length && plan.us[j] < t; j++) pts.push(P(ws[j]));
        pts.push(P(end));
        if (t > 0 && pts.length > 1) { line(pts, '#ffffff', (mine ? 4 : 2.6) * lw); line(pts, col, (mine ? 2 : 1.1) * lw); }
        const e = P(end);
        if (!e) return;
        if (mine) { ctx.fillStyle = col; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * lw; ctx.beginPath(); ctx.arc(e[0], e[1], 5 * lw, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
        else if (t > 0) {
          let q = pts.length - 2; while (q > 0 && (!pts[q] || Math.hypot(pts[q][0] - e[0], pts[q][1] - e[1]) < 3 * lw)) q--;
          const p0 = pts[Math.max(0, q)];
          if (p0) { const th = Math.atan2(e[1] - p0[1], e[0] - p0[0]), L = 9 * lw, c2 = Math.cos(th), s2 = Math.sin(th); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(e[0], e[1]); ctx.lineTo(e[0] - L * c2 + 0.36 * L * s2, e[1] - L * s2 - 0.36 * L * c2); ctx.lineTo(e[0] - 0.72 * L * c2, e[1] - 0.72 * L * s2); ctx.lineTo(e[0] - L * c2 - 0.36 * L * s2, e[1] - L * s2 + 0.36 * L * c2); ctx.closePath(); ctx.fill(); }
        }
      });
    }
    // (export review r3, verify-editor-8) the globe's labels in both looks, drawn here (the art layer leaves its own out):
    // dark on a white halo, about 3 % of H; infinity half as large again, its glyph being only x-height tall
    if ((kind === 'globe' || kind === 'phaseGlobe') && r.globe) {
      plan.labelBoxes = [];
      for (const q of globeLabelSpots(r.globe)) {
        const x = (q.u - cr[0]) / (cr[1] - cr[0]) * W, y = (q.v - cr[2]) / (cr[3] - cr[2]) * H, inf = q.lab === '∞', f = inf ? Math.round(1.5 * fs) : fs;
        const parts = q.lab === '−i' ? [['−', false], ['i', true]] : [[q.lab, q.lab === 'i']];
        const yb = y + (inf ? 0.25 : 0.35) * f, w = vText(ctx, parts, x, yb, f, 'center');
        plan.labelBoxes.push({ lab: q.lab, x0: x - w / 2, x1: x + w / 2, y0: yb - (inf ? 0.5 : 0.72) * f, y1: yb + 0.05 * f, fs: f });
      }
    }
    // (editor-6) the ring key, top right
    if (plan.key) {
      const n = plan.key.width, x = W - n - 0.05 * H, y = 0.06 * H + fs;
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.beginPath(); ctx.arc(x + n / 2, y + n / 2, n / 2 + 0.2 * fs, 0, 2 * Math.PI); ctx.fill();
      ctx.drawImage(plan.key, x, y);
      vText(ctx, [['arg ', false], ['H', true], ['t', true, 'sub']], x + n / 2, y - 0.45 * fs, fs, 'center');
      vText(ctx, [['0', false]], x + n + 0.25 * fs, y + n / 2 + 0.35 * fs, fs, 'left');
      vText(ctx, [['±π', false]], x - 0.25 * fs, y + n / 2 + 0.35 * fs, fs, 'right');
    }
    // the t label: bottom left, an italic t and upright digits (editor-17)
    if (v.tlabel) {
      const f2s = Math.round(0.04 * H), num = I18 ? I18.num(t.toFixed(2)) : t.toFixed(2);
      vText(ctx, [['t', true], [` = ${num}`, false]], Math.round(0.035 * H), H - Math.round(0.035 * H), f2s);
    }
    ctx.restore();
    if (plan.trace) plan.trace.push(['draw', Math.round(performance.now() - s0)]);
    return true;
  }
  // ---- encoders and muxers ----
  const H264 = ['avc1.640033', 'avc1.64002A', 'avc1.640028', 'avc1.4D402A', 'avc1.4D4028', 'avc1.42E02A', 'avc1.42E028'];
  const pickCache = new Map();
  async function pickEncoder(W, H, fps, webmOnly) {
    if (typeof VideoEncoder === 'undefined') return null;
    const ck = `${W}x${H}@${fps}${webmOnly ? 'w' : ''}`;
    if (pickCache.has(ck)) return pickCache.get(ck);
    const bitrate = Math.round(Math.min(16e6, Math.max(2e6, W * H * fps * 0.12)));
    let out = null;
    // (webmOnly: the fallback on purpose, for its test)
    for (const codec of webmOnly ? [] : H264) {
      const cfg = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' }, latencyMode: 'quality' };
      try { const s = await VideoEncoder.isConfigSupported(cfg); if (s && s.supported) { out = { cfg, mux: 'mp4' }; break; } } catch (e) { /* next */ }
    }
    if (!out) for (const codec of ['vp09.00.40.08', 'vp09.00.31.08', 'vp8']) {
      const cfg = { codec, width: W, height: H, bitrate, framerate: fps, latencyMode: 'quality' };
      try { const s = await VideoEncoder.isConfigSupported(cfg); if (s && s.supported) { out = { cfg, mux: 'webm' }; break; } } catch (e) { /* next */ }
    }
    pickCache.set(ck, out);
    return out;
  }
  // MP4 (ISO BMFF): ftyp, moov (one video track, all samples in one chunk), mdat. The samples are in decode order (the
  // encoder's output order); a stream whose timestamps are not increasing (reordered frames) gets a ctts box
  // (export review r3, video-8)
  function muxMP4(chunks, desc, W, H, fps) {
    if (!desc || desc.length < 7 || desc[0] !== 1) throw new Error('The H.264 encoder gave no avcC description');
    if (chunks.length && chunks[0].data.length > 4 && chunks[0].data[0] === 0 && chunks[0].data[1] === 0 && (chunks[0].data[2] === 1 || (chunks[0].data[2] === 0 && chunks[0].data[3] === 1))) throw new Error('The H.264 encoder gave Annex B, not AVC');
    const enc = new TextEncoder();
    const u32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255], u16 = (v) => [(v >> 8) & 255, v & 255];
    const box = (type, ...parts) => { const body = parts.flat(Infinity); return [...u32(8 + body.length), ...enc.encode(type), ...body]; };
    const full = (type, ver, flags, ...parts) => box(type, ver, (flags >> 16) & 255, (flags >> 8) & 255, flags & 255, ...parts);
    const ts = fps * 1000, n = chunks.length, dur = n * 1000, ms = Math.round(n * 1000 / fps);
    // composition offsets (in 1/(fps*1000) s) when the presentation order differs from the decode order
    const step = 1e6 / fps, pos = chunks.map((c) => Math.round(c.ts / step));
    const reordered = pos.some((p, i) => p !== i);
    const ctts = reordered ? (() => { const sorted = pos.slice().sort((a, b) => a - b), offs = pos.map((p, i) => (p - i) * 1000), base = Math.min(0, ...offs); if (sorted.some((p, i) => p !== i)) throw new Error('The video has missing frames'); return full('ctts', 0, 0, u32(n), offs.map((o) => [u32(1), u32(o - base)]).flat()); })() : [];
    const matrix = [0x00010000, 0, 0, 0, 0x00010000, 0, 0, 0, 0x40000000].flatMap(u32);
    const ftyp = box('ftyp', ...enc.encode('isom'), u32(0x200), ...enc.encode('isomiso2avc1mp41'));
    const stbl = (stco) => box('stbl',
      full('stsd', 0, 0, u32(1), box('avc1', [0, 0, 0, 0, 0, 0], u16(1), u16(0), u16(0), u32(0), u32(0), u32(0), u16(W), u16(H), u32(0x00480000), u32(0x00480000), u32(0), u16(1), Array(32).fill(0), u16(0x18), u16(0xffff), box('avcC', ...desc), box('pasp', u32(1), u32(1)))),
      full('stts', 0, 0, u32(1), u32(n), u32(1000)),
      ctts,
      full('stss', 0, 0, u32(chunks.filter((c) => c.key).length), chunks.map((c, i) => (c.key ? u32(i + 1) : [])).flat()),
      full('stsc', 0, 0, u32(1), u32(1), u32(n), u32(1)),
      full('stsz', 0, 0, u32(0), u32(n), chunks.map((c) => u32(c.data.length)).flat()),
      full('stco', 0, 0, u32(1), u32(stco)));
    const moov = (stco) => box('moov',
      full('mvhd', 0, 0, u32(0), u32(0), u32(1000), u32(ms), u32(0x00010000), u16(0x0100), Array(10).fill(0), matrix, Array(24).fill(0), u32(2)),
      box('trak',
        full('tkhd', 0, 3, u32(0), u32(0), u32(1), u32(0), u32(ms), Array(8).fill(0), u16(0), u16(0), u16(0), u16(0), matrix, u32(W << 16), u32(H << 16)),
        box('mdia',
          full('mdhd', 0, 0, u32(0), u32(0), u32(ts), u32(dur), u16(0x55c4), u16(0)),
          full('hdlr', 0, 0, u32(0), ...enc.encode('vide'), Array(12).fill(0), ...enc.encode('VideoHandler'), 0),
          box('minf', full('vmhd', 0, 1, Array(8).fill(0)), box('dinf', full('dref', 0, 0, u32(1), full('url ', 0, 1))), stbl(stco)))));
    const size = chunks.reduce((a, c) => a + c.data.length, 0);
    const head = ftyp.length + moov(0).length;
    const top = new Uint8Array([...ftyp, ...moov(head + 8), ...u32(8 + size), ...enc.encode('mdat')]);
    return new Blob([top, ...chunks.map((c) => c.data)], { type: 'video/mp4' });
  }
  // WebM (Matroska): EBML header, Segment {SeekHead, Info, Tracks, a Cluster per key frame of SimpleBlocks, Cues}
  // (export review r3, video-9: the Cues index every cluster, so players and editors seek)
  function muxWebM(chunks, W, H, fps, codec) {
    const enc = new TextEncoder();
    const vint = (n) => { for (let l = 1; l <= 8; l++) if (n < 2 ** (7 * l) - 1) { const o = []; let v = n; for (let i = 0; i < l; i++) { o.unshift(v & 255); v = Math.floor(v / 256); } o[0] |= 1 << (8 - l); return o; } throw new Error('size'); };
    const idb = (id) => { const o = []; let v = id; while (v > 0) { o.unshift(v & 255); v = Math.floor(v / 256); } return o; };
    const uint = (v) => { const o = []; do { o.unshift(v & 255); v = Math.floor(v / 256); } while (v > 0); return o; };
    const u64 = (v) => { const o = []; for (let i = 0; i < 8; i++) { o.unshift(v & 255); v = Math.floor(v / 256); } return o; };
    const el = (id, data) => { const d = data instanceof Uint8Array ? data : new Uint8Array(data.flat ? data.flat(Infinity) : data); return [...idb(id), ...vint(d.length), ...d]; };
    const f64 = (v) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v); return [...b]; };
    const ms = (i) => Math.round(i * 1000 / fps);
    const ebml = el(0x1A45DFA3, [el(0x4286, uint(1)), el(0x42F7, uint(1)), el(0x42F2, uint(4)), el(0x42F3, uint(8)), el(0x4282, [...enc.encode('webm')]), el(0x4287, uint(4)), el(0x4285, uint(2))]);
    const info = el(0x1549A966, [el(0x2AD7B1, uint(1000000)), el(0x4D80, [...enc.encode('Complex Map Workbench')]), el(0x5741, [...enc.encode('Complex Map Workbench')]), el(0x4489, f64(ms(chunks.length)))]);
    const cid = /^vp8$/.test(codec) ? 'V_VP8' : 'V_VP9';
    const tracks = el(0x1654AE6B, [el(0xAE, [el(0xD7, uint(1)), el(0x73C5, uint(1)), el(0x83, uint(1)), el(0x86, [...enc.encode(cid)]), el(0x23E383, uint(Math.round(1e9 / fps))), el(0xE0, [el(0xB0, uint(W)), el(0xBA, uint(H))])])]);
    const clusters = [];
    let cur = null, c0 = 0;
    chunks.forEach((c, i) => {
      if (!cur || c.key || ms(i) - c0 > 30000) { if (cur) clusters.push({ t: cur.t, parts: cur.parts }); c0 = ms(i); cur = { t: c0, parts: [el(0xE7, uint(c0))] }; }
      const rel = ms(i) - c0, hdr = [0x81, (rel >> 8) & 255, rel & 255, c.key ? 0x80 : 0];
      cur.parts.push([...idb(0xA3), ...vint(4 + c.data.length), ...hdr]); cur.parts.push(c.data);
    });
    if (cur) clusters.push(cur);
    // the SeekHead has a fixed size (positions as 8-byte integers), so the offsets are known before it is written
    const seekEntry = (id, p) => el(0x4DBB, [el(0x53AB, idb(id)), el(0x53AC, u64(p))]);
    const seekLen = el(0x114D9B74, [seekEntry(0x1549A966, 0), seekEntry(0x1654AE6B, 0), seekEntry(0x1C53BB6B, 0)]).length;
    const cl = clusters.map((c) => { const pieces = c.parts.map((q) => (q instanceof Uint8Array ? q : new Uint8Array(q))); const len = pieces.reduce((a, q) => a + q.length, 0); return { t: c.t, head: new Uint8Array([...idb(0x1F43B675), ...vint(len)]), pieces, size: 0 }; });
    let off = seekLen + info.length + tracks.length;
    for (const c of cl) { c.pos = off; c.size = c.head.length + c.pieces.reduce((a, q) => a + q.length, 0); off += c.size; }
    const cues = el(0x1C53BB6B, cl.map((c) => el(0xBB, [el(0xB3, uint(c.t)), el(0xB7, [el(0xF7, uint(1)), el(0xF1, uint(c.pos))])])));
    const seek = el(0x114D9B74, [seekEntry(0x1549A966, seekLen), seekEntry(0x1654AE6B, seekLen + info.length), seekEntry(0x1C53BB6B, off)]);
    const body = [new Uint8Array(seek), new Uint8Array(info), new Uint8Array(tracks)];
    for (const c of cl) body.push(c.head, ...c.pieces);
    body.push(new Uint8Array(cues));
    const blen = body.reduce((a, q) => a + q.length, 0);
    return new Blob([new Uint8Array(ebml), new Uint8Array([...idb(0x18538067), ...vint(blen)]), ...body], { type: 'video/webm' });
  }
  // a wait that a hidden page does not slow to a second: the encoder's dequeue event, else a message-channel turn
  const turn = () => new Promise((r) => { const ch = new MessageChannel(); ch.port1.onmessage = () => r(); ch.port2.postMessage(0); });
  // makeVideo(opts, {progress(i, n), cancelled()}) -> {blob, ext, codec, frames, fps, secs, W, H, ms} or null (cancelled)
  // (opts.keepForCheck: the tests' videoCheck reads the last video back; nothing is kept otherwise, export review r3, video-4)
  let lastVideo = null;
  async function makeVideo(opts, cb = {}) {
    if (!A) throw new Error('Figure is not attached');
    const t0 = performance.now();
    lastVideo = null;
    // (the encoder first: a browser without one is told so before any frame is drawn, video-6)
    const v0 = Object.assign(vdefaults(), (opts && opts.video) || {}), [W0, H0] = VIDEO_SIZES[v0.size] || VIDEO_SIZES['1920x1080'];
    const fps = v0.fps === 60 ? 60 : 30;
    const pick = await pickEncoder(W0, H0, fps, !!v0.webm);
    if (!pick) throw new Error('This browser cannot encode video (no WebCodecs encoder)');
    const plan = await videoPlan(opts);
    if (!plan) return null;
    // (tests: opts.trace collects the time of each frame's steps, ms: frame, draw, enc, configure)
    if (opts && opts.trace) plan.trace = opts.trace;
    const { W, H } = plan;
    const chunks = [];
    let desc = null, err = null;
    const encoder = new VideoEncoder({
      output: (ch, meta) => { const d = new Uint8Array(ch.byteLength); ch.copyTo(d); chunks.push({ data: d, key: ch.type === 'key', ts: ch.timestamp }); const dd = meta && meta.decoderConfig && meta.decoderConfig.description; if (dd && !desc) desc = new Uint8Array(dd.buffer ? dd.buffer.slice(dd.byteOffset, dd.byteOffset + dd.byteLength) : dd); },
      error: (e) => { err = e; },
    });
    await breathe();
    const c0 = performance.now();
    encoder.configure(pick.cfg);
    if (plan.trace) plan.trace.push(['configure', Math.round(performance.now() - c0)]);
    await breathe();
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { alpha: false });
    const times = plan.times, n = times.length, keyEvery = fps * 2;
    // (a fade blends two frames kept as pictures: t = m and t = 0)
    const kept = new Map();
    const keptAt = async (t) => { if (kept.has(t)) return kept.get(t); const c = document.createElement('canvas'); c.width = W; c.height = H; if (!(await videoFrame(plan, t, c.getContext('2d', { alpha: false })))) return null; kept.set(t, c); return c; };
    const dequeued = () => new Promise((r) => { let done = false; const f = () => { if (!done) { done = true; try { encoder.removeEventListener('dequeue', f); } catch (e) { /* none */ } r(); } }; try { encoder.addEventListener('dequeue', f); } catch (e) { /* none */ } turn().then(() => { if (encoder.encodeQueueSize <= 3) f(); else setTimeout(f, 50); }); });
    let prev = null;
    try {
      for (let i = 0; i < n; i++) {
        if ((cb.cancelled && cb.cancelled()) || err) break;
        const e = times[i], t = tOf(e);
        // (a hold repeats the last picture: no new render)
        const same = prev != null && (t != null ? typeof prev === 'number' && Math.abs(t - prev) <= 1e-12 : typeof prev === 'object' && prev.k === e.k);
        if (!same) {
          const a0 = performance.now();
          if (t != null) { if (!(await videoFrame(plan, t, ctx))) { err = err || new Error('cancelled'); break; } }
          else {
            const ca = await keptAt(e.a), cbv = await keptAt(e.b);
            if (!ca || !cbv) { err = err || new Error('cancelled'); break; }
            ctx.globalAlpha = 1; ctx.drawImage(ca, 0, 0); ctx.globalAlpha = e.k; ctx.drawImage(cbv, 0, 0); ctx.globalAlpha = 1;
          }
          prev = e;
          if (plan.trace) plan.trace.push(['frame', Math.round(performance.now() - a0)]);
        }
        const e0 = performance.now();
        const vf = new VideoFrame(cv, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
        encoder.encode(vf, { keyFrame: i % keyEvery === 0 });
        vf.close();
        if (plan.trace) plan.trace.push(['enc', Math.round(performance.now() - e0)]);
        while (encoder.encodeQueueSize > 3 && !err) await dequeued();
        if (cb.progress) cb.progress(i + 1, n);
        await breathe();
      }
      if (err || (cb.cancelled && cb.cancelled())) { try { encoder.close(); } catch (e) { /* closed */ } if (err && err.message !== 'cancelled') throw err; return null; }
      await encoder.flush();
    } finally { if (encoder.state !== 'closed') try { encoder.close(); } catch (e) { /* closed */ } }
    for (const c of kept.values()) { c.width = 1; c.height = 1; }
    // (the chunks stay in the encoder's output order, which is the decode order: muxMP4 checks the timestamps)
    const hx = (v) => v.toString(16).toUpperCase().padStart(2, '0');
    const codec = pick.mux === 'mp4' && desc && desc.length > 3 ? `avc1.${hx(desc[1])}${hx(desc[2])}${hx(desc[3])}` : pick.cfg.codec;
    const blob = pick.mux === 'mp4' ? muxMP4(chunks, desc, W, H, fps) : muxWebM(chunks, W, H, fps, pick.cfg.codec);
    if (opts && opts.keepForCheck) { plan.o = Object.assign({}, plan.o, { alive: null }); lastVideo = { codec, mux: pick.mux, frames: n, fps, W, H, times, desc, chunks, plan }; }
    return { blob, ext: pick.mux, codec, frames: n, fps, secs: n / fps, W, H, name: plan.name, ms: Math.round(performance.now() - t0), labels: plan.labelBoxes || null };
  }
  // (tests) one frame of the last video decoded back, and the exact render at its t, as RGBA at w x h
  async function videoCheck(k, w = 192, h = 108) {
    const L = lastVideo;
    if (!L || typeof VideoDecoder === 'undefined') return null;
    const frames = [];
    const dec = new VideoDecoder({ output: (f) => { frames.push(f); }, error: () => {} });
    const cfg = { codec: L.codec, codedWidth: L.W, codedHeight: L.H };
    if (L.mux === 'mp4') cfg.description = L.desc;
    dec.configure(cfg);
    let k0 = k; while (k0 > 0 && !L.chunks[k0].key) k0--;
    for (let i = k0; i <= k; i++) dec.decode(new EncodedVideoChunk({ type: L.chunks[i].key ? 'key' : 'delta', timestamp: L.chunks[i].ts, data: L.chunks[i].data }));
    await dec.flush();
    const f = frames[frames.length - 1];
    const c1 = document.createElement('canvas'); c1.width = w; c1.height = h;
    const x1 = c1.getContext('2d'); x1.drawImage(f, 0, 0, w, h);
    frames.forEach((q) => q.close()); dec.close();
    const big = document.createElement('canvas'); big.width = L.W; big.height = L.H;
    const e = L.times[k];
    if (typeof e === 'number') await videoFrame(L.plan, e, big.getContext('2d', { alpha: false }));
    else { const ca = document.createElement('canvas'), cb2 = document.createElement('canvas'); for (const c of [ca, cb2]) { c.width = L.W; c.height = L.H; } await videoFrame(L.plan, e.a, ca.getContext('2d', { alpha: false })); await videoFrame(L.plan, e.b, cb2.getContext('2d', { alpha: false })); const g = big.getContext('2d'); g.drawImage(ca, 0, 0); g.globalAlpha = e.k; g.drawImage(cb2, 0, 0); g.globalAlpha = 1; }
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h;
    c2.getContext('2d').drawImage(big, 0, 0, w, h);
    const a = x1.getImageData(0, 0, w, h).data, b = c2.getContext('2d').getImageData(0, 0, w, h).data;
    let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    return { t: typeof e === 'number' ? e : e.a, mad: s / (w * h * 3), decoded: c1.toDataURL('image/png'), exact: c2.toDataURL('image/png') };
  }
  // (tests, export review r3, editor-5) the last video's window and the screen's, and a frame at the screen's t drawn by
  // the video's code at the pane's size, for a pixel comparison with a capture of the pane
  async function videoScreenCheck(opts) {
    const plan = await videoPlan(opts);
    if (!plan) return null;
    const side = plan.side, scr = A.screenBox(side), t = A.defo().T;
    const c = document.createElement('canvas'); c.width = plan.W; c.height = plan.H;
    await videoFrame(plan, t, c.getContext('2d', { alpha: false }));
    return { box: plan.box, screen: scr, t, frame: c.toDataURL('image/png') };
  }
  // ---- (2026-10-24, VIDEO-PREVIEW.md) the dialog plays the video as it will be saved ----
  // Every picture the preview shows is a frame of the video: videoFrame on the video's own plan at the video's own size
  // (the exact render makeVideo encodes), scaled down once to the size the dialog shows it at in device pixels (never
  // below that, never above the video's size) and kept. A hold shows its kept frame again; a fade of Loop blends two kept
  // frames, as makeVideo does. The frames are drawn one per animation frame, coarse to fine (every 16th first), so the
  // motion shows at once and fills in; until a frame is drawn its nearest drawn neighbour stands in. The clock runs at
  // the video's frame rate over its whole timeline (holds, Loop's three runs, Bounce's way back) and starts again at
  // the end.
  // Keeping (review vp-1, vp-7): when all the frames fit in pvRaw() bytes they are kept as they are (bitmaps, exact);
  // else each is kept compressed (WebP, or JPEG where WebP cannot be encoded, quality 0.92) and a few frames around the
  // playhead are decoded ahead (createImageBitmap, off the main thread). So the size of the kept frames follows the
  // screen, not the length of the timeline. pvRaw() is smaller on a phone, a tablet or a device with 4 GB or less.
  const pvRaw = () => {
    let low = false;
    try { low = (navigator.deviceMemory > 0 && navigator.deviceMemory <= 4) || matchMedia('(pointer: coarse)').matches; } catch (e) { /* no matchMedia */ }
    return low ? 64e6 : 192e6;
  };
  const PV_Q = 0.92;
  // the compressed format: WebP where this browser can encode it (it says so by the type of what it returns), else JPEG
  let pvMimeP = null;
  const pvMime = () => pvMimeP || (pvMimeP = (async () => {
    try {
      const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(2, 2) : Object.assign(document.createElement('canvas'), { width: 2, height: 2 });
      c.getContext('2d').fillRect(0, 0, 1, 1);
      const b = c.convertToBlob ? await c.convertToBlob({ type: 'image/webp', quality: PV_Q }) : await new Promise((r) => c.toBlob(r, 'image/webp', PV_Q));
      return b && b.type === 'image/webp' ? 'image/webp' : 'image/jpeg';
    } catch (e) { return 'image/jpeg'; }
  })());
  const pvStats = { renders: 0, live: 0, runs: 0, draws: 0, decodes: 0 }; // (tests: frames drawn, previews alive, starts, pictures shown, frames decoded)
  // the width the frames are kept at: the shown width in device pixels, at most the video's
  const pvKeptW = (W, cssW) => Math.max(16, Math.min(W, Math.round(cssW * Math.max(1, window.devicePixelRatio || 1))));
  function makePreview(cv, ui) {
    const g = cv.getContext('2d', { alpha: false });
    let run = null, raf = 0, clock = 0, pos0 = 0;
    const P = { playing: false, i: 0, shown: false, drawn: -1 };
    const tkey = (t) => t.toFixed(9);
    // the next slot for a frame's render: just after the screen's frame (so a render of 5-15 ms fits before the next
    // one). A hidden page draws nothing: the fill waits until the page is shown again (review vp-7)
    const shownAgain = (q) => new Promise((r) => {
      if (!document.hidden) { r(); return; }
      const f = () => { if (!document.hidden || q.dead) { document.removeEventListener('visibilitychange', f); q.unhide = null; r(); } };
      q.unhide = f; document.addEventListener('visibilitychange', f);
    });
    const slot = async (q) => { await shownAgain(q); if (q.dead) return; await new Promise((r) => requestAnimationFrame(() => { breathe().then(r); })); };
    const idle = () => new Promise((r) => setTimeout(r, 150));
    const has = (q, u) => (q.raw ? !!q.bm[u] : !!(q.bl[u] || q.pend.has(u)));
    // the frame kept for unique time u, else its nearest kept neighbour (while the frames fill in); -1 if none
    const near = (q, u) => { if (has(q, u)) return u; for (let d = 1; d < q.U.length; d++) { if (u - d >= 0 && has(q, u - d)) return u - d; if (u + d < q.U.length && has(q, u + d)) return u + d; } return -1; };
    // the unique times timeline index i needs (one; two for a fade)
    const need = (q, i) => { const e = q.times[i]; return typeof e === 'number' ? [q.ui[i]] : [q.uOf.get(tkey(e.a)), q.uOf.get(tkey(e.b))]; };
    // (compressed) decode u ahead; the decoded frames are a small cache, the ones near the playhead kept
    function decode(q, u) {
      if (q.raw || q.hot.has(u) || q.dec.has(u) || !q.bl[u]) return;
      const p = createImageBitmap(q.bl[u]).then((b) => {
        q.dec.delete(u);
        if (q.dead) { if (b.close) b.close(); return; }
        pvStats.decodes++; q.hot.set(u, b); trim(q);
        if (!P.playing && P.shown && P.drawn !== P.i && run === q) draw(P.i);
      }, (e) => { q.dec.delete(u); console.error(e); });
      q.dec.set(u, p);
    }
    function trim(q) {
      if (q.hot.size <= q.hotMax) return;
      for (const [u, b] of q.hot) { if (q.hot.size <= q.hotMax) break; if (q.keep.has(u) || q.pend.has(u)) continue; q.hot.delete(u); if (b.close) b.close(); }
    }
    // (compressed) the frames for the next ~0.3 s from index i, decoded ahead, at most 4 at a time
    function ahead(q, i) {
      if (q.raw) return;
      q.keep.clear();
      const n = q.times.length, K = Math.min(q.hotMax - 2, Math.ceil(q.fps * 0.3));
      for (let k = 0; k <= K && q.keep.size < q.hotMax - 1; k++) for (const u of need(q, (i + k) % n)) { const v = near(q, u); if (v >= 0) q.keep.add(v); }
      for (const v of q.keep) { if (q.dec.size >= 4) break; decode(q, v); }
    }
    const get = (q, v) => {
      if (q.raw) return q.bm[v];
      const b = q.hot.get(v);
      if (b) { q.hot.delete(v); q.hot.set(v, b); return b; } // (most recently used last)
      decode(q, v); return null;
    };
    function draw(i) {
      const q = run;
      if (!q) return false;
      const e = q.times[i], vs = need(q, i).map((u) => near(q, u));
      if (vs.some((v) => v < 0)) return false;
      if (!q.raw) for (const v of vs) q.keep.add(v);
      const bs = vs.map((v) => get(q, v));
      if (bs.some((b) => !b)) return false;
      g.globalAlpha = 1; g.drawImage(bs[0], 0, 0, cv.width, cv.height);
      if (bs.length > 1) { g.globalAlpha = e.k; g.drawImage(bs[1], 0, 0, cv.width, cv.height); g.globalAlpha = 1; }
      pvStats.draws++; P.drawn = i;
      if (!P.shown) { P.shown = true; ui.shown(true); }
      return true;
    }
    const show = (i) => { P.i = i; P.drawn = -1; if (run) ahead(run, i); draw(i); ui.tick(i); };
    function loop(now) {
      raf = 0;
      const q = run;
      if (!q || !P.playing) return;
      const i = Math.max(0, Math.floor(pos0 + (now - clock) * q.fps / 1000)) % q.times.length;
      if (i !== P.i) { P.i = i; ui.tick(i); }
      ahead(q, i);
      if (P.drawn !== i || !P.shown) draw(i); // (a frame still decoding: the picture stays one frame longer)
      raf = requestAnimationFrame(loop);
    }
    // (lazy, reduced motion: only the frame in view is drawn until Play; a seek draws its frame and neighbours)
    function want(q, i) { const n = q.times.length; for (const k of [0, 1, -1, 2, -2]) for (const u of need(q, (i + k + n) % n)) q.urgent.push(u); if (q.wake) q.wake(); }
    function fillAll(q) { if (!q.lazy) return; q.lazy = false; for (const u of q.full) q.order.push(u); if (q.wake) q.wake(); ui.fill(q.ready, q.U.length); }
    function play() {
      const q = run;
      if (!q) return;
      fillAll(q);
      P.playing = true; pos0 = P.i; clock = performance.now();
      if (!raf) raf = requestAnimationFrame(loop);
      ui.playing(true);
    }
    function pause() { P.playing = false; if (raf) { cancelAnimationFrame(raf); raf = 0; } ui.playing(false); }
    function seek(i) { const q = run; if (!q) return; i = Math.max(0, Math.min(q.times.length - 1, i | 0)); pos0 = i; clock = performance.now(); if (q.lazy) want(q, i); show(i); }
    function stop() {
      const q = run;
      run = null;
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      P.playing = false;
      if (q) {
        q.dead = true;
        for (const b of q.bm) if (b && b.close) b.close();
        for (const b of q.hot.values()) if (b.close) b.close();
        q.bm = []; q.bl = []; q.hot.clear();
        if (q.wake) q.wake();
        if (q.unhide) q.unhide(); // (a fill waiting for a hidden page ends)
        pvStats.live--;
      }
    }
    // start(plan, {cssW, autoplay, at, lazy, keep}): the frames of plan (from videoPlan, the poster's), shown cssW CSS px
    // wide, from timeline index at; keep: a picture to hold in view until the first new frame (a restart on resize)
    function start(plan, o) {
      stop();
      const times = plan.times, fps = plan.v.fps === 60 ? 60 : 30;
      const U = [], uOf = new Map(), ui2 = new Int32Array(times.length);
      const add = (t) => { const k = tkey(t); if (!uOf.has(k)) { uOf.set(k, U.length); U.push(t); } return uOf.get(k); };
      times.forEach((e, i) => { if (typeof e === 'number') ui2[i] = add(e); else { add(e.a); add(e.b); ui2[i] = -1; } });
      const pw = pvKeptW(plan.W, o.cssW), ph = Math.max(9, Math.round(plan.H * pw / plan.W));
      const fb = 4 * pw * ph, budget = pvRaw(), raw = U.length * fb <= budget;
      cv.width = pw; cv.height = ph;
      const at = Math.max(0, Math.min(times.length - 1, o.at | 0));
      const q = run = {
        plan, times, fps, U, uOf, ui: ui2, raw, bm: raw ? new Array(U.length).fill(null) : [], bl: raw ? [] : new Array(U.length).fill(null),
        hot: new Map(), dec: new Map(), pend: new Map(), keep: new Set(), hotMax: Math.max(6, Math.min(40, Math.floor(budget / 3 / fb))), bytes: 0,
        mime: 'image/webp', ready: 0, pw, ph, dead: false, id: ++pvStats.runs, lazy: !!o.lazy, order: [], full: [], urgent: [], qpos: 0, wake: null, unhide: null, cssW: o.cssW,
      };
      pvStats.live++;
      P.i = at; P.drawn = -1; P.shown = false;
      if (o.keep) { g.drawImage(o.keep, 0, 0, pw, ph); P.shown = true; } else ui.shown(false);
      ui.size(pw, ph, plan.W, plan.H, raw); ui.tick(at); ui.fill(0, U.length);
      // the order: the frame in view, both ends, then every 16th, 8th, ... frame (lazy: the frame in view only)
      const seen = new Uint8Array(U.length);
      const put = (u) => { if (u >= 0 && u < U.length && !seen[u]) { seen[u] = 1; q.full.push(u); } };
      for (const u of need(q, at)) put(u);
      put(0); put(U.length - 1);
      for (let st = 16; st >= 1; st >>= 1) for (let u = 0; u < U.length; u += st) put(u);
      if (q.lazy) q.order = need(q, at).slice(); else { q.order = q.full; }
      if (o.autoplay) play(); else ui.playing(false);
      const nextU = () => {
        while (q.urgent.length) { const u = q.urgent.shift(); if (!has(q, u)) return u; }
        while (q.qpos < q.order.length) { const u = q.order[q.qpos++]; if (!has(q, u)) return u; }
        return -1;
      };
      (async () => {
        const big = document.createElement('canvas');
        const bx = big.getContext('2d', { alpha: false });
        const off = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(pw, ph) : null;
        const sm = off || Object.assign(document.createElement('canvas'), { width: pw, height: ph });
        const sx = sm.getContext('2d', { alpha: false });
        const enc = (type) => (off ? off.convertToBlob({ type, quality: PV_Q }) : new Promise((r) => sm.toBlob(r, type, PV_Q)));
        try {
          if (!q.raw) q.mime = await pvMime();
          while (!q.dead) {
            const u = nextU();
            if (u < 0) {
              if (q.ready === U.length) break;
              big.width = 1; big.height = 1; // (lazy: nothing to draw until a seek or Play)
              await new Promise((r) => { q.wake = r; }); q.wake = null;
              continue;
            }
            while (!q.dead && ui.blocked()) await idle(); // (a video being saved goes first)
            if (q.dead) return;
            await slot(q);
            if (q.dead) return;
            if (big.width !== plan.W || big.height !== plan.H) { big.width = plan.W; big.height = plan.H; }
            if (!(await videoFrame(plan, U[u], bx)) || q.dead) return;
            sx.globalAlpha = 1; sx.imageSmoothingEnabled = true; sx.imageSmoothingQuality = 'high';
            sx.drawImage(big, 0, 0, pw, ph);
            if (q.raw) {
              const bm = off ? off.transferToImageBitmap() : await createImageBitmap(sm);
              if (q.dead) { if (bm.close) bm.close(); return; }
              q.bm[u] = bm;
            } else {
              // (compressed: the encoding runs off the main thread, at most 3 at a time, while the next frame is drawn; the
              // frame just drawn goes to the decoded cache too, kept there until its encoding is done)
              while (!q.dead && q.pend.size >= 3) await Promise.race(q.pend.values());
              if (q.dead) return;
              const p = enc(q.mime).then((bl) => { q.pend.delete(u); if (q.dead) return; if (!bl) { console.error('preview: a frame could not be encoded'); return; } q.bl[u] = bl; q.bytes += bl.size; }, (e) => { q.pend.delete(u); console.error(e); });
              q.pend.set(u, p);
              const bm = off ? off.transferToImageBitmap() : await createImageBitmap(sm);
              if (q.dead) { if (bm.close) bm.close(); return; }
              const old = q.hot.get(u); if (old && old.close) old.close();
              q.hot.set(u, bm); trim(q);
            }
            q.ready++; pvStats.renders++;
            ui.fill(q.ready, U.length);
            // (paused: the picture in view is redrawn when its own frame, or a nearer one, arrives; a run that is not
            // lazy, such as a restart after an option changed while paused, shows its frames too, not the 960 px
            // poster; review-video-preview-verify vp-1/vp-2 residual)
            if (!P.playing && (P.shown || o.autoplay || !q.lazy)) { P.drawn = -1; draw(P.i); }
          }
        } catch (e) { console.error(e); } finally { big.width = 1; big.height = 1; if (!off) { sm.width = 1; sm.height = 1; } }
      })();
    }
    // the dialog grew (or moved to a sharper screen): frames kept clearly smaller than the new size are drawn again at
    // it, from the same position, playing or paused as before; the picture in view stays until the first new frame
    // (review vp-3)
    function resize(cssW) {
      const q = run;
      if (!q || pvKeptW(q.plan.W, cssW) <= q.pw * 1.25) return false;
      let keep = null;
      if (P.shown) { keep = document.createElement('canvas'); keep.width = cv.width; keep.height = cv.height; keep.getContext('2d').drawImage(cv, 0, 0); }
      start(q.plan, { cssW, autoplay: P.playing, at: P.i, lazy: q.lazy, keep });
      if (keep) { keep.width = 1; keep.height = 1; }
      return true;
    }
    return {
      start, stop, play, pause, seek, draw, resize,
      toggle: () => (P.playing ? pause() : play()),
      state: () => ({ playing: P.playing, i: P.i, n: run ? run.times.length : 0, ready: run ? run.ready : 0, total: run ? run.U.length : 0, pw: run ? run.pw : 0, ph: run ? run.ph : 0, shown: P.shown, fps: run ? run.fps : 0, id: run ? run.id : 0, raw: run ? run.raw : null, lazy: run ? run.lazy : false, hot: run ? run.hot.size : 0, bytes: run ? run.bytes : 0, mime: run && !run.raw ? run.mime : null }),
      // (tests) the picture the preview shows at timeline index i, once its own frames are kept, as PNG data
      frame: async (i) => {
        const q = run;
        if (!q) return null;
        const e = q.times[i], us = need(q, i);
        if (us.some((u) => !has(q, u))) return null;
        const bs = await Promise.all(us.map((u) => (q.raw ? q.bm[u] : createImageBitmap(q.bl[u]))));
        const c = document.createElement('canvas'); c.width = q.pw; c.height = q.ph;
        const x = c.getContext('2d', { alpha: false });
        x.drawImage(bs[0], 0, 0); if (bs.length > 1) { x.globalAlpha = e.k; x.drawImage(bs[1], 0, 0); }
        if (!q.raw) for (const b of bs) if (b.close) b.close();
        return c.toDataURL('image/png');
      },
      entry: (i) => (run ? run.times[i] : null),
      tOf: (i) => { const e = run && run.times[i]; return e == null ? null : typeof e === 'number' ? e : e.k < 0.5 ? e.a : e.b; },
    };
  }
  // =====================================================================================================
  // 5. Remembered settings and the dialog
  // =====================================================================================================
  const LS = () => (A && A.lsk ? A.lsk('cmw-figure-v1') : 'cmw-figure-v1');
  function loadSet() {
    const d = { for: 'article', cols: 1, size: {}, text: {}, ink: 'colour', crop: 'fit', axes: {}, fine: false, deform: 'film', last: null, lastFig: null, customPt: null, capLang: 'ui', fmt: 'pdf', dpi: 300, dpiFor: {}, video: null };
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
    play: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor"/></svg>',
    pause: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor"/></svg>',
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
  // (round 3) the styles of the format row, the LaTeX box and the video panel, from the app's theme tokens (light and
  // dark follow the page); injected once, so page.html stays as it is
  const CSS3 = `.xf-fmtrow{display:flex;gap:6px;align-items:center}.xf-fmtrow .xf-seg{flex:1 1 auto}.xf-fmtrow select.xf-select{flex:0 0 auto;height:28px}
.xf-ctl>.xf-row{min-width:0}.xf-texwrap{position:relative;display:grid;grid-template-columns:minmax(0,1fr);min-width:0}.xf-tex{margin:0;max-height:9.5em;overflow:auto;box-sizing:border-box;width:100%;padding:7px 8px 7px 9px;background:var(--well);border:1px solid var(--line);border-radius:var(--r-2);font:400 10.5px/14px var(--f-mono);color:var(--ink-2);white-space:pre-wrap;overflow-wrap:anywhere;tab-size:2}
.xf-tex:focus-visible{outline:2px solid var(--accent);outline-offset:1px}.xf-texbar{display:flex;align-items:center;gap:8px;margin-top:6px}.xf-texnote{font:var(--t-label);color:var(--muted)}.xf-texnote code{font:var(--t-readout)}
.xf-video{display:grid;gap:10px}.xf-video .xf-fr{grid-template-columns:64px minmax(0,1fr)}.xf-checks{display:flex;flex-wrap:wrap;gap:6px 14px;font:var(--t-label);color:var(--ink-2)}.xf-checks label{display:inline-flex;align-items:center;gap:6px;cursor:pointer}
.xf-prog{display:flex;align-items:center;gap:10px;flex:1 1 auto;min-width:0}.xf-prog[hidden]{display:none}.xf-warn{color:var(--warn);margin-top:4px}.xf-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}.xf-meter{flex:1 1 auto;height:6px;border-radius:3px;background:var(--well);border:1px solid var(--line);overflow:hidden}.xf-meter>i{display:block;height:100%;width:0;background:var(--accent);transition:width .12s linear}.xf-progtxt{font:var(--t-readout);color:var(--ink-2);white-space:nowrap}
.xf-poster{display:block;max-width:100%;max-height:100%;margin:auto;background:#fff;box-shadow:var(--xf-paper-shadow)}.xf-scroll.video{align-items:center}.xf-scroll.video .xf-paper{display:none}.xf-scroll:not(.video) .xf-poster{display:none}
.xf-pv{display:flex;flex-direction:column;gap:6px;max-width:100%;margin:auto}.xf-scroll:not(.video) .xf-pv{display:none}.xf-pv .xf-poster{margin:0}.xf-pv.busy .xf-poster{opacity:.6;transition:opacity var(--t-med) var(--ease-out)}.xf-pv.busy .xf-pvbar{opacity:.55}
.xf-pvcv{display:block;background:#fff;box-shadow:var(--xf-paper-shadow);cursor:pointer}.xf-pvbar{display:flex;align-items:center;gap:8px;min-width:0}.xf-pvbtn{flex:0 0 auto;width:28px;height:28px;padding:0;display:inline-grid;place-items:center;border-radius:var(--r-2);background:var(--surface);border:1px solid var(--line);color:var(--ink);cursor:pointer}.xf-pvbtn:hover{border-color:var(--line-strong)}
.xf-pvbtn:focus-visible,.xf-pvrange:focus-visible{outline:2px solid var(--accent);outline-offset:1px}.xf-pvrange{flex:1 1 auto;min-width:60px;margin:0;accent-color:var(--accent)}.xf-pvtime{font:var(--t-label);color:var(--ink-2);white-space:nowrap;font-variant-numeric:tabular-nums}.xf-pvt i{font-family:var(--f-math, serif)}.xf-pvnote{font:var(--t-label);color:var(--muted);min-height:16px;overflow-wrap:anywhere}
@media (max-width:560px){.xf-fmtrow{flex-wrap:wrap}.xf-video .xf-fr{grid-template-columns:1fr}.xf-pvt{display:none}}`;
  const injectCSS = () => { if (document.getElementById('xfR3css')) return; const st = document.createElement('style'); st.id = 'xfR3css'; st.textContent = CSS3; document.head.append(st); };
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
    const close = () => { closed = true; token++; pv.stop(); bg.remove(); document.removeEventListener('keydown', onKey, true); dlg = null; if (opener && opener.focus) opener.focus({ preventScroll: true }); };
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
    // (round 3) the deformation is a deformation in every view that shows it: the filmstrip, the paths (plane and
    // globe), or one frame at the current t (the earlier one-panel figure of Phase, Landscape and the globes)
    const defo = defoOf(view);
    const dOpts = [['film', $t('Filmstrip')]];
    if (defo && PATHS_OK.has(defo)) dOpts.push(['paths', $t('Paths')]);
    if (defo && defo !== 'plane') dOpts.push(['frame', $t('One frame')]);
    const deformOf = () => (dOpts.some((q) => q[0] === set.deform) ? set.deform : 'film');
    const deformRow = defo ? row($t('Deformation'), segB('xfDeform', deformOf(), dOpts, (v) => { set.deform = v; changed(); }, $t('Deformation'))) : null;
    if (deformRow) deformRow.classList.add('wide');
    // (round 3) the format: PDF, PNG, SVG, and Video while the deformation is on; remembered
    injectCSS();
    // (a browser without a video encoder is told so at the format row, not after Save: export review r3, video-6)
    const canVideo = typeof VideoEncoder !== 'undefined';
    const fmtOf = () => (set.fmt === 'video' ? (defo && canVideo ? 'video' : 'pdf') : ['pdf', 'png', 'svg'].includes(set.fmt) ? set.fmt : 'pdf');
    const fOpts = [['pdf', 'PDF'], ['png', 'PNG'], ['svg', 'SVG']];
    if (defo) fOpts.push(['video', $t('Video')]);
    // (PNG: 600 dpi for an article, where journals ask for it; 300 dpi for homework and slides; remembered per For)
    const dpiOf = () => { const v = set.dpiFor && set.dpiFor[set.for]; return v === 300 || v === 600 ? v : set.for === 'article' ? 600 : 300; };
    const dpiSel = h('select', { class: 'xf-select', id: 'xfDpi', 'aria-label': $t('Resolution'), onchange: () => { set.dpiFor = Object.assign({}, set.dpiFor, { [set.for]: +dpiSel.value }); set.dpi = +dpiSel.value; saveSet(set); syncFmt(); } }, ...[300, 600].map((v) => h('option', { value: String(v) }, `${v} dpi`)));
    dpiSel.value = String(dpiOf());
    const fmtSeg = segB('xfFmt', fmtOf(), fOpts, (v) => { set.fmt = v; saveSet(set); syncFmt(); }, $t('Format'));
    const fmtRow = row($t('Format'), h('div', { class: 'xf-fmtrow' }, fmtSeg, dpiSel)); fmtRow.classList.add('wide');
    if (defo && !canVideo) { const vb = fmtSeg.querySelector('[data-v="video"]'); if (vb) { vb.disabled = true; vb.title = $t('This browser cannot encode video. Try a recent Chrome, Edge or Safari.'); } }
    // the LaTeX of the chosen format, in view and one click from the clipboard
    const texPre = h('pre', { class: 'xf-tex', id: 'xfTex', tabindex: '0', 'aria-label': $t('LaTeX snippet') });
    const texNote = h('div', { class: 'xf-texnote', id: 'xfTexNote' });
    const texCopy = h('button', { type: 'button', class: 'btn xf-texcopy', id: 'xfTexCopy', onclick: () => { if (!fig) return; A.copyText(latex(fig, capEdited, fmtOf(), dpiOf())); set.last = set.lastFig = { kind: 'latex', fmt: fmtOf(), dpi: dpiOf() }; saveSet(set); toast($t('LaTeX copied.')); cueDone(); } }, $t('Copy LaTeX'));
    const texRow = row('LaTeX', h('div', { class: 'xf-texwrap' }, texPre), h('div', { class: 'xf-texbar' }, texCopy, texNote)); texRow.classList.add('wide');
    // the video's options (remembered): size, frame rate, length, ends, look, paths, t label
    const vset = Object.assign(vdefaults(), set.video || {});
    const saveV = () => { set.video = Object.assign({}, vset); saveSet(set); };
    const vseg = (id, key, options, label, num) => segB(id, String(vset[key]), options, (v) => { vset[key] = num ? +v : v; saveV(); posterSoon(); }, label);
    // (verify-editor-7) the length of each step, said in the menu; the poster's line gives the whole video's length
    if (!VSECS.includes(+vset.secs)) vset.secs = VSECS.reduce((a, b) => (Math.abs(b - vset.secs) < Math.abs(a - vset.secs) ? b : a), 3);
    const vLen = h('select', { class: 'xf-select', id: 'xfVLen', 'aria-label': $t('Length of each step'), onchange: () => { vset.secs = +vLen.value; saveV(); posterSoon(); } }, ...VSECS.map((v) => h('option', { value: String(v) }, $t('{v} s per step', { v }))));
    vLen.value = String(vset.secs);
    const vck = (key, label) => { const c = h('input', { type: 'checkbox', id: `xfV${key}`, onchange: () => { vset[key] = c.checked; saveV(); posterSoon(); } }); c.checked = !!vset[key]; return h('label', null, c, label); };
    const vfr = (label, el) => h('div', { class: 'xf-fr' }, h('span', null, label), el);
    const vidBox = h('div', { class: 'xf-video', id: 'xfVideoBox' },
      vfr($t('Size'), vseg('xfVSize', 'size', [['1920x1080', '1920×1080'], ['1280x720', '1280×720'], ['1080x1080', '1080×1080']], $t('Video size'))),
      vfr($t('Speed'), h('div', { class: 'xf-fmtrow' }, vseg('xfVFps', 'fps', [['30', $t('{n} fps', { n: 30 })], ['60', $t('{n} fps', { n: 60 })]], $t('Frame rate'), true), vLen)),
      vfr($t('Ends'), vseg('xfVEnds', 'ends', [['once', $t('Once')], ['loop', $t('Loop')], ['bounce', $t('Bounce')]], $t('Ends'))),
      vfr($t('Look'), vseg('xfVLook', 'look', [['light', $tx('video look', 'Light')], ['print', $tx('video look', 'Print')]], $t('Look'))),
      ...(defo === 'plane' || defo === 'deriv' || defo === 'phase' ? [vfr($t('Window'), vseg('xfVWin', 'win', [['screen', $t('As on screen')], ['fit', $t('Fit the motion')]], $t('Window')))] : []),
      h('div', { class: 'xf-checks' }, ...(defo === 'plane' || defo === 'globe' || defo === 'deriv' ? [vck('paths', $t('Paths'))] : []), vck('tlabel', $t('t label'))));
    const vidRow = row($t('Video'), vidBox); vidRow.classList.add('wide');
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
    const ftWrap = h('div', { class: 'xf-ftwrap' }, ftBtn, ftBody);
    const ctl = h('div', { class: 'xf-ctl' }, fmtRow, forRow, sizeRow, inkRow, ...(capLangRow ? [capLangRow] : []), ...(deformRow ? [deformRow] : []), vidRow, texRow, ftWrap);
    // ---- the footer ----
    let nameEdited = false;
    const nameInp = h('input', { type: 'text', class: 'xf-nameinp', id: 'xfName', value: defaultName(view, deformOf(), fmtOf()), spellcheck: 'false', 'aria-label': $t('File name'), onchange: () => { changed(); }, oninput: () => { nameEdited = true; fitName(); } });
    // the field is as wide as the name (up to 40 characters, the longest a scene name gets)
    const fitName = () => { nameInp.style.width = `${Math.min(40, Math.max(8, nameInp.value.length + 1))}ch`; };
    fitName();
    const extEl = h('span', { class: 'xf-ext' }, '.pdf');
    const moreBtn = h('button', { type: 'button', class: 'btn quiet xf-more', id: 'xfMore', 'aria-haspopup': 'menu' }, $t('More formats '), h('span', { html: ICON.down }));
    const docsBtn = h('button', { type: 'button', class: 'btn xf-dest', id: 'xfDocs' }, $t('For Docs'));
    const olBtn = h('button', { type: 'button', class: 'btn primary xf-dest', id: 'xfOverleaf' }, $t('For Overleaf'));
    const after2 = h('div', { class: 'xf-after2', hidden: true });
    const vidBtn = h('button', { type: 'button', class: 'btn primary xf-dest', id: 'xfVideo' }, $t('Save video'));
    const meter = h('i'), progTxt = h('span', { class: 'xf-progtxt', 'aria-hidden': 'true' }), progSr = h('span', { class: 'xf-sr', role: 'status' });
    const cancelBtn = h('button', { type: 'button', class: 'btn quiet', id: 'xfVCancel' }, $t('Cancel'));
    const meterEl = h('div', { class: 'xf-meter', role: 'progressbar', 'aria-label': $t('Making the video'), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' }, meter);
    const prog = h('div', { class: 'xf-prog', hidden: true }, meterEl, progTxt, cancelBtn);
    const nameLab = h('label', { class: 'xf-name' }, nameInp, extEl), footSp = h('span', { class: 'xf-sp' });
    const foot = h('div', { class: 'xf-foot' }, nameLab, prog, footSp, moreBtn, docsBtn, olBtn, vidBtn, after2, progSr);
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
      docsBtn.textContent = set.for === 'slides' ? $t('For Slides') : $t('For Docs');
      olBtn.textContent = set.for === 'slides' ? $t('For Beamer') : $t('For Overleaf');
      const T = TYPE[set.for][set.text[set.for] || (set.for === 'article' ? 10 : 11)];
      hint.textContent = $t('{label}, {pt} pt text · Fit column', { label: $t(sz.label), pt: set.text[set.for] || (set.for === 'article' ? 10 : 11) });
      st.hintText = hint.textContent;
      st.T = T;
      syncFmt();
    };
    const changed = () => { saveSet(set); sync(); rebuild(); };
    // ---- (round 3) the format: what the destinations save, the LaTeX for it, the video panel and its poster ----
    const posterImg = h('img', { class: 'xf-poster', alt: $t('A frame of the video') });
    // (2026-10-24, VIDEO-PREVIEW.md) the video plays here as it will be saved: the poster first, then the frames as they
    // are drawn; a play/pause button, a scrubber (arrows step one frame) and the time. Reduced motion: paused on the
    // poster, with Play.
    const num = (x, d) => (I18 ? I18.num(x.toFixed(d)) : x.toFixed(d));
    const pvCv = h('canvas', { class: 'xf-pvcv', role: 'img', 'aria-label': $t('The video, as it will be saved'), hidden: true, onclick: () => pvToggle() });
    const pvBtn = h('button', { type: 'button', class: 'xf-pvbtn', id: 'xfPvPlay', onclick: () => pvToggle() });
    // (while no preview runs, between an option change and its new frames, the button and the scrubber change only the
    // wish, which the next preview starts with: review vp-2)
    const pvRange = h('input', { type: 'range', class: 'xf-pvrange', id: 'xfPvSeek', min: '0', max: '0', step: '1', value: '0', 'aria-label': $t('Position in the video'), oninput: () => { const v = +pvRange.value; pvWant = false; if (!pv.state().id) { pvBtnSet(false); return; } pv.pause(); pv.seek(v); } });
    // (a key on the scrubber while it plays: from the frame in view, not from where the scrubber stood still)
    pvRange.addEventListener('keydown', () => { const s = pv.state(); if (s.id && s.playing) pvRange.value = String(s.i); });
    pvRange.addEventListener('focus', () => { const s = pv.state(); if (s.id) pvAria(s.i, true); });
    const pvTt = document.createTextNode('');
    const pvTime = h('span', { class: 'xf-pvtime', 'aria-hidden': 'true' }), pvT = h('span', { class: 'xf-pvtime xf-pvt', 'aria-hidden': 'true' }, h('i', null, 't'), pvTt);
    const pvNote = h('div', { class: 'xf-pvnote', id: 'xfPvNote' });
    const pvBar = h('div', { class: 'xf-pvbar', hidden: true }, pvBtn, pvRange, pvTime, pvT);
    const pvBox = h('div', { class: 'xf-pv', id: 'xfPv' }, posterImg, pvCv, pvBar, pvNote);
    scroll.append(pvBox);
    const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    let pvWant = !reduced(), pvSize = null, pvFill = [0, 0], pvAriaAt = 0;
    // (what the frames are: the video's own, at the size shown here when that is smaller, and lightly compressed when
    // the timeline is too long to keep them as they are; review vp-1)
    const pvNoteText = () => {
      if (!pvSize) return '';
      const s = pv.state(), [r, n] = pvFill, [pw, , W, H, raw] = pvSize;
      const what = r < n && !s.lazy ? $t('Preview: drawing the frames, {p} %', { p: Math.floor(100 * r / Math.max(1, n)) })
        : raw ? (pw >= W ? $t('Preview: the frames of the video itself') : $t('Preview: the frames of the video itself, scaled to fit here (the video is {w} × {h})', { w: W, h: H }))
          : pw >= W ? $t('Preview: the frames of the video itself, lightly compressed') : $t('Preview: the frames of the video itself, scaled to fit here and lightly compressed (the video is {w} × {h})', { w: W, h: H });
      return !s.playing && !s.shown && reduced() ? `${what} · ${$t('Paused: reduced motion is on. Press Play to watch.')}` : what;
    };
    const pvBtnSet = (on) => { pvBtn.innerHTML = on ? ICON.pause : ICON.play; pvBtn.setAttribute('aria-label', on ? $t('Pause') : $t('Play')); pvBtn.title = on ? $t('Pause') : $t('Play'); };
    // the scrubber's value and its text for a screen reader (review vp-6): while it plays, the scrubber with focus
    // stands still (so a screen reader on it does not read out every frame), and its text changes at most once a second
    const pvAria = (i, now) => {
      const s = pv.state(), fps = s.fps || 30, t = pv.tOf(i), ms = performance.now();
      if (s.playing && !now && (document.activeElement === pvRange || ms - pvAriaAt < 1000)) return;
      pvAriaAt = ms;
      pvRange.setAttribute('aria-valuetext', $t('{a} s of {b} s, t = {t}', { a: num(i / fps, 1), b: num(s.n / fps, 1), t: t == null ? '' : num(t, 2) }));
    };
    const pv = makePreview(pvCv, {
      shown: (on) => { pvCv.hidden = !on; posterImg.hidden = on; pvNote.textContent = pvNoteText(); },
      playing: (on) => { pvBtnSet(on); pvNote.textContent = pvNoteText(); const s = pv.state(); if (s.id) { pvRange.value = String(s.i); pvAria(s.i, true); } },
      tick: (i) => {
        const s = pv.state(), fps = s.fps || 30, t = pv.tOf(i);
        pvTime.textContent = $t('{a} / {b} s', { a: num(i / fps, 1), b: num(s.n / fps, 1) });
        pvTt.data = t == null ? '' : ` = ${num(t, 2)}`;
        pvRange.max = String(Math.max(0, s.n - 1));
        if (!(s.playing && document.activeElement === pvRange)) pvRange.value = String(i);
        pvAria(i, !s.playing);
      },
      size: (pw, ph, W, H, raw) => { pvSize = [pw, ph, W, H, raw]; pvNote.textContent = pvNoteText(); },
      fill: (r, n) => { const was = pvFill[0] < pvFill[1]; pvFill = [r, n]; if (r === 0 || r === n || was && Math.floor(10 * r / n) !== Math.floor(10 * (r - 1) / n)) pvNote.textContent = pvNoteText(); },
      blocked: () => !!vRun,
    });
    // (the viewer's choice holds across option changes: paused stays paused)
    const pvToggle = () => { if (!pv.state().id) { pvWant = !pvWant; pvBtnSet(pvWant); return; } pv.toggle(); pvWant = pv.state().playing; };
    // (tests) the preview's state, the picture at a timeline index, the options the video would be made with
    st.preview = { state: () => pv.state(), frame: (i) => pv.frame(i), entry: (i) => pv.entry(i), note: () => pvNote.textContent, opts: () => opts({ video: Object.assign({}, vset) }) };
    // the picture's size: the stage's room at the video's aspect, the bar and the note under it (the poster and the
    // canvas the same, so nothing moves when the frames take over)
    const fitPv = (W, H) => {
      const aw = Math.max(160, scroll.clientWidth - 24), ah = Math.max(120, scroll.clientHeight - 44 - 16 - 62);
      const k = Math.min(aw / W, ah / H), w = Math.round(W * k), hh = Math.round(H * k);
      for (const el of [posterImg, pvCv]) { el.style.width = `${w}px`; el.style.height = `${hh}px`; el.style.maxHeight = 'none'; }
      pvBox.style.width = `${w}px`;
      return w;
    };
    let posterTok = 0, posterTimer = 0, extKnown = null, pvWH = null, pvKey = null;
    // (an option changed: the frames in view are stale; the preview stops, the poster dims until the new one is drawn)
    // (the bar is dimmed and says nothing of the old video; the button shows the wish: review vp-2)
    const posterSoon = () => {
      clearTimeout(posterTimer); pv.stop(); pvCv.hidden = true; posterImg.hidden = false; pvBox.classList.add('busy');
      pvBtnSet(pvWant); pvTime.textContent = ''; pvTt.data = ''; pvRange.max = '0'; pvRange.value = '0'; pvRange.removeAttribute('aria-valuetext');
      pvNote.textContent = pvSize ? $t('Preview: drawing the frames, {p} %', { p: 0 }) : '';
      posterTimer = setTimeout(poster, 150);
    };
    async function poster() {
      if (fmtOf() !== 'video' || closed) return;
      const my = ++posterTok;
      pvKey = JSON.stringify(vset);
      try {
        const plan = await videoPlan(opts({ video: vset, alive: () => my === posterTok && !closed }));
        if (!plan || my !== posterTok) return;
        const c = document.createElement('canvas'); c.width = plan.W; c.height = plan.H;
        const t = Math.max(0, Math.min(plan.m, A.defo().T));
        if (!(await videoFrame(plan, t, c.getContext('2d', { alpha: false }))) || my !== posterTok) return;
        const k = Math.min(1, 960 / plan.W), s2 = document.createElement('canvas');
        s2.width = Math.round(plan.W * k); s2.height = Math.round(plan.H * k);
        s2.getContext('2d').drawImage(c, 0, 0, s2.width, s2.height);
        c.width = 1; c.height = 1;
        await breathe();
        if (my !== posterTok || closed || fmtOf() !== 'video') return;
        posterImg.src = s2.toDataURL('image/png');
        pvWH = [plan.W, plan.H];
        const cssW = fitPv(plan.W, plan.H);
        const fr0 = plan.times.length;
        hint.textContent = $t('{w} × {h} · {fps} fps · {secs} s', { w: plan.W, h: plan.H, fps: vset.fps, secs: num(fr0 / vset.fps, 1) }) + (extKnown === 'webm' ? ' · WebM (VP9)' : '');
        wait.hidden = true; pvBox.classList.remove('busy'); pvBar.hidden = false;
        // the preview starts from the poster's frame, so the picture does not jump (review vp-4); paused with reduced
        // motion, only that frame is drawn until Play (review vp-5)
        let at = 0, best = Infinity;
        plan.times.forEach((e, i) => { if (typeof e === 'number' && Math.abs(e - t) < best - 1e-12) { best = Math.abs(e - t); at = i; } });
        pv.start(plan, { cssW, autoplay: pvWant, at, lazy: !pvWant && reduced() });
      } catch (e) { console.error(e); }
    }
    function updTex() {
      const f = fmtOf();
      texPre.textContent = fig ? latex(fig, capEdited, f, dpiOf()) : '';
      texNote.textContent = f === 'svg' ? $t('SVG in LaTeX needs the svg package and Inkscape (Overleaf has both). Google Docs cannot place SVG: use PNG there.') : f === 'png' ? $t('PNG at {dpi} dpi: the snippet sets its printed width.', { dpi: dpiOf() }) + (set.for === 'article' ? $t(' For a journal, PDF is better: it is vector.') : '') : $t('PDF: vector, no fonts, printed at its natural size.');
    }
    function syncFmt() {
      const f = fmtOf(), vid = f === 'video';
      for (const b of fmtSeg.children) b.setAttribute('aria-checked', String(b.dataset.v === f));
      dpiSel.hidden = f !== 'png';
      for (const r of [forRow, sizeRow, inkRow, capLangRow, deformRow, texRow, ftWrap]) if (r) r.hidden = vid;
      vidRow.hidden = !vid;
      scroll.classList.toggle('video', vid);
      greyBtn.hidden = vid; loupeBtn.hidden = vid; facts.hidden = vid;
      for (const b of [moreBtn, docsBtn, olBtn]) b.hidden = vid;
      vidBtn.hidden = !vid;
      dpiSel.value = String(dpiOf());
      // (the default name follows the figure until it is edited: export review r3, editor-2)
      if (!nameEdited) { nameInp.value = defaultName(view, deformOf(), f); fitName(); }
      // (the extension of the file a video will be: .mp4, or .webm where only VP9 can be encoded; video-5)
      extEl.textContent = vid ? `.${extKnown || 'mp4'}` : `.${f}`;
      if (vid && !extKnown && canVideo) { const [w0, h0] = VIDEO_SIZES[vset.size] || VIDEO_SIZES['1920x1080']; pickEncoder(w0, h0, vset.fps === 60 ? 60 : 30).then((pk) => { if (!pk || closed) return; extKnown = pk.mux; if (fmtOf() === 'video') extEl.textContent = `.${extKnown}`; }); }
      // (a preview of these very options keeps playing: after Save video or Cancel it is not drawn again)
      if (vid) { wait.hidden = !!posterImg.getAttribute('src'); if (!(pv.state().id && pvKey === JSON.stringify(vset))) posterSoon(); }
      else { clearTimeout(posterTimer); pv.stop(); if (fig) wait.hidden = true; updTex(); if (fig) hint.textContent = st.hintText || hint.textContent; }
    }
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
    let capTok = 0;
    const showCaption = async () => {
      if (!fig) return;
      const tex = capEdited != null ? capEdited : fig.captionTex;
      if (!tex || set.for === 'slides') { capBox.hidden = true; return; }
      // (the caption box is there at once, for a click; its picture follows when the words are typeset)
      capBox.hidden = false;
      const T = st.T || [8, 9, 9], my = ++capTok, f0 = fig;
      await warmCaption(tex, T[2], fig.lang);
      if (my !== capTok || f0 !== fig || closed) return;
      const c = captionSVG(tex, fig.W, T[2], fig.lang);
      capImg.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(c.svg);
      capImg.style.width = `${fig.W * 96 / 72}px`;
      updTex();
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
        // (the LaTeX box at once; the caption on the paper follows when its words are typeset)
        placePaper(); updTex(); showCaption();
        const T = st.T || [8, 9, 9];
        const tsz = set.text[set.for] || (set.for === 'article' ? 10 : 11);
        facts.innerHTML = '';
        // (Russian: centimetres, one decimal, GLOSSARY 3.8)
        const dims = uiLang() === 'en' || !I18 ? `${(f.W / 72).toFixed(2)} × ${(f.H / 72).toFixed(2)} in` : $t('{x} × {x2} in', { x: I18.num((f.W / 72 * 2.54).toFixed(1)), x2: I18.num((f.H / 72 * 2.54).toFixed(1)) });
        facts.append(h('b', null, dims), $t(' · labels {x}/{x2} pt, as in {tsz} pt text · {choice} · {choice2}', { x: I18 ? I18.num(T[0]) : T[0], x2: I18 ? I18.num(T[1]) : T[1], tsz, choice: f.ink === 'bw' ? $t('gray only') : $t('print color'), choice2: f.for === 'homework' ? $t('stays under its problem ([H])') : f.star ? $t('figure* across both columns') : $t('floats [tbp]') }));
        if (f.info && f.info.hiddenZP) facts.append(h('div', { class: 'xf-warn' }, $t('Most zeros and poles are on the far side of the sphere in these frames: turn the globe so they face you, then export again.')));
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
      const fmt = fmtOf(), dpi = dpiOf();
      A.copyText(latex(fig, capEdited, fmt, dpi));
      olBtn.disabled = true; olBtn.textContent = fmt === 'pdf' ? $t('Making the PDF…') : $t('Making the file…');
      try {
        const f = await full();
        if (!f) return;
        // (a declined or refused save: no "Saved", no hint, and it is not remembered as the last destination)
        const file = `${f.name}.${fmt}`;
        if (await A.saveFile(file, fmt === 'png' ? await png(f, dpi) : fmt === 'svg' ? svgBlob(f) : await pdf(f)) === false) return;
        set.last = set.lastFig = { kind: 'overleaf', fmt, dpi }; saveSet(set);
        done(olBtn, $t('✓ Saved · LaTeX copied'));
        after2.hidden = false;
        after2.textContent = $t("First time only: drop {name}.pdf into Overleaf's file tree, then paste. {choice}", { name: f.name, choice: f.for === 'homework' ? $t('The snippet keeps the figure under your solution and shrinks it only if your page is narrower.') : $t('The snippet includes the figure at its natural size, so its labels match your text.') }).replace(`${f.name}.pdf`, file);
      } catch (e) { console.error(e); cueError(); toast(fmt === 'pdf' ? $t('The PDF could not be made here; try More formats → SVG.') : $t('The figure could not be saved.')); }
      finally { olBtn.disabled = false; if (!olBtn.classList.contains('done')) sync(); }
    });
    docsBtn.addEventListener('click', async () => {
      if (!fig) return;
      docsBtn.disabled = true; docsBtn.textContent = $t('Copying…');
      try {
        const f = await full({ capInImage: set.for !== 'slides' });
        if (!f) return;
        const how = await copyImage(f);
        if (how) { set.last = set.lastFig = { kind: 'docs', fmt: 'png' }; saveSet(set); done(docsBtn, $t('✓ Copied · paste it')); cueDone(); }
        else if (await A.saveFile(`${f.name}.png`, await png(f, 300)) !== false) { set.last = set.lastFig = { kind: 'docs', fmt: 'png' }; saveSet(set); done(docsBtn, $t('✓ Saved PNG')); }
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
        else if (fmt === 'tex') ok = await A.saveFile(`${f.name}-latex.txt`, latex(f, capEdited, fmtOf(), dpiOf()));
        if (ok !== false) { set.last = set.lastFig = { kind: 'save', fmt, dpi }; saveSet(set); }
      } catch (e) { console.error(e); cueError(); toast(fmt === 'pdf' ? $t('The PDF could not be made here; try SVG.') : $t('The figure could not be saved.')); }
    };
    moreBtn.addEventListener('click', () => {
      A.openMenu(moreBtn, [
        { label: 'PDF', key: $tx('format', 'vector'), run: () => saveAs('pdf') },
        { label: 'SVG', key: $tx('format', 'vector'), run: () => saveAs('svg') },
        { label: 'PNG · 300 dpi', key: $tx('format', 'image'), run: () => saveAs('png', 300) },
        { label: 'PNG · 600 dpi', key: $tx('format', 'image'), run: () => saveAs('png', 600) },
        'sep',
        { label: $t('Copy LaTeX only'), run: () => { if (fig) { A.copyText(latex(fig, capEdited, fmtOf(), dpiOf())); set.last = set.lastFig = { kind: 'latex', fmt: fmtOf(), dpi: dpiOf() }; saveSet(set); toast($t('LaTeX copied.')); cueDone(); } } },
        { label: $t('Save LaTeX (.txt)'), run: () => saveAs('tex') },
        { label: $t('Copy image'), run: () => docsBtn.click() },
      ]);
    });
    let vRun = null;
    cancelBtn.addEventListener('click', () => { if (vRun) vRun.cancel = true; });
    // (while a video is made its options are locked: the plan is fixed at the start; the progress takes the name row's
    // place, so the dialog does not move; the screen reader hears the start, every quarter and the end)
    const running = (on) => {
      nameLab.hidden = on; prog.hidden = !on;
      for (const el of vidBox.querySelectorAll('button, select, input')) el.disabled = on;
      for (const b of fmtSeg.children) b.disabled = on || (b.dataset.v === 'video' && !canVideo);
    };
    const onVis = () => { if (vRun && document.hidden) vRun.hid = true; else if (vRun && vRun.hid) { vRun.hid = false; toast($t('Keep this tab in front while the video is made: a hidden tab can slow it down.')); } };
    document.addEventListener('visibilitychange', onVis);
    vidBtn.addEventListener('click', async () => {
      if (vRun) return;
      const run = vRun = { cancel: false, q: -1 };
      vidBtn.disabled = true; running(true); meter.style.width = '0%'; meterEl.setAttribute('aria-valuenow', '0'); progTxt.textContent = $t('Preparing…'); progSr.textContent = $t('Making the video');
      try {
        const r = await makeVideo(opts({ video: vset, alive: () => !closed && !run.cancel }), { cancelled: () => closed || run.cancel, progress: (i, n) => {
          const pc = 100 * i / n, q = Math.floor(pc / 25);
          meter.style.width = `${pc.toFixed(1)}%`; meterEl.setAttribute('aria-valuenow', String(Math.round(pc))); progTxt.textContent = $t('Frame {i} of {n}', { i, n });
          if (q !== run.q && q < 4) { run.q = q; if (q > 0) progSr.textContent = $t('{p} % done', { p: q * 25 }); }
        } });
        if (!r) { if (!closed) toast($t('The video was cancelled.')); return; }
        progTxt.textContent = $t('Saving…');
        if (await A.saveFile(`${r.name}.${r.ext}`, r.blob) === false) return;
        set.last = { kind: 'video', fmt: r.ext }; saveSet(set);
        progSr.textContent = $t('The video is saved.');
        st.video = { frames: r.frames, fps: r.fps, codec: r.codec, ext: r.ext, W: r.W, H: r.H, bytes: r.blob.size, ms: r.ms };
        done(vidBtn, $t('✓ Saved'));
        after2.hidden = false;
        after2.textContent = $t('{w} × {h}, {fps} fps, {secs} s, {codec} ({ext}).', { w: r.W, h: r.H, fps: r.fps, secs: I18 ? I18.num(r.secs.toFixed(1)) : r.secs.toFixed(1), codec: /^avc1/.test(r.codec) ? 'H.264' : /^vp09/.test(r.codec) ? 'VP9' : 'VP8', ext: r.ext.toUpperCase() });
      } catch (e) { console.error(e); cueError(); toast(/WebCodecs/.test(String(e && e.message)) ? $t('This browser cannot encode video. Try a recent Chrome, Edge or Safari.') : $t('The video could not be made here.')); }
      finally { vRun = null; vidBtn.disabled = false; running(false); if (!vidBtn.classList.contains('done')) syncFmt(); }
    });
    let rz = 0;
    const onResize = () => { clearTimeout(rz); rz = setTimeout(() => { placePaper(); if (pvWH && fmtOf() === 'video') pv.resize(fitPv(pvWH[0], pvWH[1])); }, 60); }; // (bigger: sharper frames; review vp-3)
    window.addEventListener('resize', onResize);
    // (a sharper screen with the same window, such as a move to a retina monitor: devicePixelRatio changes and no
    // 'resize' may come, so its media query is watched too, re-armed for each new ratio; review-video-preview-verify vp-3)
    let dq = null;
    const onDpr = () => { onResize(); armDpr(); };
    const armDpr = () => { try { if (dq) dq.removeEventListener('change', onDpr); dq = matchMedia(`(resolution: ${window.devicePixelRatio || 1}dppx)`); dq.addEventListener('change', onDpr); } catch (e) { dq = null; } };
    armDpr();
    const obs = new MutationObserver(() => { if (!bg.isConnected) { pv.stop(); window.removeEventListener('resize', onResize); if (dq) dq.removeEventListener('change', onDpr); document.removeEventListener('visibilitychange', onVis); obs.disconnect(); } });
    obs.observe(document.body, { childList: true });
    sync();
    olBtn.focus({ preventScroll: true });
    setTimeout(rebuild, 30);
    pdfLib();
  }
  // the export menu's Copy figure again / Save figure again: the last destination, with the remembered settings
  async function again(what) {
    const set = loadSet();
    // (after a video: Save opens the dialog on Video, with its progress and Cancel, while the deformation is on; else,
    // and for Copy, the last figure is made again; export review r3, video-3)
    if (set.last && set.last.kind === 'video' && what === 'save' && defoOf(A.viewKind()) && typeof VideoEncoder !== 'undefined') { set.fmt = 'video'; saveSet(set); open(); return true; }
    const last = set.last && set.last.kind !== 'video' ? set.last : set.lastFig || { kind: 'overleaf', fmt: 'pdf' };
    if (set.last && set.last.kind === 'video' && set.fmt === 'video') set.fmt = last.fmt === 'png' || last.fmt === 'svg' ? last.fmt : 'pdf';
    const f = await build(optsOf(set, { capInImage: what === 'copy' && last.kind === 'docs' }));
    if (!f) return false;
    if (what === 'copy') {
      if (last.kind === 'docs') { const how = await copyImage(f); if (!how) { if (await A.saveFile(`${f.name}.png`, await png(f, 300)) !== false) A.toast($t('Saved {name}.png (the image could not be copied here).', { name: f.name })); } else { A.toast($t('Figure copied as an image.')); cueDone(); } }
      else { await A.copyText(latex(f, null, last.fmt === 'png' || last.fmt === 'svg' ? last.fmt : 'pdf', last.dpi || 300)); A.toast($t('Figure LaTeX copied.')); cueDone(); }
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
    makeVideo, videoCheck, videoScreenCheck, videoTimes, muxMP4, muxWebM, previewStats: () => Object.assign({}, pvStats), defoOf: (v) => defoOf(v || (A && A.viewKind())), shortCaption,
    settings: loadSet, saveSettings: saveSet, sizes: SIZES, presets: PRESET,
    dialog: () => dlg, last: () => lastFig, segsOf, plainOf, XD,
    geom: { senseAt, chevronAt, fitBox },
  };
})();
