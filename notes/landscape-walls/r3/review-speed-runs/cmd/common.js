const PORT = 9843;
const settle = async (ms = 700) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const ld = async (page, ns, st) => {
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/gl-helpers.html` }); await sleep(400);
  const o = Object.assign({ v3: true, v4: true, shapes: [], steps: [], nextId: 50, focus: 0, rightMode: 'image' }, st);
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${page}?ns=${ns}` }); await sleep(2200);
};
const sq = { type: 'root', params: { n: 2, cut: 180 }, on: true }, sn = { type: 'sin', params: {}, on: true };
const GAPON = `(() => { window.__gap = { gaps: [], last: performance.now(), t0: performance.now(), on: true, n50: 0 }; const f = () => { const t = performance.now(); const d = t - __gap.last; if (d > 50) __gap.n50++; if (d > 100) __gap.gaps.push([Math.round(__gap.last - __gap.t0), Math.round(d)]); __gap.last = t; if (__gap.on) requestAnimationFrame(f); }; requestAnimationFrame(f); return 1; })()`;
const RECT = `(() => { const e = document.querySelector('#paneL') || document.querySelector('.pane'); const b = e.getBoundingClientRect(); return { x: Math.round(b.left + b.width * 0.3), y: Math.round(b.top + b.height * 0.3), width: Math.round(b.width * 0.4), height: Math.round(b.height * 0.4) }; })()`;
const firstSurface = (frames) => { const fin = frames[frames.length - 1].img; for (const fr of frames) { let same = 0, n = 0; for (let i = 0; i < fin.data.length; i += fin.ch * 7) { n++; if (Math.abs(fr.img.data[i] - fin.data[i]) <= 6 && Math.abs(fr.img.data[i + 1] - fin.data[i + 1]) <= 6 && Math.abs(fr.img.data[i + 2] - fin.data[i + 2]) <= 6) same++; } if (same / n >= 0.9) return fr.te; } return null; };
