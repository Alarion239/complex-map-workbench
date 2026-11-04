// The steps view's Landscape chrome: the Height key, the title and the readout describe
// h(F), the same quantity on every plane. The default page (z, exp, Möbius) on the Landscape, with T = w₁ (plane w₂
// past it) and T = w₂ (the default):
// - on every plane at rest and between planes, held at u = 0.5: the Height key is the key, captioned "height log |F|";
// - the title names the relief's height, log|F|, on every plane with either T;
// - at rest the probe at the pane's centre reads the point, F there (but on the last plane, where F is the point) and
//   the height |F|, the same value of a point of z as of its image in w₁ and w₂.
// A command file for a CDP daemon (test/cdp_kit README); CI runs it in the views shard (ci/browser_shards.js)
// Prints {pass, fails, info}.
const fails = [], info = {};
const ok = (name, cond, got) => { if (!cond) fails.push({ name, got }); };
const PORT = (/localhost:(\d+)/.exec(fs.readFileSync(DIR + '/cdpd.js', 'utf8')) || [0, '8793'])[1];
await view(1440, 900, false, false);
const rAF2 = 'new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))';
const rest = async (i) => { await ev(`__cmwSteps({ go: ${i}, now: true }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const park = async (x) => { await ev(`__cmwSteps({ park: ${x} }); 1`); await settled({ max: 60000 }); await ev(rAF2); };
const legend = async () => JSON.parse(await ev('JSON.stringify(__cmwLegend())'));
// the pointer over the pane's centre: the readout's rows (label, value) and the probed point
async function probeRows() {
  const c = JSON.parse(await ev(`JSON.stringify((() => { const r = document.getElementById('canvasL').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })())`));
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0] + 1, y: c[1] });
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: c[0], y: c[1] });
  await settled({ max: 20000 });
  await ev(rAF2);
  return JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#leftReadout .rp')].map((e) => [e.querySelector('.rk') ? e.querySelector('.rk').textContent : '', e.querySelector('.rv') ? e.querySelector('.rv').textContent : '']))`));
}
await go(`http://localhost:${PORT}/test.html?view=steps&ns=landchrome${Date.now()}`);
await settled({ max: 30000, until: 'typeof __cmwSteps === "function" && !!window.GLR' });
await ev(`__cmwSteps({ scope: 'all', surf: 'land', go: 0, now: true }); 1`);
await settled({ max: 60000 });
info.runs = {};
for (const T of [1, 2]) {
  const r = info.runs['T' + T] = { rest: {}, held: {} };
  await ev(`__cmwSteps({ T: ${T} }); 1`);
  for (const i of [0, 1, 2]) {
    await rest(i);
    const k = await legend(), role = await ev('__cmwSteps().names.title.role');
    const rows = await probeRows();
    r.rest[i] = { k, role, rows };
    ok(`T = ${T}, plane ${i} at rest: the Height key, of F`, k.kind === '3d' && k.caption === 'height log |F|', k);
    ok(`T = ${T}, plane ${i}: the title's height is log|F|`, /log\|<i>F<\/i>\|/.test(role), role);
    const lab = rows.map((x) => x[0].trim());
    ok(`T = ${T}, plane ${i} at rest: the readout reads |F|`, lab.includes('|F|'), rows);
    ok(`T = ${T}, plane ${i} at rest: the readout reads F ${i === 2 ? 'not again (it is w₂)' : ''}`, lab.includes('F') === (i !== 2), rows);
  }
  for (const x of [0.5, 1.5]) {
    await rest(Math.floor(x));
    await park(x);
    const k = await legend();
    r.held[x] = k;
    ok(`T = ${T}, held at ${x}: the Height key, of F`, k.kind === '3d' && k.caption === 'height log |F|', k);
  }
}
return { pass: fails.length === 0, fails, info };
