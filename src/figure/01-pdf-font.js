  // ---------- the figure PDF's text layer font ----------
  // The invisible text layer (XD.pdf) is set in a font the PDF embeds, so that no font in it is left unembedded (journal
  // preflights reject one, the standard 14 included). Its glyphs are empty (the words are drawn in render mode 3, never
  // seen), so the font is a few hundred bytes: a TrueType font of exactly the characters the layer holds, built for each
  // PDF from them (sorted, so the same characters give the same bytes). jsPDF embeds it as a CID font with a ToUnicode
  // map, through which a PDF reader's search and copy read the words back.
  // The advance widths (1000 units an em) of printable ASCII, U+0020 to U+007E, are Helvetica's, from Adobe's freely
  // distributed AFM metrics, so a word spans the width it would in Helvetica; other characters take PDF_TEXT_FONT_WIDE and
  // the combining marks (U+0300 to U+036F) none.
  const PDF_TEXT_FONT_ASCII = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556,
    556, 556, 556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778,
    722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833,
    556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
  const PDF_TEXT_FONT_FIRST = 0x20, PDF_TEXT_FONT_WIDE = 556, PDF_TEXT_FONT_UPM = 1000, PDF_TEXT_FONT_ASCENT = 900, PDF_TEXT_FONT_DESCENT = -200;
  // the font's family name in the PDF
  const PDF_TEXT_FONT_NAME = 'CMWTextLayer';
  // (big-endian bytes of unsigned and signed 16-bit and unsigned 32-bit values)
  const u16 = (n) => [(n >> 8) & 255, n & 255], s16 = (n) => u16(n < 0 ? n + 65536 : n), u32 = (n) => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255];
  // a character's advance width
  const pdfTextWidth = (c) => (c >= PDF_TEXT_FONT_FIRST && c < PDF_TEXT_FONT_FIRST + PDF_TEXT_FONT_ASCII.length ? PDF_TEXT_FONT_ASCII[c - PDF_TEXT_FONT_FIRST]
    : c >= 0x300 && c <= 0x36f ? 0 : PDF_TEXT_FONT_WIDE);
  // pdfTextFont(codes): the font file, base64, for the code points codes (the Basic Multilingual Plane's, U+0020 and up,
  // sorted and without repeats): glyph i + 1 is codes[i]. Its tables: head, hhea, maxp, hmtx, loca, glyf (empty), cmap
  // (format 4, a segment per run of consecutive codes), name, post and OS/2
  const pdfTextFont = (codes) => {
    const n = codes.length + 1, W = codes.map(pdfTextWidth), asc = PDF_TEXT_FONT_ASCENT, desc = PDF_TEXT_FONT_DESCENT;
    const maxW = Math.max(PDF_TEXT_FONT_WIDE, ...W), zeros = (k) => new Array(k).fill(0);
    const name = (() => {
      // (the family, the subfamily, the full and the PostScript names, in UTF-16BE for Windows Unicode, English)
      const recs = /** @type {[number, string][]} */ ([[1, PDF_TEXT_FONT_NAME], [2, 'Regular'], [4, PDF_TEXT_FONT_NAME], [6, PDF_TEXT_FONT_NAME]]).map(([id, str]) => ({ id, b: [...str].flatMap((c) => u16(c.charCodeAt(0))) }));
      let off = 0;
      const dir = recs.flatMap((r) => { const e = [...u16(3), ...u16(1), ...u16(0x409), ...u16(r.id), ...u16(r.b.length), ...u16(off)]; off += r.b.length; return e; });
      return [...u16(0), ...u16(recs.length), ...u16(6 + 12 * recs.length), ...dir, ...recs.flatMap((r) => r.b)];
    })();
    // (cmap format 4: a segment [first, last] per run of consecutive codes, its glyphs by idDelta, then the closing 0xFFFF)
    const segs = [];
    codes.forEach((c, i) => { const s = segs[segs.length - 1]; if (s && c === s[1] + 1) s[1] = c; else segs.push([c, c, (i + 1 - c + 65536) % 65536]); });
    segs.push([0xffff, 0xffff, 1]);
    const sr = 2 * 2 ** Math.floor(Math.log2(segs.length));
    const sub = [...u16(4), ...u16(16 + 8 * segs.length), ...u16(0), ...u16(2 * segs.length), ...u16(sr), ...u16(Math.log2(sr / 2)), ...u16(2 * segs.length - sr),
      ...segs.flatMap((s) => u16(s[1])), ...u16(0), ...segs.flatMap((s) => u16(s[0])), ...segs.flatMap((s) => u16(s[2])), ...segs.flatMap(() => u16(0))];
    const first = codes.length ? codes[0] : PDF_TEXT_FONT_FIRST, last = codes.length ? codes[codes.length - 1] : PDF_TEXT_FONT_FIRST;
    const tables = {
      'OS/2': [...u16(3), ...s16(500), ...u16(400), ...u16(5), ...u16(0), ...zeros(20), ...s16(0), ...zeros(10), ...u32(1), ...zeros(12), ...[...'CMW '].map((c) => c.charCodeAt(0)), ...u16(0x40),
        ...u16(first), ...u16(last), ...s16(asc), ...s16(desc), ...s16(0), ...u16(asc), ...u16(-desc), ...u32(1), ...u32(0), ...s16(500), ...s16(700), ...u16(0), ...u16(PDF_TEXT_FONT_FIRST), ...u16(0)],
      cmap: [...u16(0), ...u16(1), ...u16(3), ...u16(1), ...u32(12), ...sub],
      glyf: [],
      head: [...u32(0x00010000), ...u32(0x00010000), ...u32(0), ...u32(0x5F0F3CF5), ...u16(0x000B), ...u16(PDF_TEXT_FONT_UPM), ...zeros(16), ...s16(0), ...s16(desc), ...s16(maxW), ...s16(asc), ...u16(0), ...u16(8), ...s16(2), ...s16(0), ...s16(0)],
      hhea: [...u32(0x00010000), ...s16(asc), ...s16(desc), ...s16(0), ...u16(maxW), ...s16(0), ...s16(0), ...s16(maxW), ...s16(1), ...s16(0), ...s16(0), ...zeros(8), ...s16(0), ...u16(n)],
      hmtx: [...u16(PDF_TEXT_FONT_WIDE), ...s16(0), ...W.flatMap((w) => [...u16(w), ...s16(0)])],
      loca: zeros(2 * (n + 1)),
      maxp: [...u32(0x00010000), ...u16(n), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u16(1), ...zeros(16)],
      name,
      post: [...u32(0x00030000), ...u32(0), ...s16(-100), ...s16(50), ...zeros(20)],
    };
    const tags = Object.keys(tables).sort(), padded = (b) => b.concat(zeros((4 - (b.length % 4)) % 4));
    const sum = (b) => { const p = padded(b); let s = 0; for (let i = 0; i < p.length; i += 4) s = (s + ((p[i] << 24) | (p[i + 1] << 16) | (p[i + 2] << 8) | p[i + 3])) >>> 0; return s; };
    const nt = tags.length, esr = 16 * 2 ** Math.floor(Math.log2(nt));
    let off = 12 + 16 * nt;
    const dir = [], body = [];
    for (const t of tags) { const b = tables[t]; dir.push(...[...t.padEnd(4)].map((c) => c.charCodeAt(0)), ...u32(sum(b)), ...u32(off), ...u32(b.length)); body.push(...padded(b)); off += padded(b).length; }
    const font = [...u32(0x00010000), ...u16(nt), ...u16(esr), ...u16(Math.log2(esr / 16)), ...u16(nt * 16 - esr), ...dir, ...body];
    // (head's checkSumAdjustment: 0xB1B0AFBA less the whole font's sum)
    const at = 12 + 16 * nt + tags.slice(0, tags.indexOf('head')).reduce((a, t) => a + padded(tables[t]).length, 0) + 8;
    u32((0xB1B0AFBA - sum(font)) >>> 0).forEach((v, i) => { font[at + i] = v; });
    let bin = '';
    for (const b of font) bin += String.fromCharCode(b);
    return btoa(bin);
  };
  // the text layer's strings as the font can set them: each label's text, NFC, with the characters outside the Basic
  // Multilingual Plane and the controls left out; and the code points they use, sorted. -> { strings, codes }
  const pdfTextLayer = (texts) => {
    const strings = texts.map((q) => [...q.text.normalize('NFC')].filter((ch) => { const c = ch.codePointAt(0); return c >= PDF_TEXT_FONT_FIRST && c < 0xfffe && !(c >= 0xd800 && c <= 0xdfff) && !(c >= 0x7f && c < 0xa0); }).join(''));
    const codes = [...new Set(strings.join(''))].map((ch) => ch.codePointAt(0)).sort((a, b) => a - b);
    return { strings, codes };
  };
