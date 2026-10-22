'use strict';
// Minimal PNG encode/decode (8-bit RGBA / RGB / gray, non-interlaced) with no dependencies.
const zlib = require('zlib');

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
// rgba: Uint8Array/Buffer of w*h*4
function encode(w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const st = w * 4, raw = Buffer.alloc((st + 1) * h);
  for (let y = 0; y < h; y++) {
    // filter 1 (sub): compact and deterministic
    const o = y * (st + 1), r = y * st;
    raw[o] = 1;
    for (let x = 0; x < st; x++) raw[o + 1 + x] = (rgba[r + x] - (x >= 4 ? rgba[r + x - 4] : 0)) & 255;
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}
// -> {w, h, data: RGBA Buffer}
function decode(buf) {
  let p = 8, w = 0, h = 0, ct = 0, bd = 8;
  const idat = [];
  while (p < buf.length) {
    const len = buf.readUInt32BE(p), type = buf.toString('ascii', p + 4, p + 8), d = buf.subarray(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); bd = d[8]; ct = d[9]; if (d[12]) throw new Error('interlaced PNG not supported'); }
    else if (type === 'IDAT') idat.push(d);
    else if (type === 'IEND') break;
    p += 12 + len;
  }
  if (bd !== 8) throw new Error('only 8-bit PNG supported');
  const ch = ct === 6 ? 4 : ct === 2 ? 3 : ct === 4 ? 2 : ct === 0 ? 1 : 0;
  if (!ch) throw new Error('unsupported PNG color type ' + ct);
  const raw = zlib.inflateSync(Buffer.concat(idat)), st = w * ch, out = Buffer.alloc(w * h * ch);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (st + 1)], s = y * (st + 1) + 1, o = y * st;
    for (let x = 0; x < st; x++) {
      const a = x >= ch ? out[o + x - ch] : 0, b = y ? out[o - st + x] : 0, c = x >= ch && y ? out[o - st + x - ch] : 0;
      let v = raw[s + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      out[o + x] = v & 255;
    }
  }
  if (ch === 4) return { w, h, data: out };
  const rgba = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const g = ch <= 2;
    rgba[4 * i] = out[i * ch]; rgba[4 * i + 1] = out[i * ch + (g ? 0 : 1)]; rgba[4 * i + 2] = out[i * ch + (g ? 0 : 2)];
    rgba[4 * i + 3] = ch === 2 ? out[i * ch + 1] : 255;
  }
  return { w, h, data: rgba };
}
module.exports = { encode, decode };
