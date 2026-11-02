// Phase's colour key is always on the plot, top right (#365): no hover, no click to keep it open, no toggle. On a laptop
// (en, ru and it at 1440 px, ru at 1100 px): in Phase and Phase's sphere the key's canvas is shown at once, inside the
// plot's top right corner and clear of the readout, the empty chip and the notes; a click on it leaves it open; in
// Landscape the height key is the head's chip again and, back in Phase, the key is on the plot.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/phase_key_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = { rows: [] };
let phaseAria = '';
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
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
for (const [lang, w] of [['', 1440], ['ru', 1440], ['it', 1440], ['ru', 1100]]) {
  await openApp(lang, w);
  const tag = `${lang || 'en'} ${w}`;
  for (const main of ['phase', 'land', 'phase']) {
    await ev(`__cmwSetMain('${main}')`); await settle(1800);
    const r = await probe();
    info.rows.push([tag, main, r.onPlot, r.top, r.right]);
    if (main === 'phase') {
      ok(`${tag}: Phase: the key is on the plot`, r.onPlot && !r.hidden, r);
      ok(`${tag}: Phase: its picture is shown with no hover`, r.shown, r);
      ok(`${tag}: Phase: top right of the plot, inside it`, r.top <= 12 && r.right <= 12 && r.inside, r);
      ok(`${tag}: Phase: it does not touch the readout or the chips`, !r.hits.length, r);
      ok(`${tag}: Phase: the key has an accessible name`, r.aria.length > 2, r);
      phaseAria = r.aria;
      await ev(`document.getElementById('leftLegend').click()`); await settle(300);
      const c = await probe();
      ok(`${tag}: Phase: a click leaves the key shown`, c.shown && c.onPlot, c);
    } else {
      ok(`${tag}: Landscape: the height key is the head's chip`, r.inHead && !r.hidden, r);
      ok(`${tag}: Landscape: the chip is named for the height key, not the colour key`, r.aria.length > 2 && r.aria !== phaseAria && (lang || !/Colour/.test(r.aria)) && (lang || /^Height key/.test(r.aria)), { aria: r.aria, phaseAria });
    }
  }
  // (the classic X → Y view hides X's key: phase_key_xy_cmd.js, a classic-view suite)
}
return { pass: fails.length === 0, fails, info: { n: info.rows.length, sample: info.rows.slice(0, 4) } };
