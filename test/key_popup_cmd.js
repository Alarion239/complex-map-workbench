// The key's pop-up in a pane head (#337): the Height key (Landscape) and the Colour key (Phase) unfold under their chip,
// and must cover neither the probe's readout (which also carries the idle hint) nor the plane's notes. On a laptop: en, ru
// and it at 1440 px and ru at 1100 px, with the pointer idle (the hint) and, in Phase, over the plane (a probed point).
// On a phone (390 and 360 px) the key chip lies in the plot, unfolded by a tap, and must not touch the readout either.
// A command file for a CDP daemon (test/cdp_kit README): python3 build.py && test/<you>_cdp/q.sh test/key_popup_cmd.js
// Prints {pass, fails, info}.
const fails = [], info = { rows: [] };
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const settle = async (ms = 400) => { await sleep(ms); await ev('new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))'); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
async function openApp(lang, w, phone) {
  const ns = 'kp' + Date.now();
  await view(w, phone ? 844 : 800, false, !!phone);
  await send('Page.navigate', { url: `http://localhost:${PORT}/gl-helpers.html` }); await sleep(350);
  const o = { v3: true, v4: true, v5: true, v6: true, shapes: [{ id: 's1', kind: 'rect', a: [-2, -2], b: [2, 2] }], steps: [{ type: 'recurrence', params: { u0: '0', g: 'u^2+z', N: 12, cut: 180 }, on: true }], nextId: 50, focus: 0, rightMode: 'color' };
  await ev(`localStorage.setItem('complex-map-workbench-v1:${ns}', ${JSON.stringify(JSON.stringify(o))}); 1`);
  await send('Page.navigate', { url: `http://localhost:${PORT}/test.html?ns=${ns}${lang ? '&lang=' + lang : ''}` }); await sleep(2300);
  await settle(800);
}
// the pop-up (the key's canvas, shown while the chip is pointed at) against the plot's corner chips; rects in px
const probe = () => ev(`(() => {
  const r = (e) => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width }; };
  const cv = document.getElementById('legendCanvasL'), plot = document.getElementById('plotL');
  const pop = r(cv), hits = [];
  for (const e of plot.querySelectorAll(':scope > .chip.readout, :scope > .empty-chip, :scope > .dim-chip')) {
    const q = r(e); if (q.w && q.l < pop.r && pop.l < q.r && q.t < pop.b && pop.t < q.b) hits.push((e.id || e.className) + ' ' + Math.round(q.l) + ',' + Math.round(q.t) + '-' + Math.round(q.r) + ',' + Math.round(q.b));
  }
  return { shown: getComputedStyle(cv).display !== 'none' && pop.w > 0, pop, hits, inView: pop.b <= innerHeight && pop.r <= innerWidth && pop.l >= 0, readout: document.getElementById('leftReadout').textContent.slice(0, 30) };
})()`);
// a phone's chip is in the plot: its own rect against the readout's (only when it is unfolded)
const probePhone = () => ev(`(() => {
  const chip = document.getElementById('leftLegend'), ro = document.getElementById('leftReadout');
  const a = chip.getBoundingClientRect(), b = ro.getBoundingClientRect();
  return { folded: chip.classList.contains('collapsed'), hidden: chip.hidden, chip: [a.left, a.top, a.right, a.bottom].map(Math.round), readout: [b.left, b.top, b.right, b.bottom].map(Math.round), hit: !!b.width && b.left < a.right && a.left < b.right && b.top < a.bottom && a.top < b.bottom };
})()`);
const center = (id) => ev(`(() => { const b = document.getElementById('${id}').getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; })()`);
for (const [lang, w] of [['', 1440], ['ru', 1440], ['it', 1440], ['ru', 1100]]) {
  await openApp(lang, w);
  for (const main of ['land', 'phase']) {
    await ev(`__cmwSetMain('${main}')`); await settle(1800);
    // (in Landscape there is no probe: the readout holds the idle hint either way)
    for (const mode of main === 'land' ? ['idle'] : ['idle', 'probe']) {
      const pr = await ev(`(() => { const b = document.getElementById('plotL').getBoundingClientRect(); return [b.left + b.width * 0.4, b.top + b.height * 0.6]; })()`);
      await move(pr[0], pr[1]); await settle(300);
      if (mode === 'idle') { await move(5, 5); await settle(300); }   // (off the plane: the idle hint)
      const c = await center('leftLegend');
      await move(c[0], c[1]); await settle(500);
      const r = await probe();
      const tag = `${lang || 'en'} ${w} ${main} ${mode}`;
      info.rows.push([tag, r.shown, r.hits.length]);
      ok(`${tag}: the key pop-up is shown`, r.shown, r);
      ok(`${tag}: the pop-up covers no readout or note`, r.hits.length === 0, r.hits);
      ok(`${tag}: the pop-up is inside the window`, r.inView, r.pop);
    }
  }
}
// a phone: the chip unfolds on a tap and must clear the readout (Russian's hint wraps to two lines at 390 px)
for (const [lang, w] of [['ru', 390], ['', 360]]) {
  await openApp(lang, w, true);
  for (const main of ['land', 'phase']) {
    await ev(`__cmwSetMain('${main}')`); await settle(1800);
    await ev(`(() => { const c = document.getElementById('leftLegend'); if (c.classList.contains('collapsed')) c.click(); })()`); await settle(600);
    const r = await probePhone();
    const tag = `phone ${lang || 'en'} ${w} ${main}`;
    info.rows.push([tag, r.folded, r.hit]);
    ok(`${tag}: the key is unfolded`, !r.hidden && !r.folded, r);
    ok(`${tag}: the unfolded key does not touch the readout`, !r.hit, r);
  }
}
return { pass: fails.length === 0, fails, info: { n: info.rows.length, sample: info.rows.slice(0, 4) } };
