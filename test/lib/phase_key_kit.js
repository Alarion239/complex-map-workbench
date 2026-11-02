// What the two Phase-key suites share: opening the app with a recurrence at a width and language, and the probe of the
// colour key's place. An expression for eval in a suite: `const { openApp, probe } = eval(fs.readFileSync(...))({ ev, send, view, sleep, DIR })`.
({ ev, send, view, sleep, DIR }) => {
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
async function openApp(lang, w) {
  const ns = 'pk' + Date.now();
  await view(w, 800, false, false);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's1', kind: 'rect', a: [-2, -2], b: [2, 2] }], steps: [{ type: 'recurrence', params: { u0: '0', g: 'u^2+z', N: 12, cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'color' };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}${lang ? '&lang=' + lang : ''}` }); await sleep(2300);
  await settle(800);
}
const probe = () => ev(`(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width }; };
  const leg = document.getElementById('leftLegend'), cv = document.getElementById('legendCanvasL'), plot = document.getElementById('plotL');
  const c = r(cv), p = r(plot), hits = [];
  for (const e of plot.querySelectorAll(':scope > .chip.readout, :scope > .empty-chip, :scope > .dim-chip')) {
    const q = r(e); if (q.w && q.l < c.r && c.l < q.r && q.t < c.b && c.t < q.b) hits.push((e.id || e.className) + ' ' + Math.round(q.l) + ',' + Math.round(q.t));
  }
  return { onPlot: leg.parentNode === plot, inHead: !!leg.parentNode.classList && leg.parentNode.classList.contains('pane-head'), hidden: leg.hidden, shown: getComputedStyle(cv).display !== 'none' && c.w > 0,
    top: Math.round(c.t - p.t), right: Math.round(p.r - c.r), inside: c.l >= p.l && c.r <= p.r && c.t >= p.t, hits, cls: leg.className, aria: leg.getAttribute('aria-label') || '' };
})()`);
  return { openApp, probe, settle };
}
