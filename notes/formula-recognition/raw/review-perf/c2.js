const out = {};
setBase('http://localhost:9024/after/');
for (const [w, h, mob] of [[1440, 900, false], [390, 844, true]]) {
  for (const lang of ['en', 'ru']) {
    await view(w, h, false, mob);
    const ns = 'rpn' + w + lang + Date.now();
    await load(ns, { shapes: [{ id: 's1', kind: 'rect', a: [-1.5, -1.2], b: [1.5, 1.2] }], steps: [{ type: 'custom', params: { expr: '\\frac{1}{2i}\\log\\frac{1+iz}{1-iz}', cut: 180 }, on: true }], pattern: 'checker' });
    await nav('http://localhost:9024/after/test.html?ns=' + ns + '&lang=' + lang); await sleep(2200);
    const r = await ev(`(() => { const e = document.querySelector('.inote'); if (!e) return null; const b = e.getBoundingClientRect(); return { text: e.textContent, x: Math.round(b.left), y: Math.round(b.top), w: Math.round(b.width), h: Math.round(b.height), vis: b.width > 0 && b.height > 0, sw: document.documentElement.scrollWidth }; })()`);
    out[w + lang] = r;
    if (r && r.vis) out[w + lang].shot = await shot('note_' + w + '_' + lang, { x: Math.max(0, r.x - 20), y: Math.max(0, r.y - 120), width: Math.min(w, r.w + 40), height: r.h + 140 });
  }
}
return out;
