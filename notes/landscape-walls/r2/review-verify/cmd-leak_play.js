const out = { tex: [], play: [], errs: [] };
await send('Page.addScriptToEvaluateOnNewDocument', { source: `(() => { const P = WebGL2RenderingContext.prototype; const live = new Set(); let bytes = new Map(); window.__tc = { live, bytes };
  const ct = P.createTexture, dt = P.deleteTexture, cb = P.createBuffer, db = P.deleteBuffer, ts = P.texStorage2D, ti = P.texImage2D, bd = P.bufferData, bt = P.bindTexture, bb = P.bindBuffer;
  const cur = new Map(); const curB = new Map();
  P.createTexture = function () { const t = ct.call(this); live.add(t); return t; };
  P.deleteTexture = function (t) { live.delete(t); bytes.delete(t); return dt.call(this, t); };
  P.createBuffer = function () { const t = cb.call(this); live.add(t); return t; };
  P.deleteBuffer = function (t) { live.delete(t); bytes.delete(t); return db.call(this, t); };
  P.bindTexture = function (tg, t) { cur.set(this.getParameter(this.ACTIVE_TEXTURE) + ':' + tg, t); return bt.call(this, tg, t); };
  P.bindBuffer = function (tg, b) { curB.set(tg, b); return bb.call(this, tg, b); };
  const bpp = (fmt) => ({ 0x8814: 16, 0x8D70: 16, 0x822E: 4, 0x8230: 8, 0x8058: 4, 0x881A: 8, 0x822D: 2, 0x8229: 1 }[fmt] || 4);
  P.texStorage2D = function (tg, lv, fmt, w, h) { const t = cur.get(this.getParameter(this.ACTIVE_TEXTURE) + ':' + tg); if (t) bytes.set(t, w * h * bpp(fmt)); return ts.apply(this, arguments); };
  P.texImage2D = function (tg, lv, fmt, w, h) { if (arguments.length >= 8 && typeof w === 'number' && lv === 0) { const t = cur.get(this.getParameter(this.ACTIVE_TEXTURE) + ':' + tg); if (t) bytes.set(t, w * h * bpp(fmt)); } return ti.apply(this, arguments); };
  P.bufferData = function (tg, sz) { const b = curB.get(tg); if (b) bytes.set(b, typeof sz === 'number' ? sz : (sz && sz.byteLength) || 0); return bd.apply(this, arguments); };
})();` });
const TC = '(() => { let s = 0; for (const t of __tc.live) s += (__tc.bytes.get(t) || 0); return { n: __tc.live.size, MB: +(s / 1048576).toFixed(1) }; })()';
await view(1440, 900, false, false);
await openCase('test.html', { meshN: 240, steps: [sq, sn], sheets: true, height: 'im' }, 0.2);
await settle(2500); out.tex.push(['user AllSh t=0.2 rest', await ev(TC)]);
const r = await paneRect();
await ev('__cmwMorph({ T: 0, playing: true })');
for (let i = 0; i < 4; i++) { await sleep(700); await shot(`play-allsh-m240-${i}`, r); out.play.push((await ev('__cmwMorph({})')).T); }
await sleep(3000); out.tex.push(['after 6 s play', await ev(TC)]);
await sleep(6000); out.tex.push(['after 12 s play', await ev(TC)]);
await ev('__cmwMorph({ playing: false })'); await settle(3000); out.tex.push(['stopped', await ev(TC)]);
for (let i = 0; i < 3; i++) { await ev(`__cmwSet('meshN', 1920)`); await settle(4000); out.tex.push([`mesh Max ${i}`, await ev(TC)]); await ev(`__cmwSet('meshN', 240)`); await settle(4000); out.tex.push([`mesh default ${i}`, await ev(TC)]); }
for (let i = 0; i < 4; i++) { await ev(`__cmwMorph({ T: ${0.3 + 0.1 * i} })`); await settle(2500); out.tex.push([`T=${0.3 + 0.1 * i} rest`, await ev(TC)]); }
await ev(`__cmwSet('sheets', false)`); await ev(`__cmwSet('meshN', 1920)`); await settle(3000); await ev('__cmwMorph({ T: 0, playing: true })');
for (let i = 0; i < 3; i++) { await sleep(700); await shot(`play-princ-m1920-${i}`, r); }
await sleep(5000); out.tex.push(['principal Max after 7 s play', await ev(TC)]);
await ev('__cmwMorph({ playing: false })'); await settle(3000); out.tex.push(['principal Max stopped', await ev(TC)]);
const l = logs().filter((x) => x.t === 'EXC' || x.t === 'error' || /warn/i.test(x.t) || /GL_|WebGL/.test(x.m)); if (l.length) out.errs.push(l.slice(0, 6));
return out;
