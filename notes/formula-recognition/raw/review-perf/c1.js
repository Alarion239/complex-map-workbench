const out = {};
const shapes = [{ id: 's1', kind: 'rect', a: [-1.5, -1.2], b: [1.5, 1.2] }, { id: 's2', kind: 'cgrid', a: [-1.5, -1.2], b: [1.5, 1.2], n: 6 }];
const scenes = [
  { id: 'zi', expr: 'z^{i}', type: true },
  { id: 'rat12a', expr: '\\frac{(z+a)^{12}}{(z-a)^{12}}', a: 0.7, amp: 0.2 },
  { id: 'rat20', expr: '\\frac{(z+1)^{20}}{(z-1)^{20}}', type: true },
  { id: 'z2az', expr: 'z^{2}+az', a: 0, amp: 0.3 },
  { id: 'jka', expr: '\\frac{z^2-a}{z+1}', a: 1, amp: 0.3 },
  { id: 'mob_a', expr: '\\frac{az+1}{z+a}', a: 0.5, amp: 0.3 },
];
for (const BASE of ['http://localhost:9024/before/', 'http://localhost:9024/after/']) {
  setBase(BASE);
  await view(1440, 900, false);
  for (const sc of scenes) {
    const r = {};
    try {
      const params = sc.a != null ? [{ name: 'a', value: sc.a, min: -3, max: 3, step: 0.01 }] : undefined;
      await load('rp' + sc.id + Date.now(), Object.assign({ shapes, steps: [{ type: 'custom', params: { expr: sc.expr, cut: 180 }, on: true }], pattern: 'checker', srcView: { cx: 0, cy: 0, s: 80 } }, params ? { params } : {}));
      await sleep(800);
      r.paths = await ev('__cmwPaths().map((p) => p.role + p.id + ":" + p.path).join(" ")');
      r.note = await ev('(() => { const e = document.querySelector(".inote"); return e ? e.textContent : null; })()');
      r.lamps = await ev('__qa.lamps()');
      if (sc.a != null) {
        for (const morph of [false, true]) {
          if (morph) { await ev('__cmwMorph({ open: true, T: 0.5, playing: false })'); await sleep(700); }
          const res = await ev(`await (async () => {
            const lt = []; let po = null; try { po = new PerformanceObserver((l) => { for (const e of l.getEntries()) lt.push(Math.round(e.duration)); }); po.observe({ type: 'longtask' }); } catch (e) {}
            const fr = __qa.frames(1600); const t0 = performance.now(); const js = []; const seen = new Set();
            await new Promise((res) => { const f = () => { const u = (performance.now() - t0) / 1600; const v = Math.round((${sc.a} + ${sc.amp} * Math.sin(u * 2 * Math.PI)) * 100) / 100; const s = performance.now(); Params.set('a', v); js.push(performance.now() - s); const pth = __cmwPaths().map((p) => p.path).join(','); seen.add(pth + '|' + ((document.querySelector('.inote')||{}).textContent||'').slice(0,40)); if (u < 1) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
            const F = await fr; if (po) po.disconnect(); js.sort((a, b) => a - b);
            return { frames: F, setMs: { p50: +js[js.length >> 1].toFixed(2), max: +js[js.length - 1].toFixed(2) }, longtasks: lt, states: [...seen] };
          })()`, 40000);
          r[morph ? 'dragMorph' : 'drag'] = res;
        }
        await ev('__cmwMorph({ playing: false, open: false })');
      }
      if (sc.type) {
        // typing: set the expression field to each prefix, as keystrokes would
        r.typing = await ev(`await (async () => {
          const inp = document.querySelector('[data-pkey="expr"]'); if (!inp) return 'no input';
          const full = ${JSON.stringify(sc.expr)}; const ms = []; const fms = [];
          for (let i = 1; i <= full.length; i++) {
            inp.value = full.slice(0, i); const s = performance.now(); inp.dispatchEvent(new Event('input', { bubbles: true })); const m = performance.now() - s;
            const f0 = performance.now(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); fms.push(performance.now() - f0);
            ms.push(m);
          }
          const srt = (a) => a.slice().sort((x, y) => x - y);
          const a = srt(ms), b = srt(fms);
          return { n: ms.length, inputMs: { p50: +a[a.length >> 1].toFixed(2), max: +a[a.length - 1].toFixed(2), sum: +ms.reduce((x, y) => x + y, 0).toFixed(1) }, twoFramesMs: { p50: +b[b.length >> 1].toFixed(1), max: +b[b.length - 1].toFixed(1) } };
        })()`, 60000);
      }
      const lg = logs().filter((x) => x.t === 'EXC' || x.t === 'error');
      if (lg.length) r.errors = lg.slice(0, 3);
    } catch (e) { r.err = String(e && e.stack || e).slice(0, 300); }
    out[(BASE.includes('before') ? 'B_' : 'A_') + sc.id] = r;
  }
}
return out;
