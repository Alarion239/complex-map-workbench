window.__peek = (side='R', x=0, y=0, w=null, h=null) => {
  document.getElementById('__pk')?.remove();
  if (side === null) return 'removed';
  const a = document.getElementById('canvas'+side), b = document.getElementById('overlay'+side);
  w = w ?? a.width; h = h ?? a.height;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(a, x, y, w, h, 0, 0, w, h); g.drawImage(b, x, y, w, h, 0, 0, w, h);
  const d = document.createElement('div'); d.id='__pk';
  d.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#888;display:flex;align-items:center;justify-content:center';
  const s = Math.min(innerWidth / w, innerHeight / h);
  c.style.cssText = `width:${w*s}px;height:${h*s}px;image-rendering:pixelated`;
  d.appendChild(c); document.body.appendChild(d); return [w,h,s];
};
window.__snaps = [];
window.__snap = (k, x=0, y=0, w=820, h=1032) => { const a = document.getElementById('canvasR'), b = document.getElementById('overlayR'); const c = document.createElement('canvas'); c.width=w; c.height=h; const g=c.getContext('2d'); g.drawImage(a,x,y,w,h,0,0,w,h); g.drawImage(b,x,y,w,h,0,0,w,h); __snaps[k]=c; return k; };
window.__showSnaps = () => { document.getElementById('__pk')?.remove(); const d = document.createElement('div'); d.id='__pk'; d.style.cssText='position:fixed;inset:0;z-index:99999;background:#888;display:flex;flex-wrap:wrap;gap:4px;align-items:center;justify-content:center'; const L=__snaps.filter(Boolean); const n=L.length; const cols = n<=2?n:Math.ceil(n/2), rows = n<=2?1:2; for (const c of L) { const s=Math.min((innerWidth-8*cols)/cols/c.width, (innerHeight-8*rows)/rows/c.height); c.style.cssText=`width:${c.width*s}px;height:${c.height*s}px`; d.appendChild(c);} document.body.appendChild(d); return n; };
window.__key = (k) => document.dispatchEvent(new KeyboardEvent('keydown', {key:k, bubbles:true}));
window.__wait = (ms) => new Promise(r=>setTimeout(r,ms));
window.__theme = async (want) => { for (let i=0;i<4;i++){ const t = document.documentElement.getAttribute('data-theme') || 'auto'; if (t===want) break; document.getElementById('themeBtn').click(); await __wait(450); } await __wait(500); const px=[...document.getElementById('canvasR').getContext('2d').getImageData(10,10,1,1).data].slice(0,3); return (document.documentElement.getAttribute('data-theme') || 'auto') + ' ' + px; };
'helpers ok'
// scripted drag on #overlayR, one pointermove per animation frame; returns frame-interval stats (ms)
window.__drag = async (ms = 1500, dx = 3, dy = 1, opts = {}) => {
  const o = document.getElementById(opts.id || 'overlayR'); const r = o.getBoundingClientRect();
  let x = r.x + r.width * 0.5, y = r.y + r.height * 0.5;
  // synthetic pointers are not 'active': let the app's setPointerCapture through
  o.setPointerCapture = () => {}; o.releasePointerCapture = () => {}; o.hasPointerCapture = () => true;
  const ev = (type) => o.dispatchEvent(new PointerEvent(type, { clientX: x, clientY: y, bubbles: true, pointerId: 7, pointerType: 'mouse', button: 0, buttons: type === 'pointerup' ? 0 : 1, shiftKey: !!opts.shift }));
  ev('pointerdown');
  const ts = [], work = [];
  const t0 = performance.now();
  let k = 0;
  await new Promise((done) => {
    const step = (t) => {
      ts.push(t);
      const w0 = performance.now();
      k++; const s = (k % 120) < 60 ? 1 : -1; x += dx * s; y += dy * s; ev('pointermove');
      work.push(performance.now() - w0);
      if (performance.now() - t0 < ms) requestAnimationFrame(step); else done();
    };
    requestAnimationFrame(step);
  });
  ev('pointerup');
  delete o.setPointerCapture; delete o.releasePointerCapture; delete o.hasPointerCapture;
  const iv = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
  const q = (p) => iv[Math.min(iv.length - 1, Math.floor(p * iv.length))];
  return { frames: iv.length, fps: +(1000 / (iv.reduce((s, v) => s + v, 0) / iv.length)).toFixed(1), p50: +q(0.5).toFixed(2), p95: +q(0.95).toFixed(2), max: +iv[iv.length - 1].toFixed(2) };
};
// time from a mode key press to the end of the next two frames
window.__modeSwitch = async (key) => {
  const t0 = performance.now(); __key(key);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  return +(performance.now() - t0).toFixed(1);
};
