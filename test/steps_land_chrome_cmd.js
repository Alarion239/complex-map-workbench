// The steps view's Landscape chrome: the Height key, the title and the readout name what the height reads, which
// follows the colour plane T: the map into T up to it (F from z into the last plane, f₁, f₂), T's own variable
// on T, and past T T's variable, whose heights the points carry. The default page (z, exp, Möbius) on the Landscape,
// with T = w₁ (plane w₂ past it) and T = w₂ (the default):
// - on every plane at rest and between planes, held at u = 0.5: the Height key is the key, captioned "height log |X|",
//   X what the plane's height reads (held, either plane's);
// - the title names the relief's height, log|X|, on every plane with either T;
// - at rest the probe at the pane's centre reads the point, X there (but on T, where X is the point) and the height |X|
//   (but on T, where the point's own row reads it);
// - the Height control names the kind of height alone ("log |·|", "|·|", "Re", "Im"), each button named in words.
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
// what plane i's height reads with T
const X = (T, i) => (i >= T ? `w${'₀₁₂'[T]}` : T === 2 && i === 0 ? 'F' : i === 0 ? 'f₁' : 'f₂');
// the Height control names the kind of height alone, the same on every plane (the title, the key and the ruler name the
// map), each button with an accessible name in words
info.heightSeg = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#heightSeg button')].map((b) => [b.dataset.v, b.textContent.trim(), b.getAttribute('aria-label')]))`));
ok('the Height control: the kinds log |·|, |·|, Re, Im', JSON.stringify(info.heightSeg.map((b) => b.slice(0, 2))) === JSON.stringify([['log', 'log |·|'], ['abs', '|·|'], ['re', 'Re'], ['im', 'Im']]), info.heightSeg);
ok('the Height control: each button named in words', JSON.stringify(info.heightSeg.map((b) => b[2])) === JSON.stringify(['log of the modulus', 'modulus', 'real part', 'imaginary part']), info.heightSeg);
info.runs = {};
for (const T of [1, 2]) {
  const r = info.runs['T' + T] = { rest: {}, held: {} };
  await ev(`__cmwSteps({ T: ${T} }); 1`);
  for (const i of [0, 1, 2]) {
    await rest(i);
    const k = await legend(), role = await ev('__cmwSteps().names.title.role');
    const rows = await probeRows();
    r.rest[i] = { k, role, rows };
    const x = X(T, i);
    ok(`T = ${T}, plane ${i} at rest: the Height key, of ${x}`, k.kind === '3d' && k.caption === `height log |${x}|`, k);
    ok(`T = ${T}, plane ${i}: the title's height is log|${x}|`, String(role).replace(/<[^>]*>/g, '').includes(`log|${x}|`), role);
    const lab = rows.map((r) => r[0].trim());
    // (on T the point's own row reads |x|: a log height adds no second one)
    ok(`T = ${T}, plane ${i} at rest: the readout reads |${x}| once`, lab.filter((l) => l === `|${x}|`).length === 1, rows);
    // (on T, x is the plane's own variable: its row is the point's, not repeated)
    ok(`T = ${T}, plane ${i} at rest: the readout reads ${x} once`, lab.filter((l) => l === x).length === 1, rows);
  }
  for (const x of [0.5, 1.5]) {
    await rest(Math.floor(x));
    await park(x);
    const k = await legend();
    r.held[x] = k;
    const xs = [X(T, Math.floor(x)), X(T, Math.ceil(x))].map((v) => `height log |${v}|`);
    ok(`T = ${T}, held at ${x}: the Height key, of either plane's`, k.kind === '3d' && xs.includes(k.caption), k);
  }
}
return { pass: fails.length === 0, fails, info };
